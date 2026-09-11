import { Router } from 'express';
import os from 'os';
import * as roomService from '../services/roomService';
import qrcode from 'qrcode';

const router = Router();

router.get('/info/local-ip', (_req, res) => {
  const interfaces = os.networkInterfaces();
  let localIp = 'localhost';
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        localIp = iface.address;
        break;
      }
    }
    if (localIp !== 'localhost') break;
  }
  res.json({ ip: localIp });
});


router.post('/', async (req, res) => {
  try {
    const { shotCount, countdownSeconds, layout, mode, pin } = req.body ?? {};
    const room = await roomService.createRoom(
      {
        shotCount: shotCount ?? (mode === 'solo' ? 4 : 3),
        countdownSeconds: countdownSeconds ?? 3,
        layout: layout ?? 'strip4',
        mode: mode ?? 'duo',
      },
      pin,
    );
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
    const joinUrl = `${clientUrl}/room/${room.code}`;
    const qrDataUrl = await qrcode.toDataURL(joinUrl, { width: 200, margin: 1 });
    res.json({
      room: { ...room, hasPin: Boolean(room.pin), pin: undefined },
      joinUrl,
      qrDataUrl,
    });
  } catch (err: unknown) {
    console.error('POST /rooms error:', err);
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to create room' });
  }
});

router.get('/:code', async (req, res) => {
  const room = await roomService.getRoomByCode(req.params.code.toUpperCase());
  if (!room) return res.status(404).json({ error: 'Room not found' });
  const participants = await roomService.getParticipants(room.id);
  const baseUrl = process.env.SERVER_URL || 'http://localhost:3001';
  const slots = await roomService.getPairedShots(room.id, baseUrl);
  res.json({
    room: { ...room, hasPin: Boolean(room.pin), pin: undefined },
    participants,
    slots,
  });
});

router.post('/:code/start', async (req, res) => {
  const room = await roomService.getRoomByCode(req.params.code.toUpperCase());
  if (!room) return res.status(404).json({ error: 'Room not found' });
  await roomService.updateRoomStatus(room.id, 'capturing');
  await roomService.updateRoomRound(room.id, 0, 'waiting_ready');
  
  const io = req.app.get('io');
  const baseUrl = process.env.SERVER_URL || 'http://localhost:3001';
  if (io) {
    const updatedRoom = await roomService.getRoomById(room.id);
    const participants = await roomService.getParticipants(room.id);
    const slots = await roomService.getPairedShots(room.id, baseUrl);
    io.to(room.id).emit('room:state', { room: updatedRoom, participants, slots, myParticipantId: '', sessionToken: '' });
  }

  res.json({ room: await roomService.getRoomById(room.id) });
});



router.get('/:code/frames', async (_req, res) => {
  const templates = await roomService.getFrameTemplates();
  res.json({ templates });
});

router.get('/:code/render', async (req, res) => {
  const room = await roomService.getRoomByCode(req.params.code.toUpperCase());
  if (!room) return res.status(404).json({ error: 'Room not found' });
  const render = await roomService.getRender(room.id);
  if (!render) return res.status(404).json({ error: 'No render found' });
  const baseUrl = process.env.SERVER_URL || 'http://localhost:3001';
  res.json({ downloadUrlPng: `${baseUrl}/renders/${render.output_key}` });
});

export default router;
