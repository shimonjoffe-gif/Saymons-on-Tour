import { Router } from 'express';
import prisma from '../lib/prisma';

const router = Router();

// Получить выезд по ID с участниками и расходами
router.get('/:id', async (req, res) => {
  const trip = await prisma.trip.findUnique({
    where: { id: Number(req.params.id) },
    include: {
      event: true,
      members: { include: { user: { include: { family: true } } } },
      expenses: {
        include: {
          payer: { include: { family: true } },
          splits: { include: { user: { include: { family: true } } } },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  });
  if (!trip) return res.status(404).json({ error: 'Выезд не найден' });
  res.json(trip);
});

// Создать выезд для события
router.post('/', async (req, res) => {
  const { eventId } = req.body;
  if (!eventId) return res.status(400).json({ error: 'eventId обязателен' });
  const trip = await prisma.trip.create({
    data: { eventId: Number(eventId) },
    include: { event: true },
  });
  res.status(201).json(trip);
});

// Добавить участника в выезд
router.post('/:id/members', async (req, res) => {
  const tripId = Number(req.params.id);
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId обязателен' });

  const member = await prisma.tripMember.create({
    data: { tripId, userId: Number(userId) },
    include: { user: { include: { family: true } } },
  });
  res.status(201).json(member);
});

// Обновить участника выезда (attendedMatch)
router.patch('/:id/members/:userId', async (req, res) => {
  const tripId = Number(req.params.id);
  const userId = Number(req.params.userId);
  const { attendedMatch } = req.body;
  const member = await prisma.tripMember.updateMany({
    where: { tripId, userId },
    data: { attendedMatch },
  });
  res.json(member);
});

// Убрать участника из выезда
router.delete('/:id/members/:userId', async (req, res) => {
  const tripId = Number(req.params.id);
  const userId = Number(req.params.userId);
  await prisma.tripMember.deleteMany({ where: { tripId, userId } });
  res.status(204).send();
});

export default router;
