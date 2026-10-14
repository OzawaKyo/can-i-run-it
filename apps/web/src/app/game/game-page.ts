import { NgTemplateOutlet } from '@angular/common';
import { httpResource } from '@angular/common/http';
import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  computeVerdict,
  estimateFps,
  hydrateRequirements,
  type Component as RequirementComponent,
  type GameRecord,
  type StoredTier,
  type UserConfig,
  type VerdictLevel,
} from '@can-i-run-it/domain';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideScanSearch } from '@ng-icons/lucide';
import { TranslocoPipe } from '@jsverse/transloco';
import { UserConfigStore } from '../config/user-config-store';
import { HardwareCatalog } from '../data/hardware-catalog';
import { size, type Size } from '../shared/size';
import { VerdictBadge } from '../shared/verdict-badge';
import { reportIssueUrl } from './report-issue';

/** A value to show: free text, a size, or an i18n key with params. */
/** A value to show: free text (with its source when not Steam), a size, or an i18n key. */
type Shown = { text: string; viaPcgw?: boolean } | { size: Size; ssd?: boolean } | { key: string };

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
  imports: [NgIcon, NgTemplateOutlet, RouterLink, TranslocoPipe, VerdictBadge],
  viewProviders: [provideIcons({ lucideScanSearch })],
  templateUrl: './game-page.html',
  styleUrl: './game-page.scss',
})
export class GamePage {
  /** Route parameter. */
  readonly id = input.required<string>();

  private readonly catalog = inject(HardwareCatalog);
  protected readonly store = inject(UserConfigStore);

  protected readonly game = httpResource<GameRecord>(() =>
    /^[a-z0-9-]+$/.test(this.id()) ? `data/games/${this.id()}.json` : undefined,
  );

  /** The game's requirements with catalog models in place of ids. */
  private readonly resolved = computed(() => {
    const game = this.game.value();
    if (!game || this.catalog.loading()) return undefined;
    return hydrateRequirements(game.requirements, this.catalog.byId());
  });

  protected readonly verdict = computed(() => {
    const resolved = this.resolved();
    return resolved && computeVerdict(this.store.config(), resolved);
  });

  protected readonly fpsSettings = ['low', 'high'] as const;

  protected readonly fps = computed(() => {
    const resolved = this.resolved();
    return resolved ? estimateFps(this.store.config(), resolved) : {};
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

  protected readonly reportUrl = computed(() => {
    const game = this.game.value();
    return game && reportIssueUrl(game);
  });

  /** Unstructured requirements ("500 mhz processor, 96mb ram…") are shown as published. */
  protected readonly freeText = computed(() => {
    const requirements = this.game.value()?.requirements;
    return [requirements?.minimum?.raw['text'], requirements?.recommended?.raw['text']].filter(
      Boolean,
    ) as string[];
  });

  /** PCGamingWiki filled in a component Steam didn't name precisely: attribution required. */
  protected readonly usesPcgw = computed(() => {
    const { minimum, recommended } = this.game.value()?.requirements ?? {};
    return [minimum, recommended].some(
      (tier) => tier?.cpu.source === 'pcgamingwiki' || tier?.gpu.source === 'pcgamingwiki',
    );
  });

  protected isText(shown: Shown): shown is { text: string; viaPcgw?: boolean } {
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
      const { raw, capabilityOnly, source } = tier[component];
      if (capabilityOnly) return { key: 'game.capabilityOnly' };
      return raw.length ? { text: raw.join(' / '), viaPcgw: source === 'pcgamingwiki' } : undefined;
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
