import { Router } from 'express';
import prisma from '../lib/prisma';

const router = Router();

// Все события (с выездом если есть)
router.get('/', async (req, res) => {
  const events = await prisma.event.findMany({
    include: { trip: { include: { members: { include: { user: { include: { family: true } } } } } } },
    orderBy: { date: 'asc' },
  });
  res.json(events);
});

// Одно событие
router.get('/:id', async (req, res) => {
  const event = await prisma.event.findUnique({
    where: { id: Number(req.params.id) },
    include: { trip: { include: { members: { include: { user: { include: { family: true } } } } } } },
  });
  if (!event) return res.status(404).json({ error: 'Событие не найдено' });
  res.json(event);
});

// Создать событие
router.post('/', async (req, res) => {
  const { sportType = 'FOOTBALL', opponent, date, city, venue, description } = req.body;
  if (!opponent || !date || !city) {
    return res.status(400).json({ error: 'opponent, date, city обязательны' });
  }
  const event = await prisma.event.create({
    data: { sportType, opponent, date: new Date(date), city, venue, description },
  });
  res.status(201).json(event);
});

// Обновить событие
router.patch('/:id', async (req, res) => {
  const { sportType, opponent, date, city, venue, description } = req.body;
  const event = await prisma.event.update({
    where: { id: Number(req.params.id) },
    data: {
      ...(sportType !== undefined && { sportType }),
      ...(opponent !== undefined && { opponent }),
      ...(date !== undefined && { date: new Date(date) }),
      ...(city !== undefined && { city }),
      ...(venue !== undefined && { venue }),
      ...(description !== undefined && { description }),
    },
  });
  res.json(event);
});

// Удалить событие
router.delete('/:id', async (req, res) => {
  await prisma.event.delete({ where: { id: Number(req.params.id) } });
  res.status(204).send();
});

export default router;
