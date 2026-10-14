import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { HardwareCatalog } from '../data/hardware-catalog';
import { HardwarePicker } from '../shared/hardware-picker';
import { AutoDetect } from './auto-detect';
import { UserConfigStore } from './user-config-store';

/** Where the user describes their PC: detected automatically, or picked by hand. */
@Component({
  selector: 'app-config-page',
  imports: [AutoDetect, HardwarePicker, RouterLink, TranslocoPipe],
  templateUrl: './config-page.html',
  styleUrl: './config-page.scss',
})
export class ConfigPage {
  /** `?detect=1` starts the automatic detection right away. */
  readonly detect = input<string>();

  protected readonly catalog = inject(HardwareCatalog);
  protected readonly store = inject(UserConfigStore);
  protected readonly config = this.store.config;

  /** `navigator.deviceMemory` is capped at 8 and rounded, so it only hints at the RAM. */
  protected readonly memoryHint = computed(
    () => (navigator as Navigator & { deviceMemory?: number }).deviceMemory,
  );

  protected setNumber(field: 'ramGb' | 'freeStorageGb', value: string): void {
    const number = Number(value);
    this.store.update({
      [field]: value === '' || !Number.isFinite(number) || number < 0 ? undefined : number,
    });
  }
}
