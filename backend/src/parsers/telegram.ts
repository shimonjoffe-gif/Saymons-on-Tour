import * as cheerio from 'cheerio';

export interface ParsedPost {
  postId: string;
  text: string;
  date: Date;
  url: string;
  hasTickets: boolean;
  hasMatch: boolean;
}

const TICKET_KEYWORDS = [
  'билет', 'в продаже', 'продажа', 'купить', 'старт продаж',
  'открыта продажа', 'поступил', 'продается', 'продаётся', 'приобрести',
];

const MATCH_KEYWORDS = [
  'выезд', 'матч', 'игра ', 'расписание', 'календарь',
  'сыграет', 'встретится', ' vs ', 'выездной', 'гостевой',
  'следующий матч', 'следующая игра',
];

export async function fetchTelegramChannel(channelName: string, lastPostId?: string): Promise<ParsedPost[]> {
  const url = `https://t.me/s/${channelName}`;
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.8',
    },
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const html = await response.text();
  const $ = cheerio.load(html);
  const posts: ParsedPost[] = [];

  $('[data-post]').each((_, el) => {
    const postAttr = $(el).attr('data-post') || '';
    const parts = postAttr.split('/');
    const postId = parts[parts.length - 1] || '';

    if (!postId) return;

    // Skip already-seen posts (compare numerically)
    if (lastPostId && Number(postId) <= Number(lastPostId)) return;

    const text = $(el).find('.tgme_widget_message_text').text().trim();
    if (!text) return;

    const dateStr = $(el).find('time').attr('datetime') || '';
    const date = dateStr ? new Date(dateStr) : new Date();
    const postUrl = `https://t.me/${postAttr}`;

    const textLower = text.toLowerCase();
    const hasTickets = TICKET_KEYWORDS.some(kw => textLower.includes(kw));
    const hasMatch = MATCH_KEYWORDS.some(kw => textLower.includes(kw));

    if (hasTickets || hasMatch) {
      posts.push({ postId, text, date, url: postUrl, hasTickets, hasMatch });
    }
  });

  // Return sorted by postId ascending (oldest first)
  return posts.sort((a, b) => Number(a.postId) - Number(b.postId));
}

export function getMaxPostId(posts: ParsedPost[]): string | undefined {
  if (!posts.length) return undefined;
  return posts.reduce((max, p) => Number(p.postId) > Number(max) ? p.postId : max, posts[0].postId);
}
