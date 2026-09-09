import { Server } from 'socket.io';
import { handleRoomJoin, handleDisconnect } from './handlers/room';
import { handleCaptureEvents } from './handlers/capture';
import { handlePhotoSelectionEvents } from './handlers/photoSelection';
import { handleVoteEvents } from './handlers/vote';

export function setupSocketIO(io: Server, baseUrl: string): void {
  io.on('connection', (socket) => {
    console.log(`[WS] Client connected: ${socket.id}`);

    handleRoomJoin(io, socket, baseUrl);
    handleCaptureEvents(io, socket, baseUrl);
    handlePhotoSelectionEvents(io, socket, baseUrl);
    handleVoteEvents(io, socket, baseUrl);
    handleDisconnect(io, socket, baseUrl);

    socket.on('error', (err) => {
      console.error(`[WS] Socket error ${socket.id}:`, err);
    });
  });
}

