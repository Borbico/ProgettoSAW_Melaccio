import { GameStatus } from '../models/game';
import { ShelfEntry } from '../models/shelf-entry';
import { clampNumber, normalizeIsoDate } from './number-utils';

export function defaultShelfEntry(): ShelfEntry {
  return {
    status: 'Wishlist',
    rating: 0,
    hoursPlayed: 0,
    progress: 0,
    notes: '',
    personalGoal: '',
  };
}

export function normalizeStatus(status: unknown): GameStatus {
  return status === 'Backlog' || status === 'In corso' || status === 'Completato'
    ? status
    : 'Wishlist';
}

export function normalizeShelfEntry(entry: Partial<ShelfEntry>): ShelfEntry {
  const updatedAt = normalizeIsoDate(entry.updatedAt);

  return {
    status: normalizeStatus(entry.status),
    rating: clampNumber(entry.rating, 0, 5),
    hoursPlayed: clampNumber(entry.hoursPlayed, 0, 999),
    progress: clampNumber(entry.progress, 0, 100),
    notes: String(entry.notes ?? ''),
    personalGoal: String(entry.personalGoal ?? ''),
    ...(updatedAt ? { updatedAt } : {}),
  };
}
