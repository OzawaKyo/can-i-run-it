import { NgTemplateOutlet } from '@angular/common';
import { httpResource } from '@angular/common/http';
import { Component, computed, effect, inject, input, linkedSignal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { Router, RouterLink } from '@angular/router';
import {
  computeVerdict,
  estimateFps,
  hydrateRequirements,
  linuxStatus,
  type Component as RequirementComponent,
  type GameRecord,
  type LinuxStatus,
  type StoredTier,
  type UserConfig,
  type VerdictLevel,
} from '@can-i-run-it/domain';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideCheck,
  lucideCircleCheck,
  lucideCircleHelp,
  lucideCircleX,
  lucideScanSearch,
  lucideShare2,
  lucideShieldX,
  lucideTriangleAlert,
} from '@ng-icons/lucide';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { detectOs } from '../config/detect-command';
import { toUserConfig, UserConfigStore } from '../config/user-config-store';
import { HardwareCatalog } from '../data/hardware-catalog';
import { size, type Size } from '../shared/size';
import { VerdictBadge } from '../shared/verdict-badge';
import { reportIssueUrl } from './report-issue';
import { decodeSharedPc, encodeSharedPc } from './share';

/** A value to show: free text (with its source when not Steam), a size, or an i18n key. */
type Shown = { text: string; viaPcgw?: boolean } | { size: Size; ssd?: boolean } | { key: string };

interface Row {
  component: RequirementComponent;
  level: VerdictLevel;
  yours?: Shown;
  minimum?: Shown;
  recommended?: Shown;
}

const LINUX_ICONS: Record<LinuxStatus, string> = {
  native: 'lucideCircleCheck',
  works: 'lucideCircleCheck',
  issues: 'lucideTriangleAlert',
  broken: 'lucideCircleX',
  blocked: 'lucideShieldX',
  unknown: 'lucideCircleHelp',
};

const ORDER: RequirementComponent[] = ['cpu', 'gpu', 'ram', 'vram', 'directX', 'storage'];

/**
 * One game: its requirements side by side with the user's PC, and the verdict. With a `pc`
 * query parameter (a shared link), the PC it describes is shown instead of the user's own.
 */
@Component({
  selector: 'app-game-page',
  imports: [NgIcon, NgTemplateOutlet, RouterLink, TranslocoPipe, VerdictBadge],
  viewProviders: [
    provideIcons({
      lucideCheck,
      lucideCircleCheck,
      lucideCircleHelp,
      lucideCircleX,
      lucideScanSearch,
      lucideShare2,
      lucideShieldX,
      lucideTriangleAlert,
    }),
  ],
  templateUrl: './game-page.html',
  styleUrl: './game-page.scss',
})
export class GamePage {
  /** Route parameter. */
  readonly id = input.required<string>();
  /** Query parameter of a shared link: the PC to show (see `encodeSharedPc`). */
  readonly pc = input<string>();

  private readonly catalog = inject(HardwareCatalog);
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);
  protected readonly store = inject(UserConfigStore);

  constructor() {
    const title = inject(Title);
    effect(() => {
      const name = this.game.value()?.name;
      if (name) title.setTitle(`${name} — Can I Run It?`);
    });
  }

  /** The PC of a shared link, when the page was opened from one. */
  protected readonly sharedPc = computed(() => decodeSharedPc(this.pc()));

  /** The PC the verdict is about: the shared one, else the user's. */
  protected readonly viewed = computed(() => {
    const shared = this.sharedPc();
    return shared ? toUserConfig(shared, this.catalog.byId()) : this.store.config();
  });

  protected readonly yoursLabel = computed(() => (this.sharedPc() ? 'game.theirs' : 'game.yours'));

  /** Back to idle whenever another game or PC is shown. */
  protected readonly shareState = linkedSignal<unknown, 'idle' | 'copied' | 'failed'>({
    source: () => [this.id(), this.pc()],
    computation: () => 'idle',
  });

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
    return resolved && computeVerdict(this.viewed(), resolved);
  });

  protected readonly fpsSettings = ['low', 'high'] as const;

  protected readonly fps = computed(() => {
    const resolved = this.resolved();
    return resolved ? estimateFps(this.viewed(), resolved) : {};
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
        yours: yours(component, this.viewed()),
        minimum: required(component, minimum),
        recommended: required(component, recommended),
      }),
    );
  });

  /** Linux visitors see Linux support first; others find it below the requirements. */
  protected readonly onLinux = detectOs(navigator.userAgent) === 'linux';

  protected readonly linux = computed(() => {
    const game = this.game.value();
    if (!game) return undefined;
    const status = linuxStatus(game.linux);
    return { status, icon: LINUX_ICONS[status], support: game.linux ?? {} };
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

  /**
   * Shares a link to this game with the PC on display: the system share sheet on phones,
   * else the clipboard (a short message and the link, ready to paste in a chat).
   */
  protected async share(): Promise<void> {
    const game = this.game.value();
    const verdict = this.verdict();
    if (!game || !verdict) return;
    const url = `${location.origin}${location.pathname}?pc=${encodeSharedPc(this.sharedPc() ?? this.store.saved())}`;
    const text = this.transloco.translate('share.text', {
      game: game.name,
      verdict: this.transloco.translate(`verdict.${verdict.overall}`),
    });
    try {
      if (navigator.share && matchMedia('(pointer: coarse)').matches) {
        await navigator.share({ title: game.name, text, url });
        return;
      }
      await navigator.clipboard.writeText(`${text} ${url}`);
      this.shareState.set('copied');
    } catch (error) {
      // Closing the share sheet is not a failure.
      if (!(error instanceof DOMException && error.name === 'AbortError'))
        this.shareState.set('failed');
    }
  }

  /** Makes the shared PC the user's own, then leaves the shared view. */
  protected keepSharedPc(): void {
    const shared = this.sharedPc();
    if (!shared) return;
    this.store.saved.set(shared);
    this.showOwnPc();
  }

  protected showOwnPc(): void {
    void this.router.navigate([], { queryParams: { pc: null }, queryParamsHandling: 'merge' });
  }

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
