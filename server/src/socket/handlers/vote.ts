
import { Server } from 'socket.io';
import * as roomService from '../../services/roomService';
import { broadcastRoomState } from './room';
import { AppSocket, VoteRow, VoteCustomization } from '../../types';

export function handleVoteEvents(io: Server, socket: AppSocket, baseUrl: string): void {
  const castVote = async (payload: { roomId: string; frameTemplateId: string; customization: VoteCustomization }) => {
    const { roomId, frameTemplateId, customization } = payload;
    const participantId = socket.participantId;
    if (!participantId) return;

    const room = await roomService.getRoomById(roomId);
    if (!room || room.status !== 'frame_selection') return;

    await roomService.upsertVote(roomId, participantId, frameTemplateId, customization);

    const votes = await roomService.getVotes(roomId);
    io.to(roomId).emit('frame:voteStatus', {
      votes: votes.map((v: VoteRow) => ({
        participantId: v.participant_id,
        frameTemplateId: v.frame_template_id,
        customization: JSON.parse(v.customization_json || '{}'),
      })),
    });

    const unanimousTemplateId = await roomService.checkUnanimousVote(roomId);
    if (unanimousTemplateId) {
      const template = await roomService.getFrameTemplateById(unanimousTemplateId);
      if (!template) return;
      const lastVote = votes.find((v: VoteRow) => v.frame_template_id === unanimousTemplateId);
      const customizationData: VoteCustomization = lastVote ? JSON.parse(lastVote.customization_json || '{}') : {};

      // Save chosen template & customization in room settings
      const currentSettings = await roomService.getRoomSettings(roomId);
      await roomService.updateRoomSettings(roomId, {
        ...currentSettings,
        selectedFrameTemplateId: unanimousTemplateId,
        customization: customizationData,
      });

      io.to(roomId).emit('frame:locked', { frameTemplateId: unanimousTemplateId, customization: customizationData });
      await roomService.updateRoomStatus(roomId, 'photo_selection');
      await broadcastRoomState(io, roomId, baseUrl);
    }
  };

  socket.on('vote:cast', castVote);
  socket.on('vote:change', castVote);

  // Return to frame selection if users want to change frame
  socket.on('frame:changeTemplate', async (payload: { roomId: string }) => {
    const { roomId } = payload;
    const participantId = socket.participantId;
    if (!participantId) return;

    const room = await roomService.getRoomById(roomId);
    if (!room) return;

    await roomService.clearVotes(roomId);
    io.to(roomId).emit('frame:voteStatus', { votes: [] });
    await roomService.updateRoomStatus(roomId, 'frame_selection');
    await broadcastRoomState(io, roomId, baseUrl);
  });

  // WebRTC signaling relay
  socket.on('webrtc:signal', (payload: { roomId: string; signal: unknown; fromParticipantId: string; targetParticipantId?: string }) => {
    socket.to(payload.roomId).emit('webrtc:signal', {
      signal: payload.signal,
      fromParticipantId: payload.fromParticipantId,
      targetParticipantId: payload.targetParticipantId,
    });
  });
}
