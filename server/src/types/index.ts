import type { Socket } from 'socket.io';

// Shared TypeScript types between server and client

export interface AppSocket extends Socket {
  participantId?: string;
  roomId?: string;
}

export type RoomStatus =
  | 'lobby'
  | 'capturing'
  | 'photo_selection'
  | 'frame_selection'
  | 'rendering'
  | 'completed'
  | 'expired';

export type RoundStatus =
  | 'waiting_ready'
  | 'counting_down'
  | 'previewing'
  | 'locked';

export type ParticipantSide = 'left' | 'right' | string;

export type ConnectionStatus = 'connected' | 'disconnected';

export interface PhotoCropOffset {
  x?: number;
  y?: number;
  scale?: number;
}

export interface RoomSettings {
  shotCount: number;        // default 3
  countdownSeconds: number; // default 3
  layout: 'strip3' | 'strip4' | 'grid2x2' | 'single' | string;
  mode?: 'solo' | 'duo' | 'group'; // default duo
  selectedPhotoOrder?: (number | string)[];
  photoOffsets?: Record<number | string, PhotoCropOffset>;
  selectedFrameTemplateId?: string;
  customization?: { accentColor?: string; captionText?: string };
}

export interface Room {
  id: string;
  code: string;
  status: RoomStatus;
  capacity: number;
  settings: RoomSettings;
  currentRoundIndex: number;
  currentRoundStatus: RoundStatus;
  createdAt: number;
  expiresAt: number;
  completedAt?: number;
  pin?: string | null;
}

export interface Participant {
  id: string;
  roomId: string;
  displayName: string;
  isHost: boolean;
  side: ParticipantSide;
  connectionStatus: ConnectionStatus;
  joinedAt: number;
}

export interface Photo {
  id: string;
  roomId: string;
  participantId: string;
  side: ParticipantSide;
  slotIndex: number;
  storageKey: string;
  url: string;
  filtersApplied: string[];
  capturedAt: number;
  keptByParticipantIds: string[];
}

export interface CutoutBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FrameTemplate {
  id: string;
  name: string;
  layoutType: string;
  layout_type?: string;
  description: string;
  accentColor: string;
  accent_color?: string;
  thumbnailGradient: string;
  thumbnail_gradient?: string;
  overlayUrl?: string;
  overlay_url?: string;
  category?: string;
  frameWidth?: number;
  frameHeight?: number;
  cutoutBoxes?: CutoutBox[];
  isCustom?: boolean;
}

export interface Vote {
  id: string;
  roomId: string;
  participantId: string;
  frameTemplateId: string;
  customization: VoteCustomization;
  votedAt: number;
}

export interface VoteCustomization {
  accentColor?: string;
  captionText?: string;
}

export interface VoteStatus {
  participantId: string;
  frameTemplateId: string;
  customization: VoteCustomization;
}

export interface FinalRender {
  id: string;
  roomId: string;
  frameTemplateId: string;
  outputKey: string;
  outputUrl: string;
  renderedAt: number;
}

// Database Row Types for Knex queries
export interface RoomRow {
  id: string;
  code: string;
  status: RoomStatus;
  capacity: number;
  settings_json: string;
  current_round_index: number;
  current_round_status: RoundStatus;
  created_at: number;
  expires_at: number;
  completed_at?: number | null;
  pin?: string | null;
}

export interface ParticipantRow {
  id: string;
  room_id: string;
  display_name: string;
  session_token: string;
  is_host: number;
  side: ParticipantSide;
  connection_status: ConnectionStatus;
  joined_at: number;
  socket_id?: string | null;
}

export interface PhotoRow {
  id: string;
  room_id: string;
  participant_id: string;
  side: ParticipantSide;
  slot_index: number;
  storage_key: string;
  filters_json: string;
  captured_at: number;
  kept_by_json: string;
}

export interface VoteRow {
  id: string;
  room_id: string;
  participant_id: string;
  frame_template_id: string;
  customization_json: string;
  voted_at: number;
}

export interface FinalRenderRow {
  id: string;
  room_id: string;
  frame_template_id: string;
  output_key: string;
  rendered_at: number;
}

export interface ParticipantPhoto {
  participantId: string;
  side: string;
  url: string;
  displayName?: string;
}

export interface PairedShot {
  slotIndex: number;
  leftPhotoUrl: string;
  rightPhotoUrl: string;
  keptByParticipantIds: string[];
  status: RoundStatus;
  photos?: ParticipantPhoto[];
}

// Socket.IO event payloads

// Client → Server
export interface JoinRoomPayload {
  roomId: string;
  displayName: string;
  sessionToken?: string;
}

export interface CaptureReadyPayload {
  roomId: string;
  slotIndex: number;
}

export interface CaptureFrameUploadPayload {
  roomId: string;
  slotIndex: number;
  photoDataUrl: string; // base64 data URL
  filters: string[];
}

export interface CaptureRetakePayload {
  roomId: string;
  slotIndex: number;
}

export interface CaptureKeepPayload {
  roomId: string;
  slotIndex: number;
}

export interface VoteCastPayload {
  roomId: string;
  frameTemplateId: string;
  customization: VoteCustomization;
}

export interface WebRTCSignalPayload {
  roomId: string;
  targetParticipantId: string;
  signal: unknown;
  fromParticipantId: string;
}


// Server → Client
export interface RoomStatePayload {
  room: Room;
  participants: Participant[];
  slots: PairedShot[];
  votes?: VoteStatus[];
  downloadUrlPng?: string;
  myParticipantId: string;
  sessionToken: string;
}

export interface CountdownStartedPayload {
  slotIndex: number;
  targetCaptureTimestamp: number; // server timestamp ms
}

export interface PairReadyPayload {
  slotIndex: number;
  leftPhotoUrl: string;
  rightPhotoUrl: string;
}

export interface KeepStatusPayload {
  slotIndex: number;
  confirmedParticipantIds: string[];
}

export interface RetakeRequestedPayload {
  slotIndex: number;
  requestedByParticipantId: string;
}

export interface VoteStatusPayload {
  votes: Array<{
    participantId: string;
    frameTemplateId: string;
    customization: VoteCustomization;
  }>;
}

export interface FrameLockedPayload {
  frameTemplateId: string;
  customization: VoteCustomization;
}

export interface RenderReadyPayload {
  downloadUrlPng: string;
  shareUrl: string;
}

export interface ParticipantConnectionChangedPayload {
  participantId: string;
  connectionStatus: ConnectionStatus;
}

export interface ErrorPayload {
  message: string;
  code: string;
}
