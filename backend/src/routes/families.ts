import { Router } from 'express';
import prisma from '../lib/prisma';

const router = Router();

// Получить все семьи с участниками
router.get('/', async (req, res) => {
  const families = await prisma.family.findMany({
    include: { members: true },
    orderBy: { name: 'asc' },
  });
  res.json(families);
});

// Создать семью
router.post('/', async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'name обязателен' });
  const family = await prisma.family.create({ data: { name } });
  res.status(201).json(family);
});

// Переименовать семью
router.patch('/:id', async (req, res) => {
  const { name } = req.body;
  const family = await prisma.family.update({ where: { id: Number(req.params.id) }, data: { name } });
  res.json(family);
});

// Удалить семью
router.delete('/:id', async (req, res) => {
  await prisma.family.delete({ where: { id: Number(req.params.id) } });
  res.status(204).send();
});

export default router;
