import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { searchByName } from '@can-i-run-it/domain';
import { TranslocoPipe } from '@jsverse/transloco';
import { UserConfigStore } from '../config/user-config-store';
import { GameIndex } from '../data/game-index';

/** Search for a game; shows the saved config at a glance. */
@Component({
  selector: 'app-home-page',
  imports: [RouterLink, TranslocoPipe],
  templateUrl: './home-page.html',
  styleUrl: './home-page.scss',
})
export class HomePage {
  protected readonly index = inject(GameIndex);
  protected readonly store = inject(UserConfigStore);
  protected readonly config = this.store.config;

  protected readonly query = signal('');
  protected readonly results = computed(() => searchByName(this.index.games(), this.query(), 12));
}
