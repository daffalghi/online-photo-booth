import { Server } from 'socket.io';
import * as roomService from '../../services/roomService';
import path from 'path';
import fs from 'fs';
import knex from '../../db';
import { UPLOADS_DIR } from '../../services/compositeService';
import { broadcastRoomState } from './room';
import { AppSocket } from '../../types';

const MAX_SHOTS = 10;
const DEFAULT_COUNTDOWN_SECONDS = 3;
const COUNTDOWN_BUFFER_MS = 800;

// ── In-memory state ─────────────────────────────────────────────────────────

/** participantId → Set of participants who pressed "Take Photo" for a given round */
const readyMap = new Map<string, Map<number, Set<string>>>();

/** Uploaded frames per room + round (participantId -> storageKey) */
const uploadMap = new Map<string, Map<number, Map<string, string>>>();

/** participantId → Set of participants who clicked "Keep This Shot" for a given round */
const keepMap = new Map<string, Map<number, Set<string>>>();

/** Scheduled capture timeouts (for cleanup) */
const countdownMap = new Map<string, Map<number, ReturnType<typeof setTimeout>>>();

/** Participants who said "Done taking photos" */
const finishMap = new Map<string, Set<string>>();

export interface SharedBackgroundItem {
  id: string;
  name: string;
  url: string;
  uploadedBy: string;
  uploadedById: string;
  uploadedAt: number;
}

/** Retrieve all public custom backgrounds from SQLite to be shared with all users */
export async function getGlobalBackgrounds(baseUrl: string): Promise<SharedBackgroundItem[]> {
  try {
    const rows = await knex('custom_backgrounds')
      .orderBy('created_at', 'desc')
      .limit(100);
    return rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      url: `${baseUrl}/uploads/${r.storage_key}`,
      uploadedBy: r.uploaded_by,
      uploadedById: r.uploaded_by_id || '',
      uploadedAt: r.created_at,
    }));
  } catch (err) {
    console.error('Error fetching global custom backgrounds:', err);
    return [];
  }
}

function getReadySet(roomId: string, slotIndex: number): Set<string> {
  if (!readyMap.has(roomId)) readyMap.set(roomId, new Map());
  const rm = readyMap.get(roomId)!;
  if (!rm.has(slotIndex)) rm.set(slotIndex, new Set());
  return rm.get(slotIndex)!;
}

function getKeepSet(roomId: string, slotIndex: number): Set<string> {
  if (!keepMap.has(roomId)) keepMap.set(roomId, new Map());
  const rm = keepMap.get(roomId)!;
  if (!rm.has(slotIndex)) rm.set(slotIndex, new Set());
  return rm.get(slotIndex)!;
}

function clearRoundState(roomId: string, slotIndex: number): void {
  readyMap.get(roomId)?.delete(slotIndex);
  uploadMap.get(roomId)?.delete(slotIndex);
  keepMap.get(roomId)?.delete(slotIndex);
  const ct = countdownMap.get(roomId)?.get(slotIndex);
  if (ct) clearTimeout(ct);
  countdownMap.get(roomId)?.delete(slotIndex);
}

function getFinishSet(roomId: string): Set<string> {
  if (!finishMap.has(roomId)) finishMap.set(roomId, new Set());
  return finishMap.get(roomId)!;
}

export function clearRoomCaptureState(roomId: string): void {
  readyMap.delete(roomId);
  uploadMap.delete(roomId);
  keepMap.delete(roomId);
  const roomCountdowns = countdownMap.get(roomId);
  if (roomCountdowns) {
    roomCountdowns.forEach((handle) => clearTimeout(handle));
  }
  countdownMap.delete(roomId);
  finishMap.delete(roomId);
}

// ── Handler ──────────────────────────────────────────────────────────────────

export function handleCaptureEvents(io: Server, socket: AppSocket, baseUrl: string): void {

  // ── "Take Photo" pressed — start countdown immediately ──────────
  socket.on('capture:ready', async (payload: { roomId: string; slotIndex: number }) => {
    const { roomId, slotIndex } = payload;
    const participantId = socket.participantId;
    if (!participantId) return;

    const room = await roomService.getRoomById(roomId);
    if (!room || room.status !== 'capturing') return;

    // Prevent duplicate countdown if already counting down or previewing
    if (room.currentRoundStatus === 'counting_down' || room.currentRoundStatus === 'previewing') {
      return;
    }

    const ready = getReadySet(roomId, slotIndex);
    ready.add(participantId);
    io.to(roomId).emit('capture:readyStatus', { slotIndex, readyParticipantIds: [...ready] });

    // Start synchronized countdown
    await roomService.updateRoomRound(roomId, slotIndex, 'counting_down');
    const settings = await roomService.getRoomSettings(roomId);
    const countdownSecs = settings.countdownSeconds || 3;
    const durationMs = countdownSecs * 1000;
    const targetCaptureTimestamp = Date.now() + durationMs;

    io.to(roomId).emit('capture:countdown', { slotIndex, durationMs, targetCaptureTimestamp });

    const handle = setTimeout(async () => {
      await roomService.updateRoomRound(roomId, slotIndex, 'previewing');
    }, durationMs + COUNTDOWN_BUFFER_MS);

    if (!countdownMap.has(roomId)) countdownMap.set(roomId, new Map());
    countdownMap.get(roomId)!.set(slotIndex, handle);
  });

  // ── Filter changed by any participant ────────────────────────────────────
  socket.on('capture:setFilter', (payload: { roomId: string; filter: string }) => {
    const { roomId, filter } = payload;
    if (!roomId) return;
    io.to(roomId).emit('capture:filterUpdated', { filter });
  });

  // ── Background changed by any participant ────────────────────────────────
  socket.on('capture:setBackground', (payload: { roomId: string; background: unknown }) => {
    const { roomId, background } = payload;
    if (!roomId) return;
    io.to(roomId).emit('capture:backgroundSelected', { background });
  });


  // ── Frame uploaded from client ───────────────────────────────────────────
  socket.on('capture:frameUpload', async (payload: { roomId: string; slotIndex: number; photoDataUrl: string; filters: string[] }) => {
    const { roomId, slotIndex, photoDataUrl, filters } = payload;
    const participantId = socket.participantId;
    if (!participantId) return;

    const participant = await roomService.getParticipantById(participantId);
    if (!participant) return;

    const room = await roomService.getRoomById(roomId);
    if (!room) return;

    try {
      const matches = photoDataUrl.match(/^data:image\/\w+;base64,(.+)$/);
      if (!matches) { socket.emit('error', { message: 'Invalid photo data', code: 'INVALID_PHOTO' }); return; }

      const imageBuffer = Buffer.from(matches[1], 'base64');
      const storageKey = `${roomId}_slot${slotIndex}_${participant.side}_${Date.now()}.jpg`;
      const filePath = path.join(UPLOADS_DIR, storageKey);

      await fs.promises.writeFile(filePath, imageBuffer);
      await roomService.savePhoto(roomId, participantId, participant.side, slotIndex, storageKey, filters);

      // Track in-memory for round completion check
      if (!uploadMap.has(roomId)) uploadMap.set(roomId, new Map());
      const roomUploads = uploadMap.get(roomId)!;
      if (!roomUploads.has(slotIndex)) roomUploads.set(slotIndex, new Map());
      const roundUploads = roomUploads.get(slotIndex)!;
      roundUploads.set(participantId, storageKey);

      // Check if all connected participants have uploaded
      const participants = await roomService.getParticipants(roomId);
      const activeParticipants = participants.filter((p) => p.connectionStatus === 'connected');
      const targetParticipants = activeParticipants.length > 0 ? activeParticipants : participants;

      const isSolo = room.capacity === 1 || room.settings?.mode === 'solo';
      const allUploaded = isSolo || targetParticipants.every((p) => roundUploads.has(p.id));

      if (allUploaded) {
        await roomService.updateRoomRound(roomId, slotIndex, 'previewing');
        const shots = await roomService.getPairedShots(roomId, baseUrl);
        const thisShot = shots.find((s) => s.slotIndex === slotIndex);
        io.to(roomId).emit('capture:pairReady', {
          slotIndex,
          leftPhotoUrl: thisShot?.leftPhotoUrl || `${baseUrl}/uploads/${storageKey}`,
          rightPhotoUrl: thisShot?.rightPhotoUrl || `${baseUrl}/uploads/${storageKey}`,
          photos: thisShot?.photos || [],
        });
        await broadcastRoomState(io, roomId, baseUrl);
      }
    } catch (err) {
      console.error('Photo save error:', err);
      socket.emit('error', { message: 'Failed to save photo', code: 'SAVE_ERROR' });
    }
  });

  // ── Retake: delete current slot and reset round ─────────────────────────
  socket.on('capture:retake', async (payload: { roomId: string; slotIndex: number }) => {
    const { roomId, slotIndex } = payload;
    const participantId = socket.participantId;
    if (!participantId) return;

    const room = await roomService.getRoomById(roomId);
    if (!room || room.status !== 'capturing') return;

    const keys = await roomService.deleteSlotPhotos(roomId, slotIndex);
    await Promise.all(
      keys.map(async (key) => {
        const fp = path.join(UPLOADS_DIR, key);
        try {
          if (fs.existsSync(fp)) await fs.promises.unlink(fp);
        } catch (e) {
          // File may already be unlinked, ignore
        }
      }),
    );

    clearRoundState(roomId, slotIndex);
    await roomService.updateRoomRound(roomId, slotIndex, 'waiting_ready');

    io.to(roomId).emit('capture:retakeRequested', { slotIndex, requestedByParticipantId: participantId });
    await broadcastRoomState(io, roomId, baseUrl);
  });

  // ── Keep: both participants must keep to lock the shot ──────────────────
  socket.on('capture:keep', async (payload: { roomId: string; slotIndex: number }) => {
    const { roomId, slotIndex } = payload;
    const participantId = socket.participantId;
    if (!participantId) return;

    const room = await roomService.getRoomById(roomId);
    if (!room || room.status !== 'capturing') return;

    const keepSet = getKeepSet(roomId, slotIndex);
    keepSet.add(participantId);

    await roomService.markPhotoKept(roomId, slotIndex, participantId);

    const keptArray = [...keepSet];
    io.to(roomId).emit('capture:keepStatus', { slotIndex, confirmedParticipantIds: keptArray });

    const participants = await roomService.getParticipants(roomId);
    const activeParticipants = participants.filter((p) => p.connectionStatus === 'connected');
    const targetParticipants = activeParticipants.length > 0 ? activeParticipants : participants;

    if (targetParticipants.every((p) => keepSet.has(p.id))) {
      await roomService.updateRoomRound(roomId, slotIndex, 'locked');
      io.to(roomId).emit('capture:roundLocked', { slotIndex });
    }
    await broadcastRoomState(io, roomId, baseUrl);
  });

  // ── Take another: advance to next round index ────────────────────────────
  socket.on('capture:nextRound', async (payload: { roomId: string }) => {
    const { roomId } = payload;
    const participantId = socket.participantId;
    if (!participantId) return;

    const room = await roomService.getRoomById(roomId);
    if (!room || room.status !== 'capturing') return;

    const allPhotos = await roomService.getAllPhotosForRoom(roomId);
    const lockedSlotIndexes = new Set(
      allPhotos
        .filter((p) => p.keptByParticipantIds.length >= 1)
        .map((p) => p.slotIndex),
    );
    const nextSlot = lockedSlotIndexes.size;

    if (nextSlot >= MAX_SHOTS) return;

    await roomService.updateRoomRound(roomId, nextSlot, 'waiting_ready');
    finishMap.delete(roomId);

    await broadcastRoomState(io, roomId, baseUrl);
  });

  // ── Done: both participants say "I'm done" → photo_selection ────────────
  socket.on('capture:finish', async (payload: { roomId: string }) => {
    const { roomId } = payload;
    const participantId = socket.participantId;
    if (!participantId) return;

    const room = await roomService.getRoomById(roomId);
    if (!room || room.status !== 'capturing') return;

    const finishSet = getFinishSet(roomId);
    finishSet.add(participantId);

    io.to(roomId).emit('capture:finishStatus', { finishedParticipantIds: [...finishSet] });

    const participants = await roomService.getParticipants(roomId);
    const activeParticipants = participants.filter((p) => p.connectionStatus === 'connected');
    const targetParticipants = activeParticipants.length > 0 ? activeParticipants : participants;

    if (targetParticipants.every((p) => finishSet.has(p.id))) {
      await roomService.updateRoomStatus(roomId, 'frame_selection');
      clearRoomCaptureState(roomId);
      await broadcastRoomState(io, roomId, baseUrl);
    }
  });

  // ── Global Custom Backgrounds: get public backgrounds for everyone ───────
  socket.on('capture:getBackgrounds', async () => {
    try {
      const backgrounds = await getGlobalBackgrounds(baseUrl);
      socket.emit('capture:backgroundsUpdated', { backgrounds });
    } catch (err) {
      console.error('Error on capture:getBackgrounds:', err);
    }
  });

  // ── Global Custom Backgrounds: upload and share with everyone globally ────
  socket.on(
    'capture:uploadBackground',
    async (payload: { photoDataUrl: string; name?: string; displayName?: string }) => {
      try {
        const { photoDataUrl, name, displayName } = payload;
        if (!photoDataUrl) return;

        const participantId = socket.participantId || null;
        let uploaderName = displayName;
        if (!uploaderName && participantId) {
          const participant = await knex('participants').where('id', participantId).first();
          uploaderName = participant?.display_name;
        }
        uploaderName = uploaderName || 'Pengguna';
        const bgName = name?.trim() || 'Custom Background';

        const matches = photoDataUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (!matches || matches.length !== 3) return;

        const mime = matches[1];
        const ext = mime.includes('png') ? '.png' : mime.includes('webp') ? '.webp' : '.jpg';
        const buffer = Buffer.from(matches[2], 'base64');
        const storageKey = `bg_global_${Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext}`;
        const filePath = path.join(UPLOADS_DIR, storageKey);

        await fs.promises.writeFile(filePath, buffer);

        const bgId = `bg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        const now = Date.now();

        await knex('custom_backgrounds').insert({
          id: bgId,
          name: bgName,
          storage_key: storageKey,
          uploaded_by: uploaderName,
          uploaded_by_id: participantId,
          created_at: now,
        });

        // Broadcast to ALL users across ALL rooms globally
        const backgrounds = await getGlobalBackgrounds(baseUrl);
        io.emit('capture:backgroundsUpdated', { backgrounds });
      } catch (err) {
        console.error('Error on capture:uploadBackground:', err);
      }
    },
  );

  // ── Global Custom Backgrounds: remove ────────────────────────────────────
  socket.on('capture:removeBackground', async (payload: { bgId: string }) => {
    try {
      const { bgId } = payload;
      if (!bgId) return;

      const row = await knex('custom_backgrounds').where('id', bgId).first();
      if (row) {
        const filePath = path.join(UPLOADS_DIR, row.storage_key);
        if (fs.existsSync(filePath)) {
          await fs.promises.unlink(filePath).catch(() => {});
        }
        await knex('custom_backgrounds').where('id', bgId).del();
      }

      // Broadcast to ALL users across ALL rooms globally
      const backgrounds = await getGlobalBackgrounds(baseUrl);
      io.emit('capture:backgroundsUpdated', { backgrounds });
    } catch (err) {
      console.error('Error on capture:removeBackground:', err);
    }
  });
}

