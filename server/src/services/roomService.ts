import knex from '../db';
import path from 'path';
import fs from 'fs';
import {
  Room,
  Participant,
  Photo,
  PairedShot,
  RoomSettings,
  RoomStatus,
  RoundStatus,
  FrameTemplate,
  RoomRow,
  ParticipantRow,
  PhotoRow,
  VoteRow,
  FinalRenderRow,
} from '../types';
import { v4 as uuidv4 } from 'uuid';
import generatedFrames from './generatedFrames.json';
import { UPLOADS_DIR, RENDERS_DIR } from './compositeService';

const DEFAULT_SETTINGS: RoomSettings = {
  shotCount: 3,
  countdownSeconds: 3,
  layout: 'strip3',
};

// Automatic Privacy Deletion:
// 2 Hours Room TTL (Auto-cleanup deletes all rooms and disk photo files older than 2 hours)
// 30 Minutes Post-Completion TTL (Wipes session shortly after final photo render)
const ROOM_TTL_MS = 2 * 60 * 60 * 1000;
const COMPLETED_ROOM_TTL_MS = 30 * 60 * 1000;

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

async function generateUniqueCode(): Promise<string> {
  let code: string;
  let attempts = 0;
  do {
    code = generateCode();
    attempts++;
    if (attempts > 100) throw new Error('Could not generate unique code');
    const existing = await knex<RoomRow>('rooms').where('code', code).first();
    if (!existing) return code;
  } while (true);
}

// ─── Room ─────────────────────────────────────────────────────────────────

export async function createRoom(settings: Partial<RoomSettings> = {}, pin?: string): Promise<Room> {
  const id = uuidv4();
  const code = await generateUniqueCode();
  const finalSettings = { ...DEFAULT_SETTINGS, ...settings };
  const now = Date.now();
  const capacity = finalSettings.mode === 'solo' ? 1 : finalSettings.mode === 'group' ? 6 : 2;

  // Security is mandatory for Duo and Group modes
  let sanitizedPin: string | null = null;
  if (finalSettings.mode !== 'solo') {
    if (!pin || !pin.trim()) {
      throw new Error('PIN room wajib diisi untuk mode Berdua dan Grup demi keamanan privasi');
    }
    const cleaned = String(pin).trim().replace(/[^0-9]/g, '');
    if (cleaned.length < 4 || cleaned.length > 6) {
      throw new Error('PIN room wajib berupa 4 hingga 6 digit angka (0-9)');
    }
    sanitizedPin = cleaned;
  }

  await knex<RoomRow>('rooms').insert({
    id,
    code,
    status: 'lobby',
    capacity,
    settings_json: JSON.stringify(finalSettings),
    current_round_index: 0,
    current_round_status: 'waiting_ready',
    created_at: now,
    expires_at: now + ROOM_TTL_MS,
    pin: sanitizedPin,
  });
  return (await getRoomById(id))!;
}

export async function getRoomByCode(code: string): Promise<Room | null> {
  const row = await knex<RoomRow>('rooms').where('code', code).whereNot('status', 'expired').first();
  return row ? mapRoom(row) : null;
}

export async function getRoomById(id: string): Promise<Room | null> {
  const row = await knex<RoomRow>('rooms').where('id', id).first();
  return row ? mapRoom(row) : null;
}

export async function updateRoomStatus(roomId: string, status: RoomStatus): Promise<void> {
  const update: Partial<RoomRow> = { status };
  if (status === 'completed') {
    update.completed_at = Date.now();
    update.expires_at = Date.now() + COMPLETED_ROOM_TTL_MS;
  }
  await knex<RoomRow>('rooms').where('id', roomId).update(update);
}

export async function updateRoomRound(roomId: string, roundIndex: number, roundStatus: RoundStatus): Promise<void> {
  await knex('rooms').where('id', roomId).update({
    current_round_index: roundIndex,
    current_round_status: roundStatus,
  });
}

export async function getRoomSettings(roomId: string): Promise<RoomSettings> {
  const row = await knex('rooms').where('id', roomId).select('settings_json').first();
  return row ? JSON.parse(row.settings_json) : DEFAULT_SETTINGS;
}

export async function updateRoomSettings(roomId: string, settings: RoomSettings): Promise<void> {
  await knex('rooms').where('id', roomId).update({
    settings_json: JSON.stringify(settings),
  });
}


// ─── Participant ───────────────────────────────────────────────────────────

export async function addParticipant(roomId: string, displayName: string, sessionToken: string, isHost: boolean): Promise<Participant> {
  const id = uuidv4();
  const existing = await getParticipants(roomId);
  const room = await getRoomById(roomId);
  const isSolo = room?.capacity === 1 || room?.settings?.mode === 'solo';
  const isGroup = room?.settings?.mode === 'group';

  let side: string;
  if (isSolo) {
    side = 'left';
  } else if (isGroup) {
    side = `p${existing.length + 1}`;
  } else {
    const takenSides = existing.map((p) => p.side);
    side = !takenSides.includes('left') ? 'left' : 'right';
  }

  await knex<ParticipantRow>('participants').insert({
    id,
    room_id: roomId,
    display_name: displayName,
    session_token: sessionToken,
    is_host: isHost ? 1 : 0,
    side,
    connection_status: 'connected',
    joined_at: Date.now(),
  });
  return (await getParticipantById(id))!;
}

export async function getParticipants(roomId: string): Promise<Participant[]> {
  const rows = await knex<ParticipantRow>('participants').where('room_id', roomId);
  return rows.map(mapParticipant);
}

export async function getParticipantById(id: string): Promise<Participant | null> {
  const row = await knex<ParticipantRow>('participants').where('id', id).first();
  return row ? mapParticipant(row) : null;
}

export async function getParticipantByToken(token: string): Promise<Participant | null> {
  const row = await knex<ParticipantRow>('participants').where('session_token', token).first();
  return row ? mapParticipant(row) : null;
}

export async function updateParticipantConnection(participantId: string, status: 'connected' | 'disconnected', socketId?: string): Promise<void> {
  await knex<ParticipantRow>('participants').where('id', participantId).update({ connection_status: status, socket_id: socketId ?? null });
}

// ─── Photo ─────────────────────────────────────────────────────────────────

export async function savePhoto(roomId: string, participantId: string, side: string, slotIndex: number, storageKey: string, filters: string[] = []): Promise<Photo> {
  const id = uuidv4();
  await knex<PhotoRow>('photos').insert({
    id,
    room_id: roomId,
    participant_id: participantId,
    side,
    slot_index: slotIndex,
    storage_key: storageKey,
    filters_json: JSON.stringify(filters),
    captured_at: Date.now(),
    kept_by_json: '[]',
  });
  return (await getPhotoById(id))!;
}

export async function getPhotoById(id: string): Promise<Photo | null> {
  const row = await knex<PhotoRow>('photos').where('id', id).first();
  return row ? mapPhoto(row) : null;
}

export async function getPhotosForSlot(roomId: string, slotIndex: number): Promise<Photo[]> {
  const rows = await knex<PhotoRow>('photos').where('room_id', roomId).where('slot_index', slotIndex);
  return rows.map(mapPhoto);
}

export async function getAllPhotosForRoom(roomId: string): Promise<Photo[]> {
  const rows = await knex<PhotoRow>('photos').where('room_id', roomId).orderBy('slot_index').orderBy('side');
  return rows.map(mapPhoto);
}

export async function markPhotoKept(roomId: string, slotIndex: number, participantId: string): Promise<void> {
  const photos = await getPhotosForSlot(roomId, slotIndex);
  for (const photo of photos) {
    const keptBy = photo.keptByParticipantIds;
    if (!keptBy.includes(participantId)) {
      keptBy.push(participantId);
      await knex('photos').where('id', photo.id).update({ kept_by_json: JSON.stringify(keptBy) });
    }
  }
}

export async function deleteSlotPhotos(roomId: string, slotIndex: number): Promise<string[]> {
  const photos = await getPhotosForSlot(roomId, slotIndex);
  const keys = photos.map((p) => p.storageKey);
  await knex('photos').where('room_id', roomId).where('slot_index', slotIndex).delete();
  return keys;
}

export async function getPairedShots(roomId: string, baseUrl: string): Promise<PairedShot[]> {
  const photos = await getAllPhotosForRoom(roomId);
  const room = await getRoomById(roomId);
  const isSolo = room?.capacity === 1 || room?.settings?.mode === 'solo';
  const participants = await getParticipants(roomId);

  const slotMap = new Map<number, Photo[]>();
  for (const p of photos) {
    if (!slotMap.has(p.slotIndex)) slotMap.set(p.slotIndex, []);
    slotMap.get(p.slotIndex)!.push(p);
  }

  const result: PairedShot[] = [];
  slotMap.forEach((slotPhotos, slotIndex) => {
    const leftPhoto = slotPhotos.find((p) => p.side === 'left') || slotPhotos[0];
    const rightPhoto = slotPhotos.find((p) => p.side === 'right') || slotPhotos[1] || leftPhoto;

    const participantPhotos = slotPhotos.map((p) => {
      const foundParticipant = participants.find((part) => part.id === p.participantId);
      return {
        participantId: p.participantId,
        side: p.side,
        url: `${baseUrl}/uploads/${p.storageKey}`,
        displayName: foundParticipant?.displayName || p.side,
      };
    });

    const allKeptIds = Array.from(new Set(slotPhotos.flatMap((p) => p.keptByParticipantIds)));
    const activeParticipants = participants.filter((p) => p.connectionStatus === 'connected');
    const target = activeParticipants.length > 0 ? activeParticipants : participants;
    const allKept = target.length > 0 && target.every((p) => allKeptIds.includes(p.id));

    result.push({
      slotIndex,
      leftPhotoUrl: leftPhoto ? `${baseUrl}/uploads/${leftPhoto.storageKey}` : '',
      rightPhotoUrl: rightPhoto ? `${baseUrl}/uploads/${rightPhoto.storageKey}` : '',
      keptByParticipantIds: allKeptIds,
      status: allKept ? 'locked' : 'previewing',
      photos: participantPhotos,
    });
  });

  return result.sort((a, b) => a.slotIndex - b.slotIndex);
}

// ─── Vote ──────────────────────────────────────────────────────────────────

export async function upsertVote(roomId: string, participantId: string, frameTemplateId: string, customization: object): Promise<void> {
  const existing = await knex('votes').where('room_id', roomId).where('participant_id', participantId).first();
  if (existing) {
    await knex('votes').where('room_id', roomId).where('participant_id', participantId).update({
      frame_template_id: frameTemplateId, customization_json: JSON.stringify(customization), voted_at: Date.now(),
    });
  } else {
    await knex('votes').insert({
      id: uuidv4(), room_id: roomId, participant_id: participantId,
      frame_template_id: frameTemplateId, customization_json: JSON.stringify(customization), voted_at: Date.now(),
    });
  }
}

export async function getVotes(roomId: string): Promise<VoteRow[]> {
  return knex<VoteRow>('votes').where('room_id', roomId);
}

export async function checkUnanimousVote(roomId: string): Promise<string | null> {
  const participants = await getParticipants(roomId);
  const votes = await getVotes(roomId);
  if (votes.length < participants.length) return null;
  const templateIds = [...new Set(votes.map((v) => v.frame_template_id))];
  return templateIds.length === 1 ? templateIds[0] : null;
}

export async function clearVotes(roomId: string): Promise<void> {
  await knex('votes').where('room_id', roomId).delete();
}


// ─── Frame Templates ────────────────────────────────────────────────────────

export async function getFrameTemplates(): Promise<FrameTemplate[]> {
  const dbTemplates = await knex<FrameTemplate>('frame_templates');
  return dbTemplates;
}

export async function getFrameTemplateById(id: string): Promise<FrameTemplate> {
  const match = generatedFrames.find((g) => g.id === id);
  if (match) {
    return {
      id: match.id,
      name: match.name,
      layoutType: match.layout_type,
      layout_type: match.layout_type,
      category: match.category,
      description: match.description,
      accentColor: match.accent_color,
      accent_color: match.accent_color,
      thumbnailGradient: match.thumbnail_gradient,
      thumbnail_gradient: match.thumbnail_gradient,
      overlayUrl: match.overlay_url,
      overlay_url: match.overlay_url,
      frameWidth: match.frameWidth,
      frameHeight: match.frameHeight,
      cutoutBoxes: match.cutoutBoxes,
    };
  }

  const fromDb = await knex('frame_templates').where('id', id).first();
  if (fromDb) {
    let cutoutBoxes = [];
    try {
      if (fromDb.cutout_boxes_json) {
        cutoutBoxes = JSON.parse(fromDb.cutout_boxes_json);
      }
    } catch (_) {}

    return {
      id: fromDb.id,
      name: fromDb.name,
      layoutType: fromDb.layout_type,
      layout_type: fromDb.layout_type,
      category: fromDb.category || 'custom',
      description: fromDb.description || 'Frame kustom',
      accentColor: fromDb.accent_color,
      accent_color: fromDb.accent_color,
      thumbnailGradient: fromDb.thumbnail_gradient,
      thumbnail_gradient: fromDb.thumbnail_gradient,
      overlayUrl: fromDb.overlay_key || undefined,
      overlay_url: fromDb.overlay_key || undefined,
      frameWidth: fromDb.frame_width || undefined,
      frameHeight: fromDb.frame_height || undefined,
      cutoutBoxes,
      isCustom: Boolean(fromDb.is_custom),
    };
  }

  // Fallback to first available generated frame
  if (generatedFrames.length > 0) {
    const first = generatedFrames[0];
    return {
      id: first.id,
      name: first.name,
      layoutType: first.layout_type,
      layout_type: first.layout_type,
      category: first.category,
      description: first.description,
      accentColor: first.accent_color,
      accent_color: first.accent_color,
      thumbnailGradient: first.thumbnail_gradient,
      thumbnail_gradient: first.thumbnail_gradient,
      overlayUrl: first.overlay_url,
      overlay_url: first.overlay_url,
      frameWidth: first.frameWidth,
      frameHeight: first.frameHeight,
      cutoutBoxes: first.cutoutBoxes,
    };
  }

  // fallback default
  return {
    id: id || '1x4_01_png',
    name: 'Photo Frame',
    layoutType: '1x4',
    layout_type: '1x4',
    category: '1x4',
    description: '',
    accentColor: '#ff5e97',
    accent_color: '#ff5e97',
    thumbnailGradient: '',
    thumbnail_gradient: '',
  };
}

// ─── Render ─────────────────────────────────────────────────────────────────

export async function saveRender(roomId: string, frameTemplateId: string, outputKey: string): Promise<void> {
  await knex<FinalRenderRow>('final_renders').insert({
    id: uuidv4(),
    room_id: roomId,
    frame_template_id: frameTemplateId,
    output_key: outputKey,
    rendered_at: Date.now(),
  });
}

export async function getRender(roomId: string): Promise<FinalRenderRow | null> {
  const row = await knex<FinalRenderRow>('final_renders').where('room_id', roomId).orderBy('rendered_at', 'desc').first();
  return row ?? null;
}

// ─── Cleanup ─────────────────────────────────────────────────────────────────

export async function cleanupExpiredRooms(): Promise<number> {
  const now = Date.now();
  // Find all rooms where expires_at has passed
  const expiredRooms = await knex<RoomRow>('rooms').where('expires_at', '<', now);
  if (expiredRooms.length === 0) return 0;

  const expiredIds = expiredRooms.map((r) => r.id);

  // 1. Delete all raw uploaded photo files on disk
  const photos = await knex<PhotoRow>('photos').whereIn('room_id', expiredIds);
  for (const p of photos) {
    if (p.storage_key) {
      const filePath = path.join(UPLOADS_DIR, p.storage_key);
      await fs.promises.unlink(filePath).catch(() => {});
    }
  }

  // 2. Delete all final composite render files on disk
  const renders = await knex<FinalRenderRow>('final_renders').whereIn('room_id', expiredIds);
  for (const r of renders) {
    if (r.output_key) {
      const filePath = path.join(RENDERS_DIR, r.output_key);
      await fs.promises.unlink(filePath).catch(() => {});
    }
  }

  // 3. Delete database records
  await knex('final_renders').whereIn('room_id', expiredIds).del();
  await knex('votes').whereIn('room_id', expiredIds).del();
  await knex('photos').whereIn('room_id', expiredIds).del();
  await knex('participants').whereIn('room_id', expiredIds).del();
  const deletedCount = await knex('rooms').whereIn('id', expiredIds).del();

  return deletedCount;
}

/**
 * Instant Hard Deletion:
 * Immediately shreds all raw photos, composite renders, and database records for a specific room.
 */
export async function destroyRoomNow(roomId: string): Promise<boolean> {
  try {
    // 1. Delete all raw uploaded photo files on disk
    const photos = await knex<PhotoRow>('photos').where('room_id', roomId);
    for (const p of photos) {
      if (p.storage_key) {
        const filePath = path.join(UPLOADS_DIR, p.storage_key);
        await fs.promises.unlink(filePath).catch(() => {});
      }
    }

    // 2. Delete all final composite render files on disk
    const renders = await knex<FinalRenderRow>('final_renders').where('room_id', roomId);
    for (const r of renders) {
      if (r.output_key) {
        const filePath = path.join(RENDERS_DIR, r.output_key);
        await fs.promises.unlink(filePath).catch(() => {});
      }
    }

    // 3. Delete database records
    await knex('final_renders').where('room_id', roomId).del();
    await knex('votes').where('room_id', roomId).del();
    await knex('photos').where('room_id', roomId).del();
    await knex('participants').where('room_id', roomId).del();
    await knex('rooms').where('id', roomId).del();

    return true;
  } catch (err) {
    console.error(`[Privacy] Error destroying room ${roomId}:`, err);
    return false;
  }
}

// ─── Mappers ──────────────────────────────────────────────────────────────────

function mapRoom(row: RoomRow): Room {
  return {
    id: row.id,
    code: row.code,
    status: row.status,
    capacity: row.capacity,
    settings: JSON.parse(row.settings_json),
    currentRoundIndex: row.current_round_index,
    currentRoundStatus: row.current_round_status,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    completedAt: row.completed_at ?? undefined,
    pin: row.pin ?? undefined,
  };
}

function mapParticipant(row: ParticipantRow): Participant {
  return {
    id: row.id,
    roomId: row.room_id,
    displayName: row.display_name,
    isHost: Boolean(row.is_host),
    side: row.side,
    connectionStatus: row.connection_status,
    joinedAt: row.joined_at,
  };
}

function mapPhoto(row: PhotoRow): Photo {
  return {
    id: row.id,
    roomId: row.room_id,
    participantId: row.participant_id,
    side: row.side,
    slotIndex: row.slot_index,
    storageKey: row.storage_key,
    url: '',
    filtersApplied: JSON.parse(row.filters_json),
    capturedAt: row.captured_at,
    keptByParticipantIds: JSON.parse(row.kept_by_json),
  };
}
