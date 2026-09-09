import { Server } from 'socket.io';
import * as roomService from '../../services/roomService';
import { compositePhotos } from '../../services/compositeService';
import { broadcastRoomState } from './room';
import { AppSocket, PhotoCropOffset, FrameTemplate } from '../../types';

const DEFAULT_TEMPLATE_ID = 'frame_1x4_01';
const DEFAULT_ACCENT_COLOR = '#ff5e97';

/** In-memory photo selection state per room */
const selectionMap = new Map<string, string[]>(); // roomId → assigned photoIds (in slot order)
const offsetMap = new Map<string, Record<string | number, PhotoCropOffset>>(); // roomId → { [slotIdx]: PhotoCropOffset }
const confirmMap = new Map<string, Set<string>>(); // roomId → Set<participantId>

export function handlePhotoSelectionEvents(io: Server, socket: AppSocket, baseUrl: string): void {

  // Get current state (called on mount by client)
  socket.on('photoSelection:getState', async ({ roomId }: { roomId: string }) => {
    const currentOrder = selectionMap.get(roomId) ?? [];
    const currentOffsets = offsetMap.get(roomId) ?? {};
    const confirmed = confirmMap.get(roomId) ?? new Set();
    socket.emit('photoSelection:update', { selectedOrder: currentOrder, photoOffsets: currentOffsets });
    socket.emit('photoSelection:confirmStatus', { confirmedParticipantIds: [...confirmed] });
  });

  // Participant updates the selection order and/or photo crop offsets
  socket.on('photoSelection:update', async ({ roomId, selectedOrder, photoOffsets }: { roomId: string; selectedOrder?: string[]; photoOffsets?: Record<string | number, PhotoCropOffset> }) => {
    const participantId = socket.participantId;
    if (!participantId) return;

    const room = await roomService.getRoomById(roomId);
    if (!room || room.status !== 'photo_selection') return;

    if (selectedOrder) {
      selectionMap.set(roomId, selectedOrder);
    }
    if (photoOffsets) {
      offsetMap.set(roomId, photoOffsets);
    }

    const currentOrder = selectionMap.get(roomId) ?? [];
    const currentOffsets = offsetMap.get(roomId) ?? {};

    // Broadcast to everyone in room (including sender)
    io.to(roomId).emit('photoSelection:update', { selectedOrder: currentOrder, photoOffsets: currentOffsets });
  });

  // Reset confirmations when selection changes
  socket.on('photoSelection:resetConfirm', async ({ roomId }: { roomId: string }) => {
    const participantId = socket.participantId;
    if (!participantId) return;
    confirmMap.set(roomId, new Set());
    io.to(roomId).emit('photoSelection:confirmStatus', { confirmedParticipantIds: [] });
  });

  // Participant confirms their selection
  socket.on('photoSelection:confirm', async ({ roomId }: { roomId: string }) => {
    const participantId = socket.participantId;
    if (!participantId) return;

    const room = await roomService.getRoomById(roomId);
    if (!room || room.status !== 'photo_selection') return;

    if (!confirmMap.has(roomId)) confirmMap.set(roomId, new Set());
    confirmMap.get(roomId)!.add(participantId);

    const confirmed = [...confirmMap.get(roomId)!];
    io.to(roomId).emit('photoSelection:confirmStatus', { confirmedParticipantIds: confirmed });

    // Both confirmed → persist selected order into room settings and start rendering
    const participants = await roomService.getParticipants(roomId);
    if (participants.every((p) => confirmed.includes(p.id))) {
      const selectedOrder = selectionMap.get(roomId) ?? [];
      const currentOffsets = offsetMap.get(roomId) ?? {};

      // Persist selected photo order & offsets in room settings_json
      const currentSettings = await roomService.getRoomSettings(roomId);
      await roomService.updateRoomSettings(roomId, {
        ...currentSettings,
        selectedPhotoOrder: selectedOrder,
        photoOffsets: currentOffsets,
      });

      confirmMap.delete(roomId);
      selectionMap.delete(roomId);
      offsetMap.delete(roomId);

      await roomService.updateRoomStatus(roomId, 'rendering');
      await broadcastRoomState(io, roomId, baseUrl);

      const selectedTemplateId = currentSettings.selectedFrameTemplateId || room.settings.selectedFrameTemplateId || room.settings.layout || DEFAULT_TEMPLATE_ID;
      const template = await roomService.getFrameTemplateById(selectedTemplateId);

      const customizationData = currentSettings.customization || {};
      const accentColor = customizationData.accentColor || template?.accentColor || template?.accent_color || DEFAULT_ACCENT_COLOR;
      const captionText = customizationData.captionText || '';

      const mappedTemplate: FrameTemplate = template ? {
        id: template.id,
        name: template.name,
        layoutType: template.layoutType || template.layout_type || '1x4',
        layout_type: template.layout_type || template.layoutType,
        category: template.category,
        description: template.description,
        accentColor: template.accentColor || template.accent_color || DEFAULT_ACCENT_COLOR,
        accent_color: template.accent_color || template.accentColor,
        thumbnailGradient: template.thumbnailGradient || template.thumbnail_gradient || '',
        thumbnail_gradient: template.thumbnail_gradient || template.thumbnailGradient,
        overlayUrl: template.overlayUrl || template.overlay_url,
        overlay_url: template.overlay_url || template.overlayUrl,
        frameWidth: template.frameWidth,
        frameHeight: template.frameHeight,
        cutoutBoxes: template.cutoutBoxes,
      } : {
        id: selectedTemplateId,
        name: selectedTemplateId,
        layoutType: '1x4',
        layout_type: '1x4',
        category: '1x4',
        description: '',
        accentColor: DEFAULT_ACCENT_COLOR,
        accent_color: DEFAULT_ACCENT_COLOR,
        thumbnailGradient: '',
        thumbnail_gradient: '',
      };

      try {
        const isSolo = room.capacity === 1 || room.settings?.mode === 'solo';
        const allPhotos = await roomService.getAllPhotosForRoom(roomId);
        const outputKey = await compositePhotos(
          roomId,
          allPhotos,
          mappedTemplate,
          captionText,
          accentColor,
          selectedOrder.map((s) => String(s)),
          currentOffsets,
          isSolo,
        );

        await roomService.saveRender(roomId, selectedTemplateId, outputKey);
        await roomService.updateRoomStatus(roomId, 'completed');

        io.to(roomId).emit('render:ready', {
          downloadUrlPng: `${baseUrl}/renders/${outputKey}`,
          shareUrl: `${baseUrl.replace(':3001', ':3000')}/room/${room.code}`,
        });
        await broadcastRoomState(io, roomId, baseUrl);
      } catch (err) {
        console.error('Compositing error during photoSelection finish:', err);
        socket.emit('error', { message: 'Failed to render final image', code: 'RENDER_ERROR' });
      }
    }
  });
}
