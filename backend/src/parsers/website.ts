import * as cheerio from 'cheerio';
import { createHash } from 'crypto';

export interface WebSnippet {
  hash: string;
  text: string;
  hasTickets: boolean;
  hasMatch: boolean;
}

const TICKET_KEYWORDS = [
  'билет', 'в продаже', 'продажа', 'купить', 'старт продаж',
  'открыта продажа', 'поступил', 'приобрести', 'продается', 'продаётся',
];

const MATCH_KEYWORDS = [
  'выезд', 'матч', 'игра ', 'расписание', 'календарь',
  'сыграет', 'встретится', 'выездной', 'гостевой',
  'следующий матч', 'следующая игра',
];

export async function fetchWebsite(url: string): Promise<WebSnippet[]> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.8',
    },
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const html = await response.text();
  const $ = cheerio.load(html);

  // Remove noise
  $('script, style, nav, footer, header, aside, .menu, .sidebar').remove();

  const rawText = $('body').text();

  // Split into chunks (by newline or sentence boundary)
  const chunks = rawText
    .split(/[\n\r]+/)
    .map(s => s.replace(/\s+/g, ' ').trim())
    .filter(s => s.length >= 30 && s.length <= 800);

  const results: WebSnippet[] = [];
  const seenHashes = new Set<string>();

  for (const chunk of chunks) {
    const lower = chunk.toLowerCase();
    const hasTickets = TICKET_KEYWORDS.some(kw => lower.includes(kw));
    const hasMatch = MATCH_KEYWORDS.some(kw => lower.includes(kw));

    if (!hasTickets && !hasMatch) continue;

    const hash = createHash('md5').update(chunk).digest('hex');
    if (seenHashes.has(hash)) continue;
    seenHashes.add(hash);

    results.push({ hash, text: chunk, hasTickets, hasMatch });
  }

  return results;
}
