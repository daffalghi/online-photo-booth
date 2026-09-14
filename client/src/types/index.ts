// Shared types - mirrors server/src/types/index.ts

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

export interface RoomSettings {
  shotCount: number;
  countdownSeconds: number;
  layout: 'strip3' | 'strip4' | 'grid2x2' | 'single' | string;
  mode?: 'solo' | 'duo' | 'group';
  selectedPhotoOrder?: (number | string)[];
  photoOffsets?: Record<number | string, { x?: number; y?: number; scale?: number }>;
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
  hasPin?: boolean;
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

export interface CutoutBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PhotoCropOffset {
  x?: number;
  y?: number;
  scale?: number;
}

export interface FrameTemplate {
  id: string;
  name: string;
  layout_type: string;
  layoutType?: string;
  description: string;
  accent_color: string;
  accentColor?: string;
  thumbnail_gradient: string;
  thumbnailGradient?: string;
  overlay_url?: string;
  overlayUrl?: string;
  thumbnail_url?: string;
  thumbnailUrl?: string;
  category?: string;
  frameWidth?: number;
  frameHeight?: number;
  cutoutBoxes?: CutoutBox[];
  isCustom?: boolean;
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

// Socket event payload types

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
  targetCaptureTimestamp: number;
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
  votes: VoteStatus[];
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
