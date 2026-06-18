import { Router } from 'express';
import prisma from '../lib/prisma';

const router = Router();

// Статистика выездов по участникам
router.get('/trips', async (req, res) => {
  const members = await prisma.tripMember.findMany({
    where: { attendedMatch: true },
    include: {
      user: { include: { family: true } },
      trip: { include: { event: true } },
    },
    orderBy: { trip: { event: { date: 'asc' } } },
  });

  // Группируем по пользователю
  const map: Record<number, {
    userId: number;
    firstName: string;
    familyName: string;
    trips: { tripId: number; opponent: string; date: string; city: string }[];
  }> = {};

  for (const m of members) {
    if (!map[m.userId]) {
      map[m.userId] = {
        userId: m.userId,
        firstName: m.user.firstName,
        familyName: m.user.family.name,
        trips: [],
      };
    }
    map[m.userId].trips.push({
      tripId: m.tripId,
      opponent: m.trip.event.opponent,
      date: m.trip.event.date.toISOString(),
      city: m.trip.event.city,
    });
  }

  const result = Object.values(map).sort((a, b) => b.trips.length - a.trips.length);
  res.json(result);
});

export default router;
