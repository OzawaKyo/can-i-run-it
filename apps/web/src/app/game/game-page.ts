import { NgTemplateOutlet } from '@angular/common';
import { httpResource } from '@angular/common/http';
import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  computeVerdict,
  hydrateRequirements,
  type Component as RequirementComponent,
  type GameRecord,
  type StoredTier,
  type UserConfig,
  type VerdictLevel,
} from '@can-i-run-it/domain';
import { TranslocoPipe } from '@jsverse/transloco';
import { UserConfigStore } from '../config/user-config-store';
import { HardwareCatalog } from '../data/hardware-catalog';
import { size, type Size } from '../shared/size';

/** A value to show: free text, a size, or an i18n key with params. */
type Shown = { text: string } | { size: Size; ssd?: boolean } | { key: string };

interface Row {
  component: RequirementComponent;
  level: VerdictLevel;
  yours?: Shown;
  minimum?: Shown;
  recommended?: Shown;
}

const ORDER: RequirementComponent[] = ['cpu', 'gpu', 'ram', 'vram', 'directX', 'storage'];

/** One game: its requirements side by side with the user's PC, and the verdict. */
@Component({
  selector: 'app-game-page',
  imports: [NgTemplateOutlet, RouterLink, TranslocoPipe],
  templateUrl: './game-page.html',
  styleUrl: './game-page.scss',
})
export class GamePage {
  /** Route parameter. */
  readonly appId = input.required<string>();

  private readonly catalog = inject(HardwareCatalog);
  protected readonly store = inject(UserConfigStore);

  protected readonly game = httpResource<GameRecord>(() =>
    /^\d+$/.test(this.appId()) ? `data/games/${this.appId()}.json` : undefined,
  );

  protected readonly verdict = computed(() => {
    const game = this.game.value();
    if (!game || this.catalog.loading()) return undefined;
    return computeVerdict(
      this.store.config(),
      hydrateRequirements(game.requirements, this.catalog.byId()),
    );
  });

  protected readonly rows = computed<Row[]>(() => {
    const game = this.game.value();
    const verdict = this.verdict();
    if (!game || !verdict) return [];
    const { minimum, recommended } = game.requirements;
    return ORDER.filter((component) => verdict.components[component] !== undefined).map(
      (component) => ({
        component,
        level: verdict.components[component]!,
        yours: yours(component, this.store.config()),
        minimum: required(component, minimum),
        recommended: required(component, recommended),
      }),
    );
  });

  /** Unstructured requirements ("500 mhz processor, 96mb ram…") are shown as published. */
  protected readonly freeText = computed(() => {
    const requirements = this.game.value()?.requirements;
    return [requirements?.minimum?.raw['text'], requirements?.recommended?.raw['text']].filter(
      Boolean,
    ) as string[];
  });

  protected isText(shown: Shown): shown is { text: string } {
    return 'text' in shown;
  }

  protected isSize(shown: Shown): shown is { size: Size; ssd?: boolean } {
    return 'size' in shown;
  }

  protected isKey(shown: Shown): shown is { key: string } {
    return 'key' in shown;
  }
}

function yours(component: RequirementComponent, config: UserConfig): Shown | undefined {
  switch (component) {
    case 'cpu':
      return config.cpu && { text: config.cpu.name };
    case 'gpu':
      return config.gpu && { text: config.gpu.name };
    case 'ram':
      return config.ramGb === undefined ? undefined : { size: size(config.ramGb) };
    case 'vram':
      if (!config.gpu) return undefined;
      // No dedicated VRAM listed: an integrated GPU, sharing system memory.
      return config.gpu.vramGb === undefined
        ? { key: 'game.sharedMemory' }
        : { size: size(config.gpu.vramGb) };
    case 'directX':
      return config.gpu?.directX === undefined
        ? undefined
        : { text: `DirectX ${config.gpu.directX}` };
    case 'storage':
      return config.freeStorageGb === undefined
        ? undefined
        : { size: size(config.freeStorageGb), ssd: config.storageType === 'ssd' };
  }
}

function required(
  component: RequirementComponent,
  tier: StoredTier | undefined,
): Shown | undefined {
  if (!tier) return undefined;
  switch (component) {
    case 'cpu':
    case 'gpu': {
      const { raw, capabilityOnly } = tier[component];
      if (capabilityOnly) return { key: 'game.capabilityOnly' };
      return raw.length ? { text: raw.join(' / ') } : undefined;
    }
    case 'ram':
      return tier.ramGb === undefined ? undefined : { size: size(tier.ramGb) };
    case 'vram':
      return tier.vramGb === undefined ? undefined : { size: size(tier.vramGb) };
    case 'directX':
      return tier.directX === undefined ? undefined : { text: `DirectX ${tier.directX}` };
    case 'storage':
      return tier.storage && { size: size(tier.storage.gb), ssd: tier.storage.ssd };
  }
}
