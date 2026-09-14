import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { nanoid } from 'nanoid';
import knex from '../db';
import sharp from 'sharp';
import { detectCutoutBoxes, DetectedCutoutBox } from '../services/frameDetectorService';
import generatedFrames from '../services/generatedFrames.json';
import { FrameTemplate } from '../types';

const router = Router();

const UPLOADS_DIR = path.join(__dirname, '../../uploads');
const FRAMES_DIR = path.join(UPLOADS_DIR, 'frames');

// Ensure frames upload directory exists
if (!fs.existsSync(FRAMES_DIR)) {
  fs.mkdirSync(FRAMES_DIR, { recursive: true });
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB max
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('File harus berupa gambar (PNG direkomendasikan).'));
    }
  },
});

interface FrameDbRow {
  id: string;
  name: string;
  layout_type: string;
  description: string | null;
  accent_color: string;
  thumbnail_gradient: string;
  overlay_key: string | null;
  cutout_boxes_json: string | null;
  frame_width: number | null;
  frame_height: number | null;
  category: string | null;
  is_custom: number;
  created_at: number | null;
}

/**
 * GET /api/frames
 * Returns all built-in templates merged with shared custom templates from the database
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const customRows = await knex<FrameDbRow>('frame_templates')
      .where('is_custom', 1)
      .orderBy('created_at', 'desc');

    const customTemplates: FrameTemplate[] = customRows.map((row) => {
      let cutoutBoxes: DetectedCutoutBox[] = [];
      try {
        if (row.cutout_boxes_json) {
          cutoutBoxes = JSON.parse(row.cutout_boxes_json);
        }
      } catch (_) {
        cutoutBoxes = [];
      }

      const overlayUrl = row.overlay_key || undefined;
      const thumbUrl = overlayUrl ? overlayUrl.replace(/\.(png|webp)$/i, '_thumb.webp') : undefined;

      return {
        id: row.id,
        name: row.name,
        layoutType: row.layout_type,
        layout_type: row.layout_type,
        category: (row.category || 'custom') as '1x3' | '1x4' | '2x2' | '2x3' | 'custom',
        description: row.description || 'Frame kustom komunitas',
        accentColor: row.accent_color || '#ff5e97',
        accent_color: row.accent_color || '#ff5e97',
        thumbnailGradient: row.thumbnail_gradient || 'linear-gradient(135deg, #ff5e97, #8b5cf6)',
        thumbnail_gradient: row.thumbnail_gradient || 'linear-gradient(135deg, #ff5e97, #8b5cf6)',
        overlayUrl,
        overlay_url: overlayUrl,
        thumbnailUrl: thumbUrl,
        thumbnail_url: thumbUrl,
        frameWidth: row.frame_width || 1200,
        frameHeight: row.frame_height || 1800,
        cutoutBoxes,
        isCustom: true,
      };
    });

    const builtInTemplates: FrameTemplate[] = (generatedFrames as FrameTemplate[]).map((g) => ({
      ...g,
      layoutType: g.layoutType || g.layout_type || '1x4',
      accentColor: g.accentColor || g.accent_color || '#ff5e97',
      thumbnailGradient: g.thumbnailGradient || g.thumbnail_gradient || 'linear-gradient(135deg, #ff5e97, #8b5cf6)',
      overlayUrl: g.overlayUrl || g.overlay_url,
      thumbnailUrl: g.thumbnailUrl || g.thumbnail_url,
      thumbnail_url: g.thumbnail_url || g.thumbnailUrl,
    }));

    // Return custom frames first, followed by built-in frames
    res.json({
      frames: [...customTemplates, ...builtInTemplates],
      customCount: customTemplates.length,
      builtInCount: builtInTemplates.length,
    });
  } catch (err) {
    console.error('Error fetching frames:', err);
    res.status(500).json({ error: 'Gagal memuat template frame' });
  }
});

/**
 * POST /api/frames/upload
 * Upload a custom PNG frame, automatically detect cutout windows, and save as a shared asset
 */
router.post('/upload', upload.single('frame'), async (req: Request, res: Response) => {
  try {
    if (!req.file || !req.file.buffer) {
      res.status(400).json({ error: 'File gambar frame wajib diunggah' });
      return;
    }

    const frameBuffer = req.file.buffer;
    const rawName = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const frameName = rawName.slice(0, 40) || `Frame Kustom #${Math.floor(100 + Math.random() * 900)}`;
    const accentColor = typeof req.body?.accentColor === 'string' && req.body.accentColor.startsWith('#')
      ? req.body.accentColor
      : '#ff5e97';

    // Run automatic cutout hole detection
    const detection = await detectCutoutBoxes(frameBuffer);

    const frameId = `custom_${Date.now()}_${nanoid(6)}`;
    const fullWebpName = `${frameId}.webp`;
    const fullWebpPath = path.join(FRAMES_DIR, fullWebpName);
    const thumbFileName = `${frameId}_thumb.webp`;
    const thumbPath = path.join(FRAMES_DIR, thumbFileName);

    // 1. Convert uploaded frame to optimized full-resolution WebP (preserves 100% alpha transparency)
    await sharp(frameBuffer)
      .webp({ quality: 92, effort: 4 })
      .toFile(fullWebpPath);

    // 2. Generate lightweight WebP thumbnail for sub-second gallery preview (~9 KB)
    try {
      await sharp(frameBuffer)
        .resize({ height: 320, fit: 'inside' })
        .webp({ quality: 85, effort: 4 })
        .toFile(thumbPath);
    } catch (e) {
      console.warn('[Frames] Failed to generate custom frame thumbnail:', e);
    }

    const overlayUrl = `/uploads/frames/${fullWebpName}`;
    const thumbnailUrl = `/uploads/frames/${thumbFileName}`;

    // Store in SQLite frame_templates table as a shared asset
    const newDbRow: FrameDbRow = {
      id: frameId,
      name: frameName,
      layout_type: detection.layoutType,
      description: `Frame kustom komunitas (${detection.cutoutBoxes.length} slot foto)`,
      accent_color: accentColor,
      thumbnail_gradient: 'linear-gradient(135deg, #ff5e97, #8b5cf6)',
      overlay_key: overlayUrl,
      cutout_boxes_json: JSON.stringify(detection.cutoutBoxes),
      frame_width: detection.width,
      frame_height: detection.height,
      category: detection.category,
      is_custom: 1,
      created_at: Date.now(),
    };

    await knex('frame_templates').insert(newDbRow);

    const createdTemplate: FrameTemplate = {
      id: frameId,
      name: frameName,
      layoutType: detection.layoutType,
      layout_type: detection.layoutType,
      category: detection.category,
      description: newDbRow.description || 'Frame kustom komunitas',
      accentColor: accentColor,
      accent_color: accentColor,
      thumbnailGradient: newDbRow.thumbnail_gradient,
      thumbnail_gradient: newDbRow.thumbnail_gradient,
      overlayUrl,
      overlay_url: overlayUrl,
      thumbnailUrl,
      thumbnail_url: thumbnailUrl,
      frameWidth: detection.width,
      frameHeight: detection.height,
      cutoutBoxes: detection.cutoutBoxes,
      isCustom: true,
    };

    res.status(201).json({
      success: true,
      frame: createdTemplate,
      detection: {
        detectedHolesCount: detection.detectedHolesCount,
        hasAlphaCutouts: detection.hasAlphaCutouts,
        layoutType: detection.layoutType,
        category: detection.category,
      },
    });
  } catch (err) {
    console.error('Error uploading custom frame:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Gagal mengunggah frame kustom' });
  }
});

export default router;
