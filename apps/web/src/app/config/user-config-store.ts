import { computed, effect, inject, Injectable, signal } from '@angular/core';
import type { HardwareModel, UserConfig } from '@can-i-run-it/domain';
import { HardwareCatalog } from '../data/hardware-catalog';

/** What the user told us about their PC, as saved in the browser. */
export interface SavedConfig {
  cpuId?: string;
  gpuId?: string;
  ramGb?: number;
  freeStorageGb?: number;
  storageType?: 'ssd' | 'hdd';
}

const STORAGE_KEY = 'can-i-run-it.config';

/** The user's PC, kept in localStorage so it survives visits. */
@Injectable({ providedIn: 'root' })
export class UserConfigStore {
  private readonly catalog = inject(HardwareCatalog);

  readonly saved = signal<SavedConfig>(load());

  /** The saved config with CPU and GPU looked up in the catalog, as `computeVerdict` takes it. */
  readonly config = computed(() => toUserConfig(this.saved(), this.catalog.byId()));

  readonly isEmpty = computed(() =>
    Object.values(this.saved()).every((value) => value === undefined),
  );

  constructor() {
    effect(() => save(this.saved()));
  }

  update(changes: Partial<SavedConfig>): void {
    this.saved.update((current) => ({ ...current, ...changes }));
  }
}

/** A saved config with CPU and GPU looked up in the catalog, as `computeVerdict` takes it. */
export function toUserConfig(
  { cpuId, gpuId, ...rest }: SavedConfig,
  models: ReadonlyMap<string, HardwareModel>,
): UserConfig {
  return {
    ...rest,
    cpu: cpuId ? models.get(cpuId) : undefined,
    gpu: gpuId ? models.get(gpuId) : undefined,
  };
}

function load(): SavedConfig {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    return typeof parsed === 'object' && parsed !== null ? (parsed as SavedConfig) : {};
  } catch {
    return {};
  }
}

function save(config: SavedConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    // Storage unavailable (private mode): the config lasts for this visit only.
  }
}
