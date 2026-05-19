import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterOutlet } from '@angular/router';
import { GameCatalog } from './services/game-catalog';
import { Game, GameStatus } from './models/game';

@Component({
  selector: 'app-root',
  imports: [FormsModule, RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  private readonly catalog = inject(GameCatalog);

  protected readonly appName = 'GameShelf';
  protected readonly searchTerm = signal('');
  protected readonly selectedGenre = signal('Tutti');
  protected readonly selectedPlatform = signal('Tutte');
  protected readonly selectedStatus = signal<'Tutti' | GameStatus>('Tutti');

  protected readonly games = this.catalog.games;
  protected readonly genres = computed(() => this.uniqueValues('genre'));
  protected readonly platforms = computed(() => this.uniqueValues('platform'));
  protected readonly statuses: Array<'Tutti' | GameStatus> = [
    'Tutti',
    'Wishlist',
    'Backlog',
    'In corso',
    'Completato'
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
        game.description.toLowerCase().includes(term);
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

  protected ratingStars(game: Game): string {
    return game.rating === 0 ? 'Da valutare' : '★'.repeat(game.rating);
  }

  private uniqueValues(key: 'genre' | 'platform'): string[] {
    return Array.from(new Set(this.games().map((game) => game[key]))).sort();
  }
}
