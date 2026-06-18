import cron from 'node-cron';
import prisma from '../lib/prisma';
import { fetchTelegramChannel, getMaxPostId } from '../parsers/telegram';
import { fetchWebsite } from '../parsers/website';

const DEFAULT_SOURCES = [
  { type: 'telegram', identifier: 'landscrona33', label: 'Landscrona (выезды)' },
  { type: 'telegram', identifier: 'zenit2fc', label: 'Зенит-2' },
];

async function ensureDefaultSources() {
  const count = await prisma.parserSource.count();
  if (count === 0) {
    for (const s of DEFAULT_SOURCES) {
      await prisma.parserSource.create({ data: s });
    }
    console.log('[Scheduler] Добавлены источники по умолчанию');
  }
}

async function processTelegramSource(id: number, identifier: string, label: string) {
  const stateKey = `tg:${identifier}`;
  const state = await prisma.parserState.findUnique({ where: { source: stateKey } });
  const lastPostId = state?.lastPostId ?? undefined;
  const isFirstRun = !state?.lastPostId;

  const posts = await fetchTelegramChannel(identifier, lastPostId);
  const maxPostId = getMaxPostId(posts) ?? lastPostId;
  let created = 0;

  if (!isFirstRun) {
    for (const post of posts) {
      const type = post.hasTickets ? 'tickets' : 'match';
      const title = post.hasTickets ? `🎫 Билеты: ${label}` : `📅 Матч/выезд: ${label}`;
      const body = post.text.length > 500 ? post.text.slice(0, 500) + '…' : post.text;
      await prisma.notification.create({
        data: { type, title, body, source: identifier, sourceUrl: post.url },
      });
      created++;
    }
  }

  await prisma.parserState.upsert({
    where: { source: stateKey },
    update: { lastRunAt: new Date(), lastPostId: maxPostId, errorMessage: null },
    create: { source: stateKey, lastRunAt: new Date(), lastPostId: maxPostId },
  });

  const action = isFirstRun
    ? `первый запуск, отметка #${maxPostId}`
    : `${created} новых`;
  console.log(`[Parser] ${label}: ${action}`);
}

async function processWebsiteSource(id: number, identifier: string, label: string) {
  const stateKey = `web:${identifier}`;

  const snippets = await fetchWebsite(identifier);
  let created = 0;

  for (const snippet of snippets) {
    // Deduplicate by checking body in DB (for websites we can't use post IDs)
    const existing = await prisma.notification.findFirst({
      where: { source: identifier, body: snippet.text },
    });
    if (existing) continue;

    const type = snippet.hasTickets ? 'tickets' : 'match';
    const title = snippet.hasTickets ? `🎫 Билеты: ${label}` : `📅 Матч/выезд: ${label}`;
    await prisma.notification.create({
      data: { type, title, body: snippet.text, source: identifier, sourceUrl: identifier },
    });
    created++;
  }

  await prisma.parserState.upsert({
    where: { source: stateKey },
    update: { lastRunAt: new Date(), errorMessage: null },
    create: { source: stateKey, lastRunAt: new Date() },
  });

  console.log(`[Parser] ${label}: ${created} новых сниппетов`);
}

async function processSource(source: { id: number; type: string; identifier: string; label: string }) {
  try {
    if (source.type === 'telegram') {
      await processTelegramSource(source.id, source.identifier, source.label);
    } else if (source.type === 'website') {
      await processWebsiteSource(source.id, source.identifier, source.label);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const stateKey = `${source.type === 'telegram' ? 'tg' : 'web'}:${source.identifier}`;
    await prisma.parserState.upsert({
      where: { source: stateKey },
      update: { lastRunAt: new Date(), errorMessage: msg },
      create: { source: stateKey, lastRunAt: new Date(), errorMessage: msg },
    });
    console.error(`[Parser] ${source.label}: ошибка — ${msg}`);
  }
}

export async function runParser(): Promise<void> {
  console.log('[Parser] Запуск...');
  const sources = await prisma.parserSource.findMany({ where: { enabled: true } });
  for (const source of sources) {
    await processSource(source);
  }
  console.log('[Parser] Готово.');
}

export function startScheduler(): void {
  ensureDefaultSources()
    .then(() => {
      // Run immediately on startup to set watermarks
      return runParser();
    })
    .catch(err => console.error('[Scheduler] Ошибка при старте:', err));

  // Every 6 hours
  cron.schedule('0 */6 * * *', async () => {
    await runParser().catch(err => console.error('[Scheduler] Ошибка:', err));
  });

  console.log('[Scheduler] Запущен, интервал: каждые 6 часов');
}
