import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CatalogGame } from '../../models/catalog-game';
import { GameStatus } from '../../models/game';
import { AccessControl } from '../../services/access-control';
import { GameCatalog } from '../../services/game-catalog';
import type { PersistenceResult } from '../../services/game-catalog';
import { PwaService } from '../../services/pwa';
import { NotificationCenter, NotificationTone } from '../../services/notification-center';
import { coverImageStyle } from '../../utils/cover-image-style';
import { clampNumber } from '../../utils/number-utils';
import { notifyPersistenceResult } from '../../utils/persistence-feedback';
import { gameStatusGroupLabel } from '../../utils/status-labels';
import {
  RawgGameSummary,
  RawgGames,
  RawgImportedGame,
  RawgSearchResult,
} from '../../services/rawg-games';

type CatalogEditorMode = 'closed' | 'create' | 'edit';
type CatalogInputMode = 'manual' | 'rawg';

interface CatalogForm {
  title: string;
  developer: string;
  publisher: string;
  genre: string;
  platform: string;
  modes: string;
  tags: string;
  releaseYear: number;
  description: string;
  coverTheme: string;
  coverImageUrl: string;
  sourceName: string;
  sourceUrl: string;
}

@Component({
  selector: 'app-catalog-page',
  imports: [FormsModule, RouterLink],
  templateUrl: './catalog-page.html',
  styleUrl: './catalog-page.css',
})
export class CatalogPage {
  private readonly access = inject(AccessControl);
  private readonly catalog = inject(GameCatalog);
  private readonly notifications = inject(NotificationCenter);
  private readonly rawg = inject(RawgGames);
  private readonly pwa = inject(PwaService);

  protected readonly pwaOnline = this.pwa.online;

  protected readonly searchTerm = signal('');
  protected readonly selectedGenre = signal('Tutti');
  protected readonly selectedPlatform = signal('Tutte');
  protected readonly sortBy = signal('title-asc');
  protected readonly editorMode = signal<CatalogEditorMode>('closed');
  protected readonly editingGameId = signal<string | null>(null);
  protected readonly deleteCandidateId = signal<string | null>(null);
  protected readonly catalogMessage = signal('');
  protected readonly catalogMessageTone = signal<NotificationTone>('info');
  protected readonly catalogBusy = signal(false);
  protected readonly form = signal<CatalogForm>(this.emptyForm());
  protected readonly inputMode = signal<CatalogInputMode>('manual');
  protected readonly rawgQuery = signal('');
  protected readonly rawgResults = signal<RawgGameSummary[]>([]);
  protected readonly rawgMessage = signal('');
  protected readonly rawgMessageTone = signal<NotificationTone>('info');
  protected readonly rawgBusy = signal(false);
  protected readonly rawgLoadingMore = signal(false);
  protected readonly rawgImportingId = signal<number | null>(null);
  protected readonly rawgPage = signal(1);
  protected readonly rawgHasMore = signal(false);
  protected readonly shelfBusyGameId = signal('');

  protected readonly canEditCatalog = this.access.canEditCatalog;
  protected readonly roleLabel = this.access.roleLabel;
  protected readonly canEditShelf = this.access.canEditShelf;
  protected readonly shelfStatusMap = computed(() => {
    const map: Record<string, GameStatus | undefined> = {};
    for (const game of this.catalog.shelfGames()) {
      map[game.id] = game.status;
    }
    return map;
  });
  protected readonly games = this.catalog.games;
  protected readonly genres = computed(() => this.uniqueValues('genre'));
  protected readonly platforms = computed(() => this.uniqueValues('platform'));
  protected readonly editorOpen = computed(() => this.editorMode() !== 'closed');
  protected readonly editorTitle = computed(() =>
    this.editorMode() === 'edit' ? 'Modifica gioco' : 'Nuovo gioco',
  );
  protected readonly coverThemes = [
    { value: 'cover-moon', label: 'Notturno' },
    { value: 'cover-summit', label: 'Montagna' },
    { value: 'cover-ember', label: 'Brace' },
    { value: 'cover-orbit', label: 'Orbita' },
    { value: 'cover-field', label: 'Campo' },
    { value: 'cover-neon', label: 'Neon' },
  ];

  protected readonly filteredGames = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const genre = this.selectedGenre();
    const platform = this.selectedPlatform();
    const sort = this.sortBy();

    const result = this.games().filter((game) => {
      const matchesSearch =
        !term ||
        game.title.toLowerCase().includes(term) ||
        game.description.toLowerCase().includes(term) ||
        game.tags.some((tag) => tag.toLowerCase().includes(term));
      const matchesGenre = genre === 'Tutti' || game.genre === genre;
      const matchesPlatform = platform === 'Tutte' || game.platform === platform;

      return matchesSearch && matchesGenre && matchesPlatform;
    });

    return result.sort((first, second) => {
      if (sort === 'title-asc') {
        return first.title.localeCompare(second.title);
      }
      if (sort === 'title-desc') {
        return second.title.localeCompare(first.title);
      }
      if (sort === 'year-desc') {
        return second.releaseYear - first.releaseYear || first.title.localeCompare(second.title);
      }
      if (sort === 'year-asc') {
        return first.releaseYear - second.releaseYear || first.title.localeCompare(second.title);
      }
      return 0;
    });
  });

  protected readonly genreCount = computed(
    () => new Set(this.games().map((game) => game.genre)).size,
  );

  protected readonly platformCount = computed(
    () => new Set(this.games().map((game) => game.platform)).size,
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

  protected resetFilters(): void {
    this.searchTerm.set('');
    this.selectedGenre.set('Tutti');
    this.selectedPlatform.set('Tutte');
    this.sortBy.set('title-asc');
  }

  protected updateSortBy(sort: string): void {
    this.sortBy.set(sort);
  }

  protected updateRawgQuery(query: string): void {
    this.rawgQuery.set(query);
  }

  protected selectInputMode(mode: CatalogInputMode): void {
    this.inputMode.set(mode);

    if (mode === 'manual') {
      this.rawgResults.set([]);
      this.clearRawgFeedback();
      return;
    }

    this.rawgQuery.set(this.form().title || this.rawgQuery());
  }

  protected async searchRawgGames(): Promise<void> {
    if (this.rawgBusy()) {
      return;
    }

    if (!this.ensureCatalogPermission()) {
      return;
    }

    const query = this.rawgQuery().trim();

    if (!query) {
      this.setRawgFeedback('warning', 'Inserisci un titolo da cercare su RAWG.');
      return;
    }

    this.rawgBusy.set(true);
    this.rawgLoadingMore.set(false);
    this.rawgResults.set([]);
    this.rawgPage.set(1);
    this.rawgHasMore.set(false);
    this.setRawgFeedback('info', 'Ricerca su RAWG in corso...');

    try {
      const result = await this.rawg.searchGames(query);
      this.applyRawgSearchResult(result);

      if (!result.games.length) {
        this.setRawgFeedback('warning', 'Nessun risultato trovato su RAWG.');
        return;
      }

      this.setRawgFeedback('success', this.rawgResultsMessage(result));
    } catch (error) {
      const message = this.rawgFailureMessage(error);

      this.setRawgFeedback('error', message);
      this.notifications.error('RAWG non disponibile', message);
    } finally {
      this.rawgBusy.set(false);
    }
  }

  protected async loadMoreRawgGames(): Promise<void> {
    if (this.rawgBusy() || !this.rawgHasMore()) {
      return;
    }

    if (!this.ensureCatalogPermission()) {
      return;
    }

    const query = this.rawgQuery().trim();

    if (!query) {
      this.setRawgFeedback('warning', 'Inserisci un titolo da cercare su RAWG.');
      return;
    }

    this.rawgBusy.set(true);
    this.rawgLoadingMore.set(true);
    this.setRawgFeedback('info', 'Carico altri risultati RAWG...');

    try {
      const result = await this.rawg.searchGames(query, this.rawgPage() + 1);
      const knownIds = new Set(this.rawgResults().map((game) => game.rawgId));
      const newGames = result.games.filter((game) => !knownIds.has(game.rawgId));

      this.rawgResults.update((games) => [...games, ...newGames]);
      this.rawgPage.set(result.page);
      this.rawgHasMore.set(result.hasMore);
      this.setRawgFeedback('success', this.rawgResultsMessage(result));
    } catch (error) {
      const message = this.rawgFailureMessage(error);

      this.setRawgFeedback('error', message);
      this.notifications.error('RAWG non disponibile', message);
    } finally {
      this.rawgBusy.set(false);
      this.rawgLoadingMore.set(false);
    }
  }

  protected async importRawgGame(result: RawgGameSummary): Promise<void> {
    if (this.rawgImportingId()) {
      return;
    }

    if (!this.ensureCatalogPermission()) {
      return;
    }

    this.rawgImportingId.set(result.rawgId);
    this.setRawgFeedback('info', `Importo ${result.title} da RAWG...`);

    try {
      const importedGame = await this.rawg.getGameDetails(result.rawgId);
      this.form.update((form) => this.formFromRawg(importedGame, form));
      this.setRawgFeedback('success', `${importedGame.title} importato. Controlla e salva.`);
      this.notifications.info(
        'Dati RAWG importati',
        `${importedGame.title} ha compilato la scheda. Salva per aggiungerlo al catalogo.`,
      );
    } catch (error) {
      const message = this.rawgFailureMessage(error);

      this.setRawgFeedback('error', message);
      this.notifications.error('Import non riuscito', `${result.title} non e stato importato.`);
    } finally {
      this.rawgImportingId.set(null);
    }
  }

  protected startCreate(): void {
    if (!this.ensureCatalogPermission()) {
      return;
    }

    this.form.set(this.emptyForm());
    this.inputMode.set('manual');
    this.rawgQuery.set(this.searchTerm());
    this.rawgResults.set([]);
    this.editorMode.set('create');
    this.editingGameId.set(null);
    this.deleteCandidateId.set(null);
    this.clearCatalogFeedback();
    this.clearRawgFeedback();
  }

  protected startEdit(game: CatalogGame): void {
    if (!this.ensureCatalogPermission()) {
      return;
    }

    this.form.set(this.formFromGame(game));
    this.inputMode.set('manual');
    this.rawgQuery.set(game.title);
    this.rawgResults.set([]);
    this.editorMode.set('edit');
    this.editingGameId.set(game.id);
    this.deleteCandidateId.set(null);
    this.clearCatalogFeedback();
    this.clearRawgFeedback();
  }

  protected cancelEditor(): void {
    this.editorMode.set('closed');
    this.editingGameId.set(null);
    this.form.set(this.emptyForm());
    this.inputMode.set('manual');
    this.rawgResults.set([]);
    this.rawgHasMore.set(false);
  }

  protected updateForm<K extends keyof CatalogForm>(field: K, value: CatalogForm[K]): void {
    this.form.update((form) => ({
      ...form,
      [field]: value,
    }));
  }

  protected coverImageStyle(item: { coverImageUrl?: string }): string | null {
    return coverImageStyle(item);
  }

  protected async saveGame(): Promise<void> {
    if (this.catalogBusy()) {
      return;
    }

    if (!this.ensureCatalogPermission()) {
      return;
    }

    const form = this.form();
    const validationMessage = this.validateForm(form);

    if (validationMessage) {
      this.setCatalogFeedback('warning', validationMessage);
      this.notifications.warning('Dati da completare', validationMessage);
      return;
    }

    const game = this.gameFromForm(form, this.editingGameId() ?? '');
    this.catalogBusy.set(true);
    this.setCatalogFeedback('info', 'Salvataggio in corso...');

    try {
      if (this.editorMode() === 'edit') {
        const gameId = this.editingGameId();

        if (!gameId) {
          const message = 'Seleziona un gioco da modificare.';
          this.setCatalogFeedback('warning', message);
          this.notifications.warning('Modifica non pronta', message);
          return;
        }

        const persistence = await this.catalog.updateGame(gameId, game);
        if (persistence === 'denied') {
          this.setCatalogFeedback(
            'error',
            'Permesso negato: solo un admin puo modificare il catalogo.',
          );
          this.notifyPersistence(
            persistence,
            'Permesso negato',
            `${game.title} non e stato aggiornato.`,
          );
          return;
        }

        this.setCatalogFeedback('success', `${game.title} aggiornato.`);
        this.notifyPersistence(
          persistence,
          'Gioco aggiornato',
          `${game.title} e stato aggiornato.`,
        );
      } else {
        const { persistence } = await this.catalog.createGame(game);
        if (persistence === 'denied') {
          this.setCatalogFeedback('error', 'Permesso negato: solo un admin puo creare giochi.');
          this.notifyPersistence(
            persistence,
            'Permesso negato',
            `${game.title} non e stato aggiunto.`,
          );
          return;
        }

        this.resetFilters();
        this.setCatalogFeedback('success', `${game.title} aggiunto al catalogo.`);
        this.notifyPersistence(
          persistence,
          'Gioco aggiunto',
          `${game.title} e stato aggiunto al catalogo.`,
        );
      }

      this.editorMode.set('closed');
      this.editingGameId.set(null);
      this.form.set(this.emptyForm());
    } catch {
      const message = 'Non e stato possibile salvare il gioco. Riprova tra qualche secondo.';
      this.setCatalogFeedback('error', message);
      this.notifications.error('Salvataggio non riuscito', message);
    } finally {
      this.catalogBusy.set(false);
    }
  }

  protected requestDelete(game: CatalogGame): void {
    if (!this.ensureCatalogPermission()) {
      return;
    }

    this.deleteCandidateId.set(game.id);
    this.setCatalogFeedback('warning', `Conferma l'eliminazione di ${game.title}.`);
    this.notifications.warning(
      'Conferma richiesta',
      `Premi Conferma per eliminare ${game.title} dal catalogo.`,
    );
  }

  protected cancelDelete(): void {
    this.deleteCandidateId.set(null);
    this.clearCatalogFeedback();
  }

  protected async deleteGame(game: CatalogGame): Promise<void> {
    if (this.catalogBusy()) {
      return;
    }

    if (!this.ensureCatalogPermission()) {
      return;
    }

    this.catalogBusy.set(true);
    this.setCatalogFeedback('info', 'Eliminazione in corso...');

    try {
      const persistence = await this.catalog.deleteGame(game.id);
      if (persistence === 'denied') {
        this.setCatalogFeedback('error', 'Permesso negato: solo un admin puo eliminare giochi.');
        this.notifyPersistence(
          persistence,
          'Permesso negato',
          `${game.title} non e stato eliminato.`,
        );
        return;
      }

      if (this.editingGameId() === game.id) {
        this.cancelEditor();
      }

      this.deleteCandidateId.set(null);
      this.setCatalogFeedback('success', `${game.title} eliminato dal catalogo.`);
      this.notifyPersistence(persistence, 'Gioco eliminato', `${game.title} e stato eliminato.`);
    } catch {
      const message = 'Non e stato possibile eliminare il gioco. Riprova tra qualche secondo.';
      this.setCatalogFeedback('error', message);
      this.notifications.error('Eliminazione non riuscita', message);
    } finally {
      this.catalogBusy.set(false);
    }
  }

  private uniqueValues(key: 'genre' | 'platform'): string[] {
    return Array.from(new Set(this.games().map((game) => game[key]))).sort();
  }

  private setCatalogFeedback(tone: NotificationTone, message: string): void {
    this.catalogMessageTone.set(tone);
    this.catalogMessage.set(message);
  }

  private setRawgFeedback(tone: NotificationTone, message: string): void {
    this.rawgMessageTone.set(tone);
    this.rawgMessage.set(message);
  }

  private applyRawgSearchResult(result: RawgSearchResult): void {
    this.rawgResults.set(result.games);
    this.rawgPage.set(result.page);
    this.rawgHasMore.set(result.hasMore);
  }

  private rawgResultsMessage(result: RawgSearchResult): string {
    const loadedResults = this.rawgResults().length;
    const total = result.total ? ` su ${result.total}` : '';
    const suffix = this.rawgHasMore() ? ' Puoi caricarne altri.' : '';

    return `${loadedResults}${total} risultati RAWG mostrati.${suffix}`;
  }

  private rawgFailureMessage(error: unknown): string {
    const message = error instanceof Error ? error.message : '';

    if (message === 'RAWG_API_KEY_UNAVAILABLE') {
      return 'Non riesco a leggere la API key RAWG da Firebase. Verifica di essere admin e riprova.';
    }

    if (message === 'RAWG_API_KEY_MISSING') {
      return 'La API key RAWG non risulta configurata su Firebase.';
    }

    if (message === 'RAWG_NETWORK_UNAVAILABLE') {
      return 'RAWG non e raggiungibile dalla rete in questo momento.';
    }

    if (message === 'RAWG_REQUEST_FAILED_401' || message === 'RAWG_REQUEST_FAILED_403') {
      return 'RAWG ha rifiutato la richiesta: controlla che la API key sia ancora valida.';
    }

    if (message === 'RAWG_REQUEST_FAILED_429') {
      return 'RAWG ha bloccato temporaneamente le richieste: limite di utilizzo raggiunto.';
    }

    return 'Ricerca RAWG non riuscita. Riprova tra qualche secondo.';
  }

  private clearCatalogFeedback(): void {
    this.catalogMessage.set('');
    this.catalogMessageTone.set('info');
  }

  private clearRawgFeedback(): void {
    this.rawgMessage.set('');
    this.rawgMessageTone.set('info');
    this.rawgHasMore.set(false);
  }

  private notifyPersistence(
    persistence: PersistenceResult,
    successTitle: string,
    successMessage: string,
  ): void {
    notifyPersistenceResult(this.notifications, persistence, successTitle, successMessage, {
      deniedTitle: 'Permesso negato',
      deniedMessage: 'Solo un admin puo modificare il catalogo dei giochi.',
    });
  }

  private ensureCatalogPermission(): boolean {
    if (this.canEditCatalog()) {
      return true;
    }

    const message = 'Solo un admin puo creare, modificare o eliminare giochi dal catalogo.';
    this.setCatalogFeedback('warning', message);
    this.notifications.warning('Catalogo in sola lettura', message);

    return false;
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
      description: '',
      coverTheme: 'cover-neon',
      coverImageUrl: '',
      sourceName: '',
      sourceUrl: '',
    };
  }

  private formFromGame(game: CatalogGame): CatalogForm {
    return {
      title: game.title,
      developer: game.developer,
      publisher: game.publisher,
      genre: game.genre,
      platform: game.platform,
      modes: game.modes.join(', '),
      tags: game.tags.join(', '),
      releaseYear: game.releaseYear,
      description: game.description,
      coverTheme: game.coverTheme,
      coverImageUrl: game.coverImageUrl ?? '',
      sourceName: game.sourceName ?? '',
      sourceUrl: game.sourceUrl ?? '',
    };
  }

  private formFromRawg(game: RawgImportedGame, currentForm: CatalogForm): CatalogForm {
    return {
      title: game.title,
      developer: game.developer,
      publisher: game.publisher,
      genre: game.genre,
      platform: game.platform,
      modes: game.modes.join(', '),
      tags: game.tags.join(', '),
      releaseYear: game.releaseYear,
      description: game.description,
      coverTheme: currentForm.coverTheme,
      coverImageUrl: game.coverImageUrl,
      sourceName: game.sourceName,
      sourceUrl: game.sourceUrl,
    };
  }

  private gameFromForm(form: CatalogForm, id: string): CatalogGame {
    const game: CatalogGame = {
      id,
      title: form.title.trim(),
      developer: form.developer.trim(),
      publisher: form.publisher.trim(),
      genre: form.genre.trim(),
      platform: form.platform.trim(),
      modes: this.splitList(form.modes, ['Single player']),
      tags: this.splitList(form.tags),
      releaseYear: clampNumber(form.releaseYear, 1970, 2035),
      description: form.description.trim(),
      coverTheme: form.coverTheme,
    };

    if (form.coverImageUrl.trim()) {
      game.coverImageUrl = form.coverImageUrl.trim();
    }

    if (form.sourceName.trim() && form.sourceUrl.trim()) {
      game.sourceName = form.sourceName.trim();
      game.sourceUrl = form.sourceUrl.trim();
    }

    return game;
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

  protected async updateShelfStatus(
    game: CatalogGame,
    status: GameStatus | 'remove' | '',
  ): Promise<void> {
    if (!status) {
      return;
    }

    if (!this.canEditShelf()) {
      this.notifications.warning(
        'Accesso richiesto',
        'Accedi con un profilo per modificare la tua MyShelf.',
      );
      return;
    }

    if (this.shelfBusyGameId()) {
      return;
    }

    this.shelfBusyGameId.set(game.id);

    try {
      if (status === 'remove') {
        const persistence = await this.catalog.removeFromShelf(game.id);
        this.notifyPersistence(
          persistence,
          'Rimosso da MyShelf',
          `${game.title} è stato rimosso dalla tua MyShelf.`,
        );
      } else {
        const persistence = await this.catalog.updateShelfEntry(game.id, { status });
        this.notifyPersistence(
          persistence,
          'MyShelf aggiornata',
          `${game.title} è stato spostato in ${gameStatusGroupLabel(status)}.`,
        );
      }
    } catch {
      this.notifications.error('Errore', 'Impossibile aggiornare la tua MyShelf.');
    } finally {
      this.shelfBusyGameId.set('');
    }
  }
}
