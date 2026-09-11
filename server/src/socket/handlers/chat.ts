import { Server } from 'socket.io';
import { AppSocket } from '../../types';
import * as roomService from '../../services/roomService';

export interface ChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
}

// In-memory chat history per room (keeps the last 50 messages per room)
const roomChatHistory = new Map<string, ChatMessage[]>();

export function getRoomChatHistory(roomId: string): ChatMessage[] {
  return roomChatHistory.get(roomId) || [];
}

export function clearRoomChatHistory(roomId: string): void {
  roomChatHistory.delete(roomId);
}

export function handleChatEvents(io: Server, socket: AppSocket): void {
  // Client requests chat history upon connecting or opening chat
  socket.on('chat:getHistory', async ({ roomId }: { roomId: string }) => {
    if (!roomId) return;
    const history = getRoomChatHistory(roomId);
    socket.emit('chat:history', { history });
  });

  // Client sends a new message
  socket.on('chat:send', async ({ roomId, text }: { roomId: string; text: string }) => {
    try {
      if (!roomId || !text || typeof text !== 'string') return;

      const trimmed = text.trim().slice(0, 300); // Limit to 300 characters
      if (!trimmed) return;

      const participantId = socket.participantId;
      if (!participantId) return;

      const participant = await roomService.getParticipantById(participantId);
      const senderName = participant?.displayName || 'Tamu';

      const message: ChatMessage = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        roomId,
        senderId: participantId,
        senderName,
        text: trimmed,
        timestamp: Date.now(),
      };

      // Store in room history (max 50)
      const current = roomChatHistory.get(roomId) || [];
      current.push(message);
      if (current.length > 50) current.shift();
      roomChatHistory.set(roomId, current);

      // Broadcast to all participants in the room
      io.to(roomId).emit('chat:message', message);
    } catch (err) {
      console.error('[Chat] Error sending message:', err);
    }
  });
}
