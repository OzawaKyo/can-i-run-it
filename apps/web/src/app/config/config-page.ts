import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { resolveHardware } from '@can-i-run-it/domain';
import { TranslocoPipe } from '@jsverse/transloco';
import { HardwareCatalog } from '../data/hardware-catalog';
import { HardwarePicker } from '../shared/hardware-picker';
import { detectGpuName } from './detect-gpu';
import { UserConfigStore } from './user-config-store';

/** Where the user describes their PC; the GPU can be pre-filled from the browser. */
@Component({
  selector: 'app-config-page',
  imports: [HardwarePicker, RouterLink, TranslocoPipe],
  templateUrl: './config-page.html',
  styleUrl: './config-page.scss',
})
export class ConfigPage {
  protected readonly catalog = inject(HardwareCatalog);
  protected readonly store = inject(UserConfigStore);
  protected readonly config = this.store.config;

  /** Outcome of the last detection, shown under the button. */
  protected readonly detection = signal<{ name?: string; found: boolean } | undefined>(undefined);
  /** `navigator.deviceMemory` is capped at 8 and rounded, so it only hints at the RAM. */
  protected readonly memoryHint = computed(
    () => (navigator as Navigator & { deviceMemory?: number }).deviceMemory,
  );

  protected detectGpu(): void {
    const name = detectGpuName();
    const match = name ? resolveHardware(name, this.catalog.gpus())[0] : undefined;
    if (match) this.store.update({ gpuId: match.model.id });
    this.detection.set({ name, found: !!match });
  }

  protected setNumber(field: 'ramGb' | 'freeStorageGb', value: string): void {
    const number = Number(value);
    this.store.update({
      [field]: value === '' || !Number.isFinite(number) || number < 0 ? undefined : number,
    });
  }
}
