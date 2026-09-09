import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import fs from 'fs';

import { initDb } from './db';
import { setupSocketIO } from './socket';
import roomsRouter from './routes/rooms';
import { cleanupExpiredRooms } from './services/roomService';
import { UPLOADS_DIR, RENDERS_DIR } from './services/compositeService';

const PORT = parseInt(process.env.PORT || '3001', 10);
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';
const SERVER_URL = process.env.SERVER_URL || `http://localhost:${PORT}`;

const app = express();
const httpServer = http.createServer(app);

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true }));

[UPLOADS_DIR, RENDERS_DIR].forEach((dir) => { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); });

app.use('/uploads', express.static(UPLOADS_DIR));
app.use('/renders', express.static(RENDERS_DIR));
app.use('/api/rooms', roomsRouter);
app.get('/health', (_req, res) => res.json({ status: 'ok', ts: Date.now() }));

const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'], credentials: true },
  maxHttpBufferSize: 20e6,
});

app.set('io', io);

setupSocketIO(io, SERVER_URL);


setInterval(async () => {
  const cleaned = await cleanupExpiredRooms();
  if (cleaned > 0) console.log(`[Cleanup] Marked ${cleaned} room(s) as expired`);
}, 10 * 60 * 1000);

async function main() {
  await initDb();
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🎞️  Synced Photobooth Server`);
    console.log(`   HTTP  → http://0.0.0.0:${PORT}`);
    console.log(`   WS    → ws://0.0.0.0:${PORT}\n`);
  });
}

main().catch(console.error);


export default app;
