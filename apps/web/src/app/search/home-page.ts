import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { searchByName, type GameIndexEntry } from '@can-i-run-it/domain';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideScanSearch, lucideSearch } from '@ng-icons/lucide';
import { TranslocoPipe } from '@jsverse/transloco';
import { UserConfigStore } from '../config/user-config-store';
import { GameIndex } from '../data/game-index';

/** Search for a game; shows popular games and the saved PC at a glance. */
@Component({
  selector: 'app-home-page',
  imports: [NgIcon, RouterLink, TranslocoPipe],
  viewProviders: [provideIcons({ lucideScanSearch, lucideSearch })],
  templateUrl: './home-page.html',
  styleUrl: './home-page.scss',
})
export class HomePage {
  protected readonly index = inject(GameIndex);
  protected readonly store = inject(UserConfigStore);
  protected readonly config = this.store.config;

  protected readonly query = signal('');
  protected readonly results = computed(() => searchByName(this.index.games(), this.query(), 12));
  /** The index is sorted by popularity. */
  protected readonly popular = computed(() => this.index.games().slice(0, 12));

  /** `/game/292030/the-witcher-3` for Steam games, `/game/valorant` when the id is the slug. */
  protected gameLink(game: GameIndexEntry): string[] {
    return game.id === game.slug ? ['/game', game.id] : ['/game', game.id, game.slug];
  }
}
