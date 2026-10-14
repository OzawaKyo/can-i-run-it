import type { HardwareModel } from '@can-i-run-it/domain';
import { readWikiTables } from '../wikipedia/read-wiki-tables';
import { extractCpus, type CpuSpec, type CpuVendor } from './extract-cpus';
import { extractGpus, type GpuSpec, type GpuVendor, type RejectedRow } from './extract-gpus';
import { scoreCpu } from './score-cpu';
import { scoreGpu } from './score-gpu';

export type CatalogPage =
  | { kind: 'gpu'; vendor: GpuVendor; html: string }
  | { kind: 'cpu'; vendor: CpuVendor; html: string };

export interface HardwareCatalog {
  gpus: HardwareModel[];
  cpus: HardwareModel[];
  report: { rejected: RejectedRow[]; unscored: string[] };
}

/**
 * Turns Wikipedia list pages into the app's hardware catalog. Pages are given in order of
 * trust: when two list the same model, the earlier one wins.
 */
export function buildHardwareCatalog(pages: CatalogPage[]): HardwareCatalog {
  const gpus = new Map<string, GpuSpec>();
  const cpus = new Map<string, CpuSpec>();
  const rejected: RejectedRow[] = [];

  for (const page of pages) {
    for (const table of readWikiTables(page.html)) {
      if (page.kind === 'gpu') {
        const result = extractGpus(table, page.vendor);
        rejected.push(...result.rejected);
        for (const gpu of result.gpus) if (!gpus.has(gpu.id)) gpus.set(gpu.id, gpu);
      } else {
        const result = extractCpus(table, page.vendor);
        rejected.push(...result.rejected);
        for (const cpu of result.cpus) if (!cpus.has(cpu.id)) cpus.set(cpu.id, cpu);
      }
    }
  }

  const gpuModels = [...gpus.values()].map((gpu) =>
    compact({
      id: gpu.id,
      kind: 'gpu',
      name: gpu.name,
      score: scoreGpu(gpu),
      vramGb: gpu.vramGb,
      directX: gpu.directX,
      laptop: gpu.laptop,
    }),
  );
  const cpuModels = [...cpus.values()].map((cpu) =>
    compact({ id: cpu.id, kind: 'cpu', name: cpu.name, score: scoreCpu(cpu), laptop: cpu.laptop }),
  );
  const unscored = [...gpuModels, ...cpuModels]
    .filter((model) => model.score === undefined)
    .map((model) => model.id);
  return { gpus: gpuModels, cpus: cpuModels, report: { rejected, unscored } };
}

/** Drops undefined fields and `laptop: false`, keeping the published JSON small. */
function compact(model: HardwareModel): HardwareModel {
  const entries = Object.entries(model).filter(
    ([key, value]) => value !== undefined && !(key === 'laptop' && value === false),
  );
  return Object.fromEntries(entries) as unknown as HardwareModel;
}
