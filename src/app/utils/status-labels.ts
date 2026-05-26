import { GameStatus } from '../models/game';

export function gameStatusLabel(status: GameStatus): string {
  if (status === 'Wishlist') {
    return 'Desiderato';
  }

  if (status === 'Backlog') {
    return 'Da giocare';
  }

  return status;
}

export function gameStatusGroupLabel(status: GameStatus): string {
  if (status === 'Wishlist') {
    return 'Desiderati';
  }

  if (status === 'Backlog') {
    return 'Da giocare';
  }

  if (status === 'Completato') {
    return 'Completati';
  }

  return status;
}

export function gameStatusActionLabel(status: GameStatus): string {
  if (status === 'In corso') {
    return 'Segna come in corso';
  }

  if (status === 'Completato') {
    return 'Segna come completato';
  }

  if (status === 'Backlog') {
    return 'Segna come da giocare';
  }

  return 'Segna come desiderato';
}
