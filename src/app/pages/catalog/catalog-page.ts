import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Game, GameStatus } from '../../models/game';
import { GameCatalog } from '../../services/game-catalog';

type CatalogEditorMode = 'closed' | 'create' | 'edit';

interface CatalogForm {
  title: string;
  developer: string;
  publisher: string;
  genre: string;
  platform: string;
  modes: string;
  tags: string;
  releaseYear: number;
  status: GameStatus;
  rating: number;
  hoursPlayed: number;
  progress: number;
  description: string;
  notes: string;
  personalGoal: string;
  coverTheme: string;
}

@Component({
  selector: 'app-catalog-page',
  imports: [FormsModule, RouterLink],
  templateUrl: './catalog-page.html',
  styleUrl: './catalog-page.css'
})
export class CatalogPage {
  private readonly catalog = inject(GameCatalog);

  protected readonly searchTerm = signal('');
  protected readonly selectedGenre = signal('Tutti');
  protected readonly selectedPlatform = signal('Tutte');
  protected readonly selectedStatus = signal<'Tutti' | GameStatus>('Tutti');
  protected readonly editorMode = signal<CatalogEditorMode>('closed');
  protected readonly editingGameId = signal<string | null>(null);
  protected readonly deleteCandidateId = signal<string | null>(null);
  protected readonly catalogMessage = signal('');
  protected readonly form = signal<CatalogForm>(this.emptyForm());

  protected readonly games = this.catalog.games;
  protected readonly genres = computed(() => this.uniqueValues('genre'));
  protected readonly platforms = computed(() => this.uniqueValues('platform'));
  protected readonly editorOpen = computed(() => this.editorMode() !== 'closed');
  protected readonly editorTitle = computed(() =>
    this.editorMode() === 'edit' ? 'Modifica gioco' : 'Nuovo gioco'
  );
  protected readonly gameStatuses: GameStatus[] = ['Wishlist', 'Backlog', 'In corso', 'Completato'];
  protected readonly statuses: Array<'Tutti' | GameStatus> = [
    'Tutti',
    'Wishlist',
    'Backlog',
    'In corso',
    'Completato'
  ];
  protected readonly coverThemes = [
    { value: 'cover-moon', label: 'Notturno' },
    { value: 'cover-summit', label: 'Montagna' },
    { value: 'cover-ember', label: 'Brace' },
    { value: 'cover-orbit', label: 'Orbita' },
    { value: 'cover-field', label: 'Campo' },
    { value: 'cover-neon', label: 'Neon' }
  ];

  protected readonly filteredGames = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const genre = this.selectedGenre();
    const platform = this.selectedPlatform();
    const status = this.selectedStatus();

    return this.games().filter((game) => {
      const matchesSearch =
        !term ||
        game.title.toLowerCase().includes(term) ||
        game.description.toLowerCase().includes(term) ||
        game.tags.some((tag) => tag.toLowerCase().includes(term));
      const matchesGenre = genre === 'Tutti' || game.genre === genre;
      const matchesPlatform = platform === 'Tutte' || game.platform === platform;
      const matchesStatus = status === 'Tutti' || game.status === status;

      return matchesSearch && matchesGenre && matchesPlatform && matchesStatus;
    });
  });

  protected readonly completedGames = computed(
    () => this.games().filter((game) => game.status === 'Completato').length
  );

  protected readonly totalHours = computed(() =>
    this.games().reduce((total, game) => total + game.hoursPlayed, 0)
  );

  protected updateSearch(term: string): void {
    this.searchTerm.set(term);
  }

  protected updateGenre(genre: string): void {
    this.selectedGenre.set(genre);
  }

  protected updatePlatform(platform: string): void {
    this.selectedPlatform.set(platform);
  }

  protected updateStatus(status: 'Tutti' | GameStatus): void {
    this.selectedStatus.set(status);
  }

  protected resetFilters(): void {
    this.searchTerm.set('');
    this.selectedGenre.set('Tutti');
    this.selectedPlatform.set('Tutte');
    this.selectedStatus.set('Tutti');
  }

  protected startCreate(): void {
    this.form.set(this.emptyForm());
    this.editorMode.set('create');
    this.editingGameId.set(null);
    this.deleteCandidateId.set(null);
    this.catalogMessage.set('');
  }

  protected startEdit(game: Game): void {
    this.form.set(this.formFromGame(game));
    this.editorMode.set('edit');
    this.editingGameId.set(game.id);
    this.deleteCandidateId.set(null);
    this.catalogMessage.set('');
  }

  protected cancelEditor(): void {
    this.editorMode.set('closed');
    this.editingGameId.set(null);
    this.form.set(this.emptyForm());
  }

  protected updateForm<K extends keyof CatalogForm>(field: K, value: CatalogForm[K]): void {
    this.form.update((form) => ({
      ...form,
      [field]: value
    }));
  }

  protected saveGame(): void {
    const form = this.form();
    const validationMessage = this.validateForm(form);

    if (validationMessage) {
      this.catalogMessage.set(validationMessage);
      return;
    }

    const game = this.gameFromForm(form, this.editingGameId() ?? '');

    if (this.editorMode() === 'edit') {
      const gameId = this.editingGameId();

      if (!gameId) {
        this.catalogMessage.set('Seleziona un gioco da modificare.');
        return;
      }

      this.catalog.updateGame(gameId, game);
      this.catalogMessage.set(`${game.title} aggiornato.`);
    } else {
      this.catalog.createGame(game);
      this.resetFilters();
      this.catalogMessage.set(`${game.title} aggiunto al catalogo.`);
    }

    this.editorMode.set('closed');
    this.editingGameId.set(null);
    this.form.set(this.emptyForm());
  }

  protected requestDelete(game: Game): void {
    this.deleteCandidateId.set(game.id);
    this.catalogMessage.set(`Conferma l'eliminazione di ${game.title}.`);
  }

  protected cancelDelete(): void {
    this.deleteCandidateId.set(null);
    this.catalogMessage.set('');
  }

  protected deleteGame(game: Game): void {
    this.catalog.deleteGame(game.id);

    if (this.editingGameId() === game.id) {
      this.cancelEditor();
    }

    this.deleteCandidateId.set(null);
    this.catalogMessage.set(`${game.title} eliminato dal catalogo.`);
  }

  protected ratingStars(game: Game): string {
    return game.rating === 0 ? 'Da valutare' : '\u2605'.repeat(game.rating);
  }

  private uniqueValues(key: 'genre' | 'platform'): string[] {
    return Array.from(new Set(this.games().map((game) => game[key]))).sort();
  }

  private emptyForm(): CatalogForm {
    return {
      title: '',
      developer: '',
      publisher: '',
      genre: '',
      platform: 'PC',
      modes: 'Single player',
      tags: '',
      releaseYear: 2026,
      status: 'Wishlist',
      rating: 0,
      hoursPlayed: 0,
      progress: 0,
      description: '',
      notes: '',
      personalGoal: '',
      coverTheme: 'cover-neon'
    };
  }

  private formFromGame(game: Game): CatalogForm {
    return {
      title: game.title,
      developer: game.developer,
      publisher: game.publisher,
      genre: game.genre,
      platform: game.platform,
      modes: game.modes.join(', '),
      tags: game.tags.join(', '),
      releaseYear: game.releaseYear,
      status: game.status,
      rating: game.rating,
      hoursPlayed: game.hoursPlayed,
      progress: game.progress,
      description: game.description,
      notes: game.notes,
      personalGoal: game.personalGoal,
      coverTheme: game.coverTheme
    };
  }

  private gameFromForm(form: CatalogForm, id: string): Game {
    return {
      id,
      title: form.title.trim(),
      developer: form.developer.trim(),
      publisher: form.publisher.trim(),
      genre: form.genre.trim(),
      platform: form.platform.trim(),
      modes: this.splitList(form.modes, ['Single player']),
      tags: this.splitList(form.tags),
      releaseYear: this.clampNumber(form.releaseYear, 1970, 2035),
      status: form.status,
      rating: this.clampNumber(form.rating, 0, 5),
      hoursPlayed: this.clampNumber(form.hoursPlayed, 0, 999),
      progress: this.clampNumber(form.progress, 0, 100),
      description: form.description.trim(),
      notes: form.notes.trim(),
      personalGoal: form.personalGoal.trim(),
      coverTheme: form.coverTheme
    };
  }

  private validateForm(form: CatalogForm): string {
    if (!form.title.trim()) {
      return 'Inserisci il titolo del gioco.';
    }

    if (!form.developer.trim() || !form.publisher.trim()) {
      return 'Inserisci sviluppatore e publisher.';
    }

    if (!form.genre.trim() || !form.platform.trim()) {
      return 'Inserisci genere e piattaforma.';
    }

    if (!form.description.trim()) {
      return 'Inserisci una breve descrizione.';
    }

    return '';
  }

  private splitList(value: string, fallback: string[] = []): string[] {
    const items = value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    return items.length ? items : fallback;
  }

  private clampNumber(value: number | string, min: number, max: number): number {
    const numericValue = Number(value);

    if (Number.isNaN(numericValue)) {
      return min;
    }

    return Math.min(max, Math.max(min, Math.round(numericValue)));
  }
}
