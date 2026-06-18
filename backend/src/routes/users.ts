import { Router } from 'express';
import prisma from '../lib/prisma';

const router = Router();

router.get('/', async (req, res) => {
  const users = await prisma.user.findMany({
    include: { family: true },
    orderBy: [{ family: { name: 'asc' } }, { firstName: 'asc' }],
  });
  res.json(users);
});

router.post('/', async (req, res) => {
  const { firstName, memberType = 'ADULT', familyId } = req.body;
  if (!firstName || !familyId) {
    return res.status(400).json({ error: 'firstName и familyId обязательны' });
  }
  const user = await prisma.user.create({
    data: { firstName, memberType, familyId: Number(familyId) },
    include: { family: true },
  });
  res.status(201).json(user);
});

router.patch('/:id', async (req, res) => {
  const { firstName, memberType, familyId } = req.body;
  const user = await prisma.user.update({
    where: { id: Number(req.params.id) },
    data: {
      ...(firstName !== undefined && { firstName }),
      ...(memberType !== undefined && { memberType }),
      ...(familyId !== undefined && { familyId: Number(familyId) }),
    },
    include: { family: true },
  });
  res.json(user);
});

router.delete('/:id', async (req, res) => {
  await prisma.user.delete({ where: { id: Number(req.params.id) } });
  res.status(204).send();
});

export default router;
