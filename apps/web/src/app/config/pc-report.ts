import { resolveHardware, type HardwareModel } from '@can-i-run-it/domain';
import type { SavedConfig } from './user-config-store';

/** Marks the text the detection command copies, so a stray paste is never mistaken for it. */
export const PC_REPORT_PREFIX = 'can-i-run-it:';

/** What the detection command reports about the PC, before matching it to the catalog. */
export interface PcReport {
  cpu?: string;
  gpus: string[];
  ramGb?: number;
  freeStorageGb?: number;
  storageType?: 'ssd' | 'hdd';
}

const MAX_NAME_LENGTH = 200;

/**
 * Reads a pasted report: `can-i-run-it:{"v":1,"cpu":…,"gpus":[…],"ramGb":…,"freeGb":…,"disk":…}`.
 * The text comes from the clipboard, so every field is checked and anything unexpected is
 * dropped; undefined when the text is not a report at all.
 */
export function parsePcReport(text: string): PcReport | undefined {
  const trimmed = text.trim();
  if (!trimmed.startsWith(PC_REPORT_PREFIX)) return undefined;
  let data: unknown;
  try {
    data = JSON.parse(trimmed.slice(PC_REPORT_PREFIX.length));
  } catch {
    return undefined;
  }
  if (typeof data !== 'object' || data === null || (data as { v?: unknown }).v !== 1)
    return undefined;
  const fields = data as Record<string, unknown>;

  const gpuList = Array.isArray(fields['gpus']) ? fields['gpus'] : [fields['gpus']];
  const report: PcReport = { gpus: gpuList.map(name).filter((gpu) => gpu !== undefined) };
  const cpu = name(fields['cpu']);
  const ramGb = amount(fields['ramGb'], 4096);
  const freeStorageGb = amount(fields['freeGb'], 1_000_000);
  const storageType = { SSD: 'ssd', SCM: 'ssd', HDD: 'hdd' }[
    String(fields['disk']).toUpperCase()
  ] as 'ssd' | 'hdd' | undefined;
  if (cpu) report.cpu = cpu;
  if (ramGb !== undefined) report.ramGb = ramGb;
  if (freeStorageGb !== undefined) report.freeStorageGb = freeStorageGb;
  if (storageType) report.storageType = storageType;
  return report;
}

function name(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed && trimmed.length <= MAX_NAME_LENGTH ? trimmed : undefined;
}

function amount(value: unknown, max: number): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= max
    ? Math.round(value)
    : undefined;
}

/** Display adapters that aren't graphics cards (remote desktop, streaming, fallback drivers). */
const VIRTUAL_ADAPTER =
  /basic display|basic render|virtual|remote|parsec|citrix|vmware|virtualbox|hyper-v|displaylink|spacedesk/i;

/**
 * Matches a report against the catalog. With several GPUs (integrated + dedicated), the
 * fastest wins. Names the catalog doesn't know are returned so the user can pick by hand.
 */
export function applyPcReport(
  report: PcReport,
  catalog: { cpus: readonly HardwareModel[]; gpus: readonly HardwareModel[] },
): { config: SavedConfig; unmatched: string[] } {
  const config: SavedConfig = {};
  const unmatched: string[] = [];

  if (report.cpu) {
    const cpu = resolveHardware(report.cpu, catalog.cpus)[0]?.model;
    if (cpu) config.cpuId = cpu.id;
    else unmatched.push(report.cpu);
  }

  const gpus: HardwareModel[] = [];
  for (const gpuName of report.gpus.filter((gpu) => !VIRTUAL_ADAPTER.test(gpu))) {
    // Several variants may match (e.g. memory sizes): the weakest is the safe assumption.
    const variants = resolveHardware(gpuName, catalog.gpus).map((match) => match.model);
    const weakest = variants.sort((a, b) => (a.score ?? 0) - (b.score ?? 0))[0];
    if (weakest) gpus.push(weakest);
    else unmatched.push(gpuName);
  }
  const fastest = gpus.sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];
  if (fastest) config.gpuId = fastest.id;

  if (report.ramGb !== undefined) config.ramGb = report.ramGb;
  if (report.freeStorageGb !== undefined) config.freeStorageGb = report.freeStorageGb;
  if (report.storageType) config.storageType = report.storageType;
  return { config, unmatched };
}
