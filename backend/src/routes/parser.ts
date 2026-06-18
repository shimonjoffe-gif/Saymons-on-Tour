import { Router } from 'express';
import prisma from '../lib/prisma';
import { runParser } from '../services/scheduler';

const router = Router();

// ── Sources CRUD ──────────────────────────────────────────────

// GET /api/parser/sources
router.get('/parser/sources', async (_req, res) => {
  const sources = await prisma.parserSource.findMany({ orderBy: { createdAt: 'asc' } });
  // Attach last run state
  const states = await prisma.parserState.findMany();
  const stateMap = new Map(states.map(s => [s.source, s]));

  const result = sources.map(src => {
    const key = src.type === 'telegram' ? `tg:${src.identifier}` : `web:${src.identifier}`;
    const state = stateMap.get(key);
    return { ...src, state: state ?? null };
  });

  res.json(result);
});

// POST /api/parser/sources — add new source
router.post('/parser/sources', async (req, res) => {
  const { type, identifier, label } = req.body as {
    type?: string;
    identifier?: string;
    label?: string;
  };

  if (!type || !identifier || !label) {
    return res.status(400).json({ error: 'type, identifier, label обязательны' });
  }
  if (type !== 'telegram' && type !== 'website') {
    return res.status(400).json({ error: 'type должен быть telegram или website' });
  }

  // Normalize TG identifier: strip @ and t.me prefix
  let normalizedId = identifier.trim();
  if (type === 'telegram') {
    normalizedId = normalizedId
      .replace(/^https?:\/\/t\.me\/s?\//i, '')
      .replace(/^@/, '')
      .split('/')[0]
      .trim();
  } else {
    // Ensure https:// prefix for websites
    if (!/^https?:\/\//i.test(normalizedId)) {
      normalizedId = 'https://' + normalizedId;
    }
  }

  try {
    const source = await prisma.parserSource.create({
      data: { type, identifier: normalizedId, label: label.trim() },
    });
    res.status(201).json(source);
  } catch {
    res.status(409).json({ error: 'Источник с таким идентификатором уже существует' });
  }
});

// PATCH /api/parser/sources/:id — toggle enabled / update label
router.patch('/parser/sources/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
  const { enabled, label } = req.body as { enabled?: boolean; label?: string };
  const data: Record<string, unknown> = {};
  if (typeof enabled === 'boolean') data.enabled = enabled;
  if (typeof label === 'string') data.label = label.trim();
  const source = await prisma.parserSource.update({ where: { id }, data });
  res.json(source);
});

// DELETE /api/parser/sources/:id
router.delete('/parser/sources/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
  await prisma.parserSource.delete({ where: { id } });
  res.status(204).send();
});

// ── Parser control ────────────────────────────────────────────

// GET /api/parser/status
router.get('/parser/status', async (_req, res) => {
  const states = await prisma.parserState.findMany({ orderBy: { source: 'asc' } });
  res.json(states);
});

// POST /api/parser/run
router.post('/parser/run', async (_req, res) => {
  try {
    await runParser();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ── Notifications ─────────────────────────────────────────────

// GET /api/notifications
router.get('/notifications', async (_req, res) => {
  const notifications = await prisma.notification.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  res.json(notifications);
});

// GET /api/notifications/unread-count
router.get('/notifications/unread-count', async (_req, res) => {
  const count = await prisma.notification.count({ where: { read: false } });
  res.json({ count });
});

// PATCH /api/notifications/:id/read
router.patch('/notifications/:id/read', async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
  await prisma.notification.update({ where: { id }, data: { read: true } });
  res.json({ success: true });
});

// PATCH /api/notifications/read-all
router.patch('/notifications/read-all', async (_req, res) => {
  await prisma.notification.updateMany({ where: { read: false }, data: { read: true } });
  res.json({ success: true });
});

export default router;
