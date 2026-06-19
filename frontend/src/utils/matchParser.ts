import type { SportType } from '../api';

export interface ParsedMatch {
  opponent: string;
  date: string;       // 'YYYY-MM-DDTHH:MM' for datetime-local input
  city: string;
  sportType: SportType;
  venue: string;
  description: string;
}

// Russian month patterns (all case forms)
const MONTH_MAP: [RegExp, number][] = [
  [/январ[яеь]?/i, 1],
  [/феврал[яеь]?/i, 2],
  [/март[еа]?/i, 3],
  [/апрел[яеь]?/i, 4],
  [/ма[йя]/i, 5],
  [/июн[яеь]?/i, 6],
  [/июл[яеь]?/i, 7],
  [/август[еа]?/i, 8],
  [/сентябр[яеь]?/i, 9],
  [/октябр[яеь]?/i, 10],
  [/ноябр[яеь]?/i, 11],
  [/декабр[яеь]?/i, 12],
];

// Russian city forms → canonical name
const CITY_VARIANTS: [RegExp, string][] = [
  [/москв[еаи]/i, 'Москва'],
  [/краснодар[ее]?/i, 'Краснодар'],
  [/соч[иеа]/i, 'Сочи'],
  [/ростов[ее]?(-на-дону)?/i, 'Ростов-на-Дону'],
  [/казан[иье]/i, 'Казань'],
  [/самар[аеи]/i, 'Самара'],
  [/нижн[иеа][йе]?\s+новгород[ее]?/i, 'Нижний Новгород'],
  [/грозн[оый]/i, 'Грозный'],
  [/перм[иье]/i, 'Пермь'],
  [/хабаровск[ее]?/i, 'Хабаровск'],
  [/воронеж[ее]?/i, 'Воронеж'],
  [/волгоград[ее]?/i, 'Волгоград'],
  [/калининград[ее]?/i, 'Калининград'],
  [/тольятт[иие]/i, 'Тольятти'],
  [/оренбург[ее]?/i, 'Оренбург'],
  [/омск[ее]?/i, 'Омск'],
  [/тюмен[иье]/i, 'Тюмень'],
  [/брянск[ее]?/i, 'Брянск'],
  [/махачкал[аеи]/i, 'Махачкала'],
  [/ставропол[иье]/i, 'Ставрополь'],
  [/владикавказ[ее]?/i, 'Владикавказ'],
  [/саратов[ее]?/i, 'Саратов'],
  [/снежинск[ее]?/i, 'Снежинск'],
  [/астрахан[иье]/i, 'Астрахань'],
  [/могилёв[ее]?|могилев[ее]?/i, 'Могилёв'],
  [/брест[ее]?/i, 'Брест'],
  [/великих?\s+лук[аи]/i, 'Великие Луки'],
  [/рязан[иье]/i, 'Рязань'],
  [/вологд[аеи]/i, 'Вологда'],
  [/твер[иье]/i, 'Тверь'],
  [/раменск[оый]/i, 'Раменское'],
  [/коломн[аеи]/i, 'Коломна'],
  [/чехов[ее]?/i, 'Чехов'],
  [/екатеринбург[ее]?/i, 'Екатеринбург'],
  [/красноярск[ее]?/i, 'Красноярск'],
  [/владивосток[ее]?/i, 'Владивосток'],
  [/киров[ее]?/i, 'Киров'],
  [/владимир[ее]?/i, 'Владимир'],
  [/санкт[-\s]?петербург[ее]?|питер[ее]?/i, 'Санкт-Петербург'],
  [/новосибирск[ее]?/i, 'Новосибирск'],
  [/екатеринбург[ее]?/i, 'Екатеринбург'],
  [/пенз[аеи]/i, 'Пенза'],
  [/уф[аеи]/i, 'Уфа'],
  [/чебоксар[ыаи]/i, 'Чебоксары'],
];

function extractDate(text: string): string | null {
  // Format: DD.MM.YYYY or DD.MM.YY
  const dotDate = text.match(/(\d{1,2})\.(\d{2})\.(\d{2,4})/);
  if (dotDate) {
    const [, d, m, y] = dotDate;
    const year = y.length === 2 ? `20${y}` : y;
    return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // Format: DD месяц YYYY or DD месяц
  for (const [pattern, monthNum] of MONTH_MAP) {
    const withYear = new RegExp(`(\\d{1,2})\\s+${pattern.source}\\s+(\\d{4})`, 'i');
    const withoutYear = new RegExp(`(\\d{1,2})\\s+${pattern.source}`, 'i');

    const m1 = text.match(withYear);
    if (m1) {
      return `${m1[2]}-${String(monthNum).padStart(2, '0')}-${m1[1].padStart(2, '0')}`;
    }
    const m2 = text.match(withoutYear);
    if (m2) {
      const year = new Date().getFullYear();
      const isoDate = `${year}-${String(monthNum).padStart(2, '0')}-${m2[1].padStart(2, '0')}`;
      // If the date is in the past, assume next year
      if (new Date(isoDate) < new Date()) {
        return `${year + 1}-${String(monthNum).padStart(2, '0')}-${m2[1].padStart(2, '0')}`;
      }
      return isoDate;
    }
  }

  return null;
}

function extractTime(text: string): string {
  // Patterns: "18:00", "начало в 18:00", "в 18.00"
  const match = text.match(/(?:начало|старт|время|в\s+)?(\d{1,2})[:\.](\d{2})(?:\s*(?:мск|мск\.|UTC))?/i);
  if (match) {
    const h = parseInt(match[1], 10);
    if (h >= 0 && h <= 23) {
      return `${String(h).padStart(2, '0')}:${match[2]}`;
    }
  }
  return '15:00';
}

function extractCity(text: string): string {
  for (const [pattern, canonical] of CITY_VARIANTS) {
    if (pattern.test(text)) return canonical;
  }
  return '';
}

function extractOpponent(text: string): string {
  // "Зенит — Спартак", "Зенит - ЦСКА", "Зенит vs Краснодар"
  // "Спартак — Зенит" (away game)
  const zenit = /Зенит(?:\s+\d)?/i;

  const afterZenit = text.match(
    new RegExp(`${zenit.source}\\s*[—\\-–]\\s*([А-ЯЁа-яёA-Za-z][А-ЯЁа-яё\\w\\s-]{1,30})`, 'i')
  );
  if (afterZenit) {
    const candidate = afterZenit[1].trim().replace(/[,.].*$/, '').trim();
    if (candidate.length > 1 && !/^\d/.test(candidate)) return candidate;
  }

  const beforeZenit = text.match(
    new RegExp(`([А-ЯЁа-яёA-Za-z][А-ЯЁа-яё\\w\\s-]{1,30})\\s*[—\\-–]\\s*${zenit.source}`, 'i')
  );
  if (beforeZenit) {
    const candidate = beforeZenit[1].trim().replace(/[,.].*$/, '').trim();
    if (candidate.length > 1 && !/^\d/.test(candidate)) return candidate;
  }

  // "vs" pattern
  const vs = text.match(/(?:vs\.?\s+|против\s+)([А-ЯЁа-яёA-Za-z][А-ЯЁа-яё\w\s-]{1,25})/i);
  if (vs) return vs[1].trim().replace(/[,.].*$/, '').trim();

  return '';
}

function extractSportType(text: string, source: string): SportType {
  const lower = text.toLowerCase();
  const src = source.toLowerCase();

  if (/гандбол|handball/i.test(lower) || src.includes('handball')) return 'HANDBALL';
  if (/жфк|женск[аяие]|women/i.test(lower)) return 'WOMEN';
  if (/зенит-2|зенит 2|зенит2|молодёж|молодеж|youth/i.test(lower) || src === 'zenit2fc') return 'YOUTH';
  return 'FOOTBALL';
}

export function parseMatchFromText(text: string, source = ''): Partial<ParsedMatch> {
  const result: Partial<ParsedMatch> = {};

  const dateStr = extractDate(text);
  const timeStr = extractTime(text);

  if (dateStr) {
    result.date = `${dateStr}T${timeStr}`;
  }

  const opponent = extractOpponent(text);
  if (opponent) result.opponent = opponent;

  const city = extractCity(text);
  if (city) result.city = city;

  result.sportType = extractSportType(text, source);
  result.description = '';
  result.venue = '';

  return result;
}
