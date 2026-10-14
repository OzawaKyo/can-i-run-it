import { Component, computed, input } from '@angular/core';
import type { VerdictLevel } from '@can-i-run-it/domain';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideCheck,
  lucideCircleCheck,
  lucideCircleHelp,
  lucideCircleX,
  lucideTriangleAlert,
} from '@ng-icons/lucide';
import { TranslocoPipe } from '@jsverse/transloco';

const ICONS: Record<VerdictLevel, string> = {
  below: 'lucideCircleX',
  borderline: 'lucideTriangleAlert',
  minimum: 'lucideCheck',
  recommended: 'lucideCircleCheck',
  unknown: 'lucideCircleHelp',
};

/** A verdict as a coloured pill with an icon, so the level never relies on colour alone. */
@Component({
  selector: 'app-verdict-badge',
  imports: [NgIcon, TranslocoPipe],
  viewProviders: [
    provideIcons({
      lucideCheck,
      lucideCircleCheck,
      lucideCircleHelp,
      lucideCircleX,
      lucideTriangleAlert,
    }),
  ],
  template: `<span class="badge" [class.big]="big()" [attr.data-level]="level()">
    <ng-icon [name]="icon()" aria-hidden="true" />{{ 'verdict.' + level() | transloco }}
  </span>`,
})
export class VerdictBadge {
  readonly level = input.required<VerdictLevel>();
  readonly big = input(false);
  protected readonly icon = computed(() => ICONS[this.level()]);
}
