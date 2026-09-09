import { Server } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import * as roomService from '../../services/roomService';
import { AppSocket, VoteRow, VoteStatus } from '../../types';

function mapVotes(votes: VoteRow[]): VoteStatus[] {
  return votes.map((v) => ({
    participantId: v.participant_id,
    frameTemplateId: v.frame_template_id,
    customization: JSON.parse(v.customization_json || '{}'),
  }));
}

export async function broadcastRoomState(io: Server, roomId: string, baseUrl: string): Promise<void> {
  const room = await roomService.getRoomById(roomId);
  if (!room) return;
  const participants = await roomService.getParticipants(roomId);
  const slots = await roomService.getPairedShots(roomId, baseUrl);
  const votes = await roomService.getVotes(roomId);
  const render = await roomService.getRender(roomId);

  const votesMapped = mapVotes(votes);
  const downloadUrlPng = render ? `${baseUrl}/renders/${render.output_key}` : '';

  io.to(roomId).emit('room:state', {
    room,
    participants,
    slots,
    votes: votesMapped,
    downloadUrlPng,
    myParticipantId: '',
    sessionToken: '',
  });
}

export function handleRoomJoin(io: Server, socket: AppSocket, baseUrl: string): void {
  socket.on('room:join', async (payload: { roomCode: string; displayName: string; sessionToken?: string }) => {
    try {
      const { roomCode, displayName, sessionToken: existingToken } = payload;
      const room = await roomService.getRoomByCode(roomCode);
      if (!room) { socket.emit('error', { message: 'Room not found or expired', code: 'ROOM_NOT_FOUND' }); return; }

      let participant = existingToken ? await roomService.getParticipantByToken(existingToken) : null;
      let newToken: string;

      if (participant && participant.roomId === room.id) {
        newToken = existingToken!;
        await roomService.updateParticipantConnection(participant.id, 'connected', socket.id);
        io.to(room.id).emit('participant:connectionChanged', { participantId: participant.id, connectionStatus: 'connected' });
      } else {
        const participants = await roomService.getParticipants(room.id);
        if (participants.length >= room.capacity) { socket.emit('error', { message: 'Room is full', code: 'ROOM_FULL' }); return; }
        newToken = uuidv4();
        const isHost = participants.length === 0;
        participant = await roomService.addParticipant(room.id, displayName, newToken, isHost);
        await roomService.updateParticipantConnection(participant.id, 'connected', socket.id);
      }

      socket.join(room.id);
      socket.participantId = participant.id;
      socket.roomId = room.id;

      const updatedRoom = await roomService.getRoomById(room.id);
      const allParticipants = await roomService.getParticipants(room.id);
      const slots = await roomService.getPairedShots(room.id, baseUrl);
      const votes = await roomService.getVotes(room.id);
      const render = await roomService.getRender(room.id);

      const votesMapped = mapVotes(votes);
      const downloadUrlPng = render ? `${baseUrl}/renders/${render.output_key}` : '';

      // Send personalized state to this socket
      socket.emit('room:state', {
        room: updatedRoom,
        participants: allParticipants,
        slots,
        votes: votesMapped,
        downloadUrlPng,
        myParticipantId: participant.id,
        sessionToken: newToken,
      });

      // Broadcast to other participants
      socket.to(room.id).emit('room:state', {
        room: updatedRoom,
        participants: allParticipants,
        slots,
        votes: votesMapped,
        downloadUrlPng,
        myParticipantId: '',
        sessionToken: '',
      });
    } catch (err) {
      console.error('room:join error:', err);
      socket.emit('error', { message: 'Failed to join room', code: 'JOIN_ERROR' });
    }
  });

  // Host starts the photobooth session
  socket.on('room:start', async ({ roomId }: { roomId: string }) => {
    try {
      const room = await roomService.getRoomById(roomId);
      if (!room) return;

      await roomService.updateRoomStatus(room.id, 'capturing');
      await roomService.updateRoomRound(room.id, 0, 'waiting_ready');
      await broadcastRoomState(io, room.id, baseUrl);
    } catch (err) {
      console.error('room:start error:', err);
    }
  });
}

export function handleDisconnect(io: Server, socket: AppSocket, baseUrl: string): void {
  socket.on('disconnect', async () => {
    const participantId = socket.participantId;
    const roomId = socket.roomId;
    if (!participantId || !roomId) return;
    await roomService.updateParticipantConnection(participantId, 'disconnected');
    io.to(roomId).emit('participant:connectionChanged', { participantId, connectionStatus: 'disconnected' });
    await broadcastRoomState(io, roomId, baseUrl);
  });
}
