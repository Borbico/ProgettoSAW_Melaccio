import { Game } from '../models/game';

export const MOCK_GAMES: Game[] = [
  {
    id: 'hollow-knight',
    title: 'Hollow Knight',
    genre: 'Metroidvania',
    platform: 'PC',
    releaseYear: 2017,
    status: 'Completato',
    rating: 5,
    hoursPlayed: 46,
    description: 'Esplorazione, boss fight e progressione non lineare in un mondo sotterraneo.',
    coverTheme: 'cover-moon'
  },
  {
    id: 'celeste',
    title: 'Celeste',
    genre: 'Platform',
    platform: 'Switch',
    releaseYear: 2018,
    status: 'Completato',
    rating: 5,
    hoursPlayed: 19,
    description: 'Precision platformer con livelli brevi, difficili e molto leggibili.',
    coverTheme: 'cover-summit'
  },
  {
    id: 'hades',
    title: 'Hades',
    genre: 'Roguelite',
    platform: 'PC',
    releaseYear: 2020,
    status: 'In corso',
    rating: 4,
    hoursPlayed: 31,
    description: 'Run veloci, build diverse e narrazione che avanza anche dopo la sconfitta.',
    coverTheme: 'cover-ember'
  },
  {
    id: 'outer-wilds',
    title: 'Outer Wilds',
    genre: 'Avventura',
    platform: 'Xbox',
    releaseYear: 2019,
    status: 'Wishlist',
    rating: 0,
    hoursPlayed: 0,
    description: 'Mistero spaziale basato su esplorazione, osservazione e conoscenza accumulata.',
    coverTheme: 'cover-orbit'
  },
  {
    id: 'stardew-valley',
    title: 'Stardew Valley',
    genre: 'Simulazione',
    platform: 'Mobile',
    releaseYear: 2016,
    status: 'Backlog',
    rating: 0,
    hoursPlayed: 4,
    description: 'Gestione della fattoria, relazioni con il villaggio e routine rilassata.',
    coverTheme: 'cover-field'
  },
  {
    id: 'dead-cells',
    title: 'Dead Cells',
    genre: 'Action',
    platform: 'PlayStation',
    releaseYear: 2018,
    status: 'Backlog',
    rating: 0,
    hoursPlayed: 7,
    description: 'Combattimento rapido, livelli procedurali e progressione persistente.',
    coverTheme: 'cover-neon'
  }
];
