import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { nanoid } from 'nanoid';
import knex from '../db';
import { UPLOADS_DIR } from '../services/compositeService';
import { getSocketIO } from '../socket';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15 MB max
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('File harus berupa gambar (JPG, PNG, WebP).'));
    }
  },
});

interface BackgroundDbRow {
  id: string;
  name: string;
  storage_key: string;
  uploaded_by: string;
  uploaded_by_id: string | null;
  created_at: number;
}

/**
 * GET /api/backgrounds
 * Returns all public community custom backgrounds
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const host = req.get('host') || 'localhost:3001';
    const protocol = req.protocol || 'http';
    const baseUrl = `${protocol}://${host}`;

    const rows = await knex<BackgroundDbRow>('custom_backgrounds')
      .orderBy('created_at', 'desc')
      .limit(100);

    const backgrounds = rows.map((r) => ({
      id: r.id,
      name: r.name,
      url: `${baseUrl}/uploads/${r.storage_key}`,
      storageKey: r.storage_key,
      uploadedBy: r.uploaded_by,
      uploadedById: r.uploaded_by_id,
      createdAt: r.created_at,
    }));

    res.json({ success: true, backgrounds });
  } catch (err) {
    console.error('Error fetching global custom backgrounds:', err);
    res.status(500).json({ error: 'Gagal mengambil background publik.' });
  }
});

/**
 * POST /api/backgrounds
 * Upload a public custom background (shared for all rooms and all users)
 */
router.post('/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const file = req.file;
    const displayName = (req.body.uploadedBy as string) || 'Pengguna';
    const participantId = (req.body.participantId as string) || null;
    const customName = (req.body.name as string) || file?.originalname?.replace(/\.[^/.]+$/, '') || 'Custom Background';

    if (!file) {
      return res.status(400).json({ error: 'File gambar diperlukan.' });
    }

    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const storageKey = `bg_global_${nanoid(10)}${ext}`;
    const filePath = path.join(UPLOADS_DIR, storageKey);

    await fs.promises.writeFile(filePath, file.buffer);

    const bgId = `bg_${nanoid(12)}`;
    const now = Date.now();

    await knex<BackgroundDbRow>('custom_backgrounds').insert({
      id: bgId,
      name: customName,
      storage_key: storageKey,
      uploaded_by: displayName,
      uploaded_by_id: participantId,
      created_at: now,
    });

    const host = req.get('host') || 'localhost:3001';
    const protocol = req.protocol || 'http';
    const baseUrl = `${protocol}://${host}`;

    const newBg = {
      id: bgId,
      name: customName,
      url: `${baseUrl}/uploads/${storageKey}`,
      storageKey,
      uploadedBy: displayName,
      uploadedById: participantId,
      createdAt: now,
    };

    // Broadcast to ALL sockets across all rooms
    try {
      const io = getSocketIO();
      if (io) {
        io.emit('capture:globalBackgroundAdded', { background: newBg });
        const allRows = await knex<BackgroundDbRow>('custom_backgrounds')
          .orderBy('created_at', 'desc')
          .limit(100);
        const allBgs = allRows.map((r) => ({
          id: r.id,
          name: r.name,
          url: `${baseUrl}/uploads/${r.storage_key}`,
          uploadedBy: r.uploaded_by,
          uploadedById: r.uploaded_by_id || '',
          uploadedAt: r.created_at,
        }));
        io.emit('capture:backgroundsUpdated', { backgrounds: allBgs });
      }
    } catch (_) {
      // Non-blocking
    }

    res.json({ success: true, background: newBg });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Upload gagal.';
    res.status(500).json({ error: message });
  }
});

/**
 * DELETE /api/backgrounds/:id
 * Delete a custom background
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const row = await knex<BackgroundDbRow>('custom_backgrounds').where('id', id).first();
    if (!row) {
      return res.status(404).json({ error: 'Background tidak ditemukan.' });
    }

    // Delete file from disk
    const filePath = path.join(UPLOADS_DIR, row.storage_key);
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath).catch(() => {});
    }

    await knex('custom_backgrounds').where('id', id).del();

    const host = req.get('host') || 'localhost:3001';
    const protocol = req.protocol || 'http';
    const baseUrl = `${protocol}://${host}`;

    // Broadcast deletion to all sockets
    try {
      const io = getSocketIO();
      if (io) {
        io.emit('capture:globalBackgroundRemoved', { bgId: id });
        const allRows = await knex<BackgroundDbRow>('custom_backgrounds')
          .orderBy('created_at', 'desc')
          .limit(100);
        const allBgs = allRows.map((r) => ({
          id: r.id,
          name: r.name,
          url: `${baseUrl}/uploads/${r.storage_key}`,
          uploadedBy: r.uploaded_by,
          uploadedById: r.uploaded_by_id || '',
          uploadedAt: r.created_at,
        }));
        io.emit('capture:backgroundsUpdated', { backgrounds: allBgs });
      }
    } catch (_) {
      // Non-blocking
    }

    res.json({ success: true, message: 'Background berhasil dihapus.' });
  } catch (err) {
    console.error('Error deleting background:', err);
    res.status(500).json({ error: 'Gagal menghapus background.' });
  }
});

export default router;
