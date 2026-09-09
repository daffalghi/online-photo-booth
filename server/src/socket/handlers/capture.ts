import { Server } from 'socket.io';
import * as roomService from '../../services/roomService';
import path from 'path';
import fs from 'fs';
import { UPLOADS_DIR } from '../../services/compositeService';
import { broadcastRoomState } from './room';
import { AppSocket } from '../../types';

const MAX_SHOTS = 10;
const DEFAULT_COUNTDOWN_SECONDS = 3;
const COUNTDOWN_BUFFER_MS = 800;

// ── In-memory state ─────────────────────────────────────────────────────────

/** participantId → Set of participants who pressed "Take Photo" for a given round */
const readyMap = new Map<string, Map<number, Set<string>>>();

/** Uploaded frames per room + round */
const uploadMap = new Map<string, Map<number, { left?: string; right?: string }>>();

/** participantId → Set of participants who clicked "Keep This Shot" for a given round */
const keepMap = new Map<string, Map<number, Set<string>>>();

/** Scheduled capture timeouts (for cleanup) */
const countdownMap = new Map<string, Map<number, ReturnType<typeof setTimeout>>>();

/** Participants who said "Done taking photos" */
const finishMap = new Map<string, Set<string>>();

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

      // Track in-memory for pair completion check
      if (!uploadMap.has(roomId)) uploadMap.set(roomId, new Map());
      const roomUploads = uploadMap.get(roomId)!;
      if (!roomUploads.has(slotIndex)) roomUploads.set(slotIndex, {});
      const roundUploads = roomUploads.get(slotIndex)!;
      if (participant.side === 'left') roundUploads.left = storageKey;
      else roundUploads.right = storageKey;

      // Both sides uploaded (or Solo mode single upload) → update room round to previewing & broadcast
      const isSolo = room.capacity === 1 || room.settings?.mode === 'solo';
      if (isSolo) {
        roundUploads.left = storageKey;
        roundUploads.right = storageKey;
        await roomService.updateRoomRound(roomId, slotIndex, 'previewing');
        io.to(roomId).emit('capture:pairReady', {
          slotIndex,
          leftPhotoUrl: `${baseUrl}/uploads/${storageKey}`,
          rightPhotoUrl: `${baseUrl}/uploads/${storageKey}`,
        });
        await broadcastRoomState(io, roomId, baseUrl);
      } else if (roundUploads.left && roundUploads.right) {
        await roomService.updateRoomRound(roomId, slotIndex, 'previewing');
        io.to(roomId).emit('capture:pairReady', {
          slotIndex,
          leftPhotoUrl: `${baseUrl}/uploads/${roundUploads.left}`,
          rightPhotoUrl: `${baseUrl}/uploads/${roundUploads.right}`,
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
}
