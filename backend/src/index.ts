import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';

import familiesRouter from './routes/families';
import usersRouter from './routes/users';
import eventsRouter from './routes/events';
import tripsRouter from './routes/trips';
import expensesRouter from './routes/expenses';
import statsRouter from './routes/stats';
import parserRouter from './routes/parser';
import { startScheduler } from './services/scheduler';

const app = express();
app.use(cors());
app.use(express.json());

const FRONTEND_DIST = path.join(__dirname, '../../frontend/dist');

app.use('/api/families', familiesRouter);
app.use('/api/users', usersRouter);
app.use('/api/events', eventsRouter);
app.use('/api/trips', tripsRouter);
app.use('/api', expensesRouter);
app.use('/api/stats', statsRouter);
app.use('/api', parserRouter);

app.use(express.static(FRONTEND_DIST));
app.get(/^(?!\/api).*/, (_req, res) => {
  res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
});

const PORT = process.env.PORT || 3001;
app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`Сервер запущен на http://localhost:${PORT}`);
  startScheduler();
});
