import { Router } from 'express';
import prisma from '../lib/prisma';

const router = Router();

// Вес по умолчанию в зависимости от типа участника и категории
function defaultWeight(memberType: string, category: string): number {
  if (memberType === 'INFANT') return 0;
  if (category === 'ALCOHOL') return memberType === 'ADULT' ? 1.0 : 0;
  return memberType === 'CHILD' ? 0.5 : 1.0;
}

// Добавить расход (поддерживает customSplits для полного контроля)
router.post('/trips/:tripId/expenses', async (req, res) => {
  const tripId = Number(req.params.tripId);
  const { payerId, amount, description, category, customSplits } = req.body;

  if (!payerId || !amount || !description || !category) {
    return res.status(400).json({ error: 'payerId, amount, description, category обязательны' });
  }

  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: { members: { include: { user: true } } },
  });
  if (!trip) return res.status(404).json({ error: 'Выезд не найден' });

  let splits: { userId: number; shareWeight: number }[];

  if (customSplits && customSplits.length > 0) {
    // Сохраняем только тех, кто реально участвует (вес > 0)
    splits = customSplits
      .filter((s: { userId: number; shareWeight: number }) => s.shareWeight > 0)
      .map((s: { userId: number; shareWeight: number }) => ({
        userId: Number(s.userId),
        shareWeight: Number(s.shareWeight),
      }));
  } else {
    splits = trip.members
      .map(m => ({ userId: m.userId, shareWeight: defaultWeight(m.user.memberType, category) }))
      .filter(s => s.shareWeight > 0);
  }

  if (splits.length === 0) {
    return res.status(400).json({ error: 'Нет участников с ненулевым весом' });
  }

  const expense = await prisma.expense.create({
    data: {
      tripId,
      payerId: Number(payerId),
      amount: Number(amount),
      description,
      category,
      splits: { create: splits },
    },
    include: {
      payer: { include: { family: true } },
      splits: { include: { user: { include: { family: true } } } },
    },
  });

  res.status(201).json(expense);
});

// Редактировать расход (сумма + участники)
router.patch('/expenses/:id', async (req, res) => {
  const expenseId = Number(req.params.id);
  const { amount, customSplits } = req.body;

  const updates: any = {};
  if (amount !== undefined) updates.amount = Number(amount);

  await prisma.expense.update({ where: { id: expenseId }, data: updates });

  if (customSplits && customSplits.length > 0) {
    const splits = customSplits
      .filter((s: { userId: number; shareWeight: number }) => s.shareWeight > 0)
      .map((s: { userId: number; shareWeight: number }) => ({
        userId: Number(s.userId),
        shareWeight: Number(s.shareWeight),
      }));

    await prisma.expenseSplit.deleteMany({ where: { expenseId } });
    await prisma.expenseSplit.createMany({ data: splits.map((s: any) => ({ ...s, expenseId })) });
  }

  const updated = await prisma.expense.findUnique({
    where: { id: expenseId },
    include: {
      payer: { include: { family: true } },
      splits: { include: { user: { include: { family: true } } } },
    },
  });
  res.json(updated);
});

router.delete('/expenses/:id', async (req, res) => {
  await prisma.expenseSplit.deleteMany({ where: { expenseId: Number(req.params.id) } });
  await prisma.expense.delete({ where: { id: Number(req.params.id) } });
  res.status(204).send();
});

// Расчёт долгов — по людям, переводы агрегируются по семьям
router.get('/trips/:tripId/settlement', async (req, res) => {
  const tripId = Number(req.params.tripId);

  const expenses = await prisma.expense.findMany({
    where: { tripId },
    include: {
      splits: { include: { user: { include: { family: true } } } },
      payer: { include: { family: true } },
    },
  });

  const balance: Record<number, { amount: number; name: string; familyName: string }> = {};

  for (const expense of expenses) {
    const totalWeight = expense.splits.reduce((sum, s) => sum + s.shareWeight, 0);
    if (totalWeight === 0) continue;

    for (const split of expense.splits) {
      const share = (split.shareWeight / totalWeight) * expense.amount;
      if (!balance[split.userId]) {
        balance[split.userId] = { amount: 0, name: split.user.firstName, familyName: split.user.family.name };
      }
      balance[split.userId].amount -= share;
    }

    if (!balance[expense.payerId]) {
      balance[expense.payerId] = { amount: 0, name: expense.payer.firstName, familyName: expense.payer.family.name };
    }
    balance[expense.payerId].amount += expense.amount;
  }

  const familyBalance: Record<string, number> = {};
  for (const v of Object.values(balance)) {
    familyBalance[v.familyName] = (familyBalance[v.familyName] ?? 0) + v.amount;
  }

  const creditors = Object.entries(familyBalance)
    .filter(([, a]) => a > 0.01)
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount);

  const debtors = Object.entries(familyBalance)
    .filter(([, a]) => a < -0.01)
    .map(([name, amount]) => ({ name, amount: -amount }))
    .sort((a, b) => b.amount - a.amount);

  const transfers: { from: string; to: string; amount: number }[] = [];
  let ci = 0, di = 0;

  while (ci < creditors.length && di < debtors.length) {
    const credit = creditors[ci]!;
    const debt = debtors[di]!;
    const t = Math.min(credit.amount, debt.amount);
    transfers.push({ from: `Семья ${debt.name}`, to: `Семья ${credit.name}`, amount: Math.round(t * 100) / 100 });
    credit.amount -= t;
    debt.amount -= t;
    if (credit.amount < 0.01) ci++;
    if (debt.amount < 0.01) di++;
  }

  res.json({
    balances: Object.entries(balance).map(([id, v]) => ({
      userId: Number(id),
      name: `${v.familyName} ${v.name}`,
      netBalance: Math.round(v.amount * 100) / 100,
    })),
    familyBalances: Object.entries(familyBalance).map(([name, amount]) => ({
      familyName: name,
      netBalance: Math.round(amount * 100) / 100,
    })),
    transfers,
  });
});

export default router;
