import {
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  OnInit,
  signal,
  untracked,
} from '@angular/core';
import { resolveHardware } from '@can-i-run-it/domain';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideCheck,
  lucideCircleCheck,
  lucideClipboardPaste,
  lucideCopy,
  lucideScanSearch,
} from '@ng-icons/lucide';
import { TranslocoPipe } from '@jsverse/transloco';
import { HardwareCatalog } from '../data/hardware-catalog';
import { DETECT_COMMAND, DETECT_COMMAND_READABLE } from './detect-command';
import { detectGpuName } from './detect-gpu';
import { applyPcReport, parsePcReport } from './pc-report';
import { UserConfigStore } from './user-config-store';

type Step = 'idle' | 'guide' | 'done';

/**
 * "Detect my PC": fills what the browser can tell at once (the GPU), then guides the full
 * Windows detection — copy a command, paste it in PowerShell, paste the result back here.
 */
@Component({
  selector: 'app-auto-detect',
  imports: [NgIcon, TranslocoPipe],
  viewProviders: [
    provideIcons({
      lucideCheck,
      lucideCircleCheck,
      lucideClipboardPaste,
      lucideCopy,
      lucideScanSearch,
    }),
  ],
  templateUrl: './auto-detect.html',
  styleUrl: './auto-detect.scss',
})
export class AutoDetect implements OnInit {
  /** Start right away (the user arrived through a "Detect my PC" link). */
  readonly autoStart = input(false);

  private readonly catalog = inject(HardwareCatalog);
  private readonly store = inject(UserConfigStore);

  protected readonly command = DETECT_COMMAND;
  protected readonly readableCommand = DETECT_COMMAND_READABLE;
  protected readonly step = signal<Step>('idle');
  protected readonly copied = signal(false);
  protected readonly pasteError = signal(false);
  protected readonly unmatched = signal<string[]>([]);
  protected readonly isWindows = /windows/i.test(navigator.userAgent);
  protected readonly summary = computed(() => this.store.config());
  /** Set until the GPU catalog has loaded, so WebGL detection can run against it. */
  private readonly gpuFillPending = signal(false);

  constructor() {
    effect(() => {
      if (!this.gpuFillPending() || this.catalog.gpus().length === 0) return;
      this.gpuFillPending.set(false);
      untracked(() => this.fillGpuFromBrowser());
    });

    // While the guide is open, a paste anywhere on the page is checked for a report.
    const onPaste = (event: ClipboardEvent) => {
      if (this.step() !== 'guide') return;
      const text = event.clipboardData?.getData('text') ?? '';
      if (this.applyText(text)) event.preventDefault();
    };
    document.addEventListener('paste', onPaste);
    inject(DestroyRef).onDestroy(() => document.removeEventListener('paste', onPaste));
  }

  ngOnInit(): void {
    if (this.autoStart()) this.start();
  }

  /** Fills the GPU from WebGL (once the catalog is there), then opens the guide. */
  protected start(): void {
    this.gpuFillPending.set(true);
    this.step.set('guide');
  }

  private fillGpuFromBrowser(): void {
    if (this.store.saved().gpuId) return;
    const name = detectGpuName();
    const gpu = name ? resolveHardware(name, this.catalog.gpus())[0] : undefined;
    if (gpu) this.store.update({ gpuId: gpu.model.id });
  }

  protected async copyCommand(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.command);
      this.copied.set(true);
    } catch {
      this.copied.set(false);
    }
  }

  /** The "Paste" button: reads the clipboard (the browser may ask for permission). */
  protected async pasteFromClipboard(): Promise<void> {
    try {
      this.applyText(await navigator.clipboard.readText(), true);
    } catch {
      this.pasteError.set(true);
    }
  }

  private applyText(text: string, reportFailure = false): boolean {
    const report = parsePcReport(text);
    if (!report) {
      if (reportFailure || text.trim()) this.pasteError.set(true);
      return false;
    }
    const { config, unmatched } = applyPcReport(report, {
      cpus: this.catalog.cpus(),
      gpus: this.catalog.gpus(),
    });
    this.store.update(config);
    this.unmatched.set(unmatched);
    this.pasteError.set(false);
    this.step.set('done');
    return true;
  }
}
