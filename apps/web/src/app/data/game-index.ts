import { httpResource } from '@angular/common/http';
import { Injectable } from '@angular/core';
import type { GameIndexEntry } from '@can-i-run-it/domain';

/** Names and slugs of every game, for search (`data/games/index.json`). */
@Injectable({ providedIn: 'root' })
export class GameIndex {
  private readonly resource = httpResource<GameIndexEntry[]>(() => 'data/games/index.json', {
    defaultValue: [],
  });

  readonly games = this.resource.value.asReadonly();
  readonly loading = this.resource.isLoading;
  readonly failed = this.resource.error;
}
