import axios from 'axios';

// В продакшене — относительный путь /api (бэкенд на том же домене)
// В dev — Vite proxy перенаправляет /api → localhost:3001
const api = axios.create({ baseURL: '/api' });
export default api;

// --- Types ---
export type MemberType = 'ADULT' | 'CHILD' | 'INFANT';

export const MEMBER_TYPE_LABELS: Record<MemberType, string> = {
  ADULT: 'Взрослый',
  CHILD: 'Ребёнок',
  INFANT: 'Младенец',
};

export const MEMBER_TYPE_WEIGHTS: Record<MemberType, number> = {
  ADULT: 1.0,
  CHILD: 0.5,
  INFANT: 0.0,
};

export function defaultWeight(memberType: MemberType, category: string): number {
  if (memberType === 'INFANT') return 0;
  if (category === 'ALCOHOL') return memberType === 'ADULT' ? 1.0 : 0;
  return memberType === 'CHILD' ? 0.5 : 1.0;
}

export interface Family {
  id: number;
  name: string;
  members: User[];
}

export interface User {
  id: number;
  firstName: string;
  memberType: MemberType;
  familyId: number;
  family: Family;
}

export type SportType = 'FOOTBALL' | 'HANDBALL' | 'YOUTH' | 'WOMEN';
export type ExpenseCategory = 'FOOD' | 'ALCOHOL' | 'TRANSPORT' | 'HOTEL' | 'EXCURSION' | 'OTHER';

export const SPORT_LABELS: Record<SportType, string> = {
  FOOTBALL: 'Футбол',
  HANDBALL: 'Гандбол',
  YOUTH: 'Юношеская лига',
  WOMEN: 'Женская лига',
};

export const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  FOOD: 'Еда',
  ALCOHOL: 'Алкоголь',
  TRANSPORT: 'Транспорт',
  HOTEL: 'Отель',
  EXCURSION: 'Экскурсия',
  OTHER: 'Прочее',
};

export const CATEGORY_EMOJI: Record<ExpenseCategory, string> = {
  FOOD: '🍽️',
  ALCOHOL: '🍷',
  TRANSPORT: '🚂',
  HOTEL: '🏨',
  EXCURSION: '🏛️',
  OTHER: '📦',
};

export interface Event {
  id: number;
  sportType: SportType;
  opponent: string;
  date: string;
  city: string;
  venue?: string;
  description?: string;
  trip?: Trip;
}

export interface Trip {
  id: number;
  eventId: number;
  event: Event;
  members: TripMember[];
  expenses: Expense[];
}

export interface TripMember {
  id: number;
  tripId: number;
  userId: number;
  attendedMatch: boolean;
  user: User;
}

export interface Expense {
  id: number;
  tripId: number;
  payerId: number;
  amount: number;
  description: string;
  category: ExpenseCategory;
  payer: User;
  splits: ExpenseSplit[];
  createdAt: string;
}

export interface ExpenseSplit {
  id: number;
  expenseId: number;
  userId: number;
  shareWeight: number;
  user: User;
}

export interface Settlement {
  balances: { userId: number; name: string; netBalance: number }[];
  familyBalances: { familyName: string; netBalance: number }[];
  transfers: { from: string; to: string; amount: number }[];
}

export interface Notification {
  id: number;
  type: string; // 'match' | 'tickets'
  title: string;
  body: string;
  source: string;
  sourceUrl?: string;
  read: boolean;
  createdAt: string;
}

export interface ParserState {
  id: number;
  source: string;
  lastRunAt?: string;
  lastPostId?: string;
  errorMessage?: string;
  updatedAt: string;
}

export interface ParserSource {
  id: number;
  type: 'telegram' | 'website';
  identifier: string;
  label: string;
  enabled: boolean;
  createdAt: string;
  state?: ParserState | null;
}
