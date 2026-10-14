import type { HardwareModel } from '@can-i-run-it/domain';
import type { WikiTable } from '../wikipedia/read-wiki-tables';
import { cell, readNumbers, slug, toNumber } from './cells';

export type GpuVendor = 'nvidia' | 'amd' | 'intel';

/** A GPU as read from Wikipedia, before scoring. */
export interface GpuSpec extends HardwareModel {
  kind: 'gpu';
  vendor: GpuVendor;
  fp32Gflops: number;
  bandwidthGBs?: number;
  architecture?: string;
  codeName?: string;
  laptop: boolean;
}

export interface RejectedRow {
  model: string;
  reason: string;
}

/**
 * Reads one Wikipedia GPU table. Columns are found by their header label, since every
 * table generation lays them out differently. A row is only kept if its FP32 throughput
 * can be read; anything else is reported in `rejected` rather than guessed.
 */
export function extractGpus(
  table: WikiTable,
  vendor: GpuVendor,
): { gpus: GpuSpec[]; rejected: RejectedRow[] } {
  const columns = findColumns(table.columns);
  // Intel iGPU tables have no FLOPS column; throughput is derived from the shader count and clock.
  const derived =
    columns.fp32 === -1 && vendor === 'intel' && columns.coreConfig !== -1 && columns.clock !== -1;
  if (columns.model === -1 || (columns.fp32 === -1 && !derived)) return { gpus: [], rejected: [] };

  const gpus: GpuSpec[] = [];
  const rejected: RejectedRow[] = [];
  const fp32Scale = derived ? 1 : /tflops/i.test(table.columns[columns.fp32]) ? 1000 : 1;
  const sectionIsMobile = /mobile|laptop|notebook/i.test(table.section.join(' '));

  const splitModel = table.columns[columns.model + 1] === table.columns[columns.model];
  for (const row of table.rows) {
    const rawModel = splitModel
      ? joinSplitModel(row[columns.model], row[columns.model + 1])
      : row[columns.model];
    if (!rawModel || /^model\b/i.test(rawModel) || rawModel === table.columns[columns.model])
      continue;
    const fp32 = derived
      ? deriveThroughput(row[columns.coreConfig], row[columns.clock])
      : readThroughput(row[columns.fp32]);
    if (fp32 === undefined) {
      rejected.push({ model: rawModel, reason: 'no FP32 throughput' });
      continue;
    }

    const mobileMarket = /mobile|tablet|embedded/i.test(cell(row, columns.market));
    // An iGPU's name is shared by desktop and mobile chips: flag it, but don't rename it.
    const { name, laptop: namedLaptop } = cleanModelName(rawModel, sectionIsMobile);
    const laptop = namedLaptop || mobileMarket;
    const codeName = cell(row, columns.codeName) || (rawModel.match(/\(([^)]*)\)\s*$/)?.[1] ?? '');
    const architecture =
      readArchitecture(vendor, cell(row, columns.architecture), codeName) ??
      (derived ? table.section[0]?.replace(/\s+/g, '') : undefined);
    const directX =
      readNumbers(cell(row, columns.direct3d))[0] ??
      (architecture && DIRECTX_BY_ARCHITECTURE[architecture]);
    const bandwidth = readNumbers(cell(row, columns.bandwidth));
    const vramSizes =
      columns.vram === -1 ? [] : readVramSizes(row[columns.vram], table.columns[columns.vram]);
    const base = {
      kind: 'gpu' as const,
      vendor,
      name,
      fp32Gflops: fp32 * fp32Scale,
      bandwidthGBs: bandwidth.length > 0 ? Math.max(...bandwidth) : undefined,
      architecture,
      codeName: codeName.trim() || undefined,
      directX,
      laptop,
    };
    const id = `${vendor}-${slug(name)}`;
    if (vramSizes.length <= 1) {
      gpus.push({ ...base, id, vramGb: vramSizes[0] });
    } else {
      for (const vramGb of vramSizes) {
        gpus.push({
          ...base,
          id: `${id}-${sizeLabel(vramGb)}`,
          name: `${name} ${sizeLabel(vramGb).toUpperCase()}`,
          vramGb,
        });
      }
    }
  }
  // One iGPU appears once per processor it ships with, at different clocks: keep the slowest.
  return { gpus: mergeDuplicates(derived ? keepSlowest(gpus) : gpus), rejected };
}

/**
 * Same id twice: identical rows are merged. Rows that differ (a GT 1030 on GP108 or on a
 * rebadged GK107) become separate variants named after their code name; resolving the
 * marketing name returns all of them, and the verdict then uses the weakest.
 */
function mergeDuplicates(gpus: GpuSpec[]): GpuSpec[] {
  const groups = new Map<string, GpuSpec[]>();
  for (const gpu of gpus) {
    const group = groups.get(gpu.id) ?? [];
    if (!group.some((other) => sameSpecs(other, gpu))) group.push(gpu);
    groups.set(gpu.id, group);
  }
  return [...groups.values()].flatMap((group) => {
    if (group.length === 1) return group;
    const seen = new Set<string>();
    return group.map((gpu) => {
      const code = shortCodeName(gpu.codeName) || 'variant';
      let id = `${gpu.id}-${slug(code)}`;
      for (let n = 2; seen.has(id); n++) id = `${gpu.id}-${slug(code)}-${n}`;
      seen.add(id);
      return { ...gpu, id, name: `${gpu.name} (${code})` };
    });
  });
}

function keepSlowest(gpus: GpuSpec[]): GpuSpec[] {
  const byId = new Map<string, GpuSpec>();
  for (const gpu of gpus) {
    const existing = byId.get(gpu.id);
    const slowest = !existing || gpu.fp32Gflops < existing.fp32Gflops ? gpu : existing;
    // Mobile only if every chip carrying it is mobile.
    byId.set(gpu.id, { ...slowest, laptop: gpu.laptop && (existing?.laptop ?? true) });
  }
  return [...byId.values()];
}

function sameSpecs(a: GpuSpec, b: GpuSpec): boolean {
  return (
    a.fp32Gflops === b.fp32Gflops &&
    a.vramGb === b.vramGb &&
    a.architecture === b.architecture &&
    a.bandwidthGBs === b.bandwidthGBs
  );
}

/** "GP108-310-A1" → "GP108-310"; "RV770 LE" stays as is. */
function shortCodeName(codeName: string | undefined): string {
  return (codeName ?? '')
    .replace(/\s*\(.*$/, '')
    .replace(/-[A-Z]\d$/, '')
    .trim();
}

/** "Arc 7" + "A770" → "Arc A770"; "Arc Pro" + "B50" → "Arc Pro B50". */
function joinSplitModel(branding: string | undefined, model: string | undefined): string {
  if (!branding || !model || branding === model) return branding ?? model ?? '';
  return `${branding.replace(/\s+\d+$/, '')} ${model}`;
}

interface Columns {
  model: number;
  coreConfig: number;
  clock: number;
  market: number;
  codeName: number;
  architecture: number;
  fp32: number;
  vram: number;
  bandwidth: number;
  direct3d: number;
}

function findColumns(labels: string[]): Columns {
  const find = (test: (label: string) => boolean) =>
    labels.findIndex((label) => test(label.toLowerCase()));
  const model = find((label) => /^(?:branding and )?model|^name$|^graphics$/.test(label));
  const isProcessing = (label: string) =>
    /processing power|tflops|gflops/.test(label) && !/fillrate/.test(label);
  let fp32 = find((label) => isProcessing(label) && /single|fp32/.test(label));
  if (fp32 === -1)
    fp32 = find(
      (label) => isProcessing(label) && !/half|double|fp16|fp64|tensor|int8|ray/.test(label),
    );
  const maxClock = find((label) => /clock.*\/ max/.test(label));
  return {
    model,
    coreConfig: find((label) => /^core config/.test(label)),
    clock:
      maxClock !== -1
        ? maxClock
        : find((label) =>
            /^(?:core (?:render )?)?clock(?: rate| speed)? \(mhz\)$|^core clock/.test(label),
          ),
    market: find((label) => /^market/.test(label)),
    codeName: labels.findIndex((label, index) => index !== model && /code ?name/i.test(label)),
    architecture: find((label) => /^architecture/.test(label)),
    fp32,
    vram: find((label) => /^memory[^/]*\/ size/.test(label)),
    bandwidth: find((label) => /^memory[^/]*\/ bandwidth/.test(label)),
    direct3d: find((label) => /direct3d/.test(label)),
  };
}

/** "5,783 (6,463)" → 6463 (boost); "9,355 10,600" → 10600; "8.0-12.0" (laptop TGP range) → 10. */
function readThroughput(text: string | undefined): number | undefined {
  if (!text) return undefined;
  const range = text.match(/(\d[\d,]*(?:\.\d+)?)\s*[-–]\s*(\d[\d,]*(?:\.\d+)?)/);
  if (range) return (toNumber(range[1]) + toNumber(range[2])) / 2;
  const numbers = readNumbers(text);
  return numbers.length > 0 ? Math.max(...numbers) : undefined;
}

/** Shader ALUs ("192:24:3" → 192) × 2 FLOPs per FMA × top clock in MHz ("350–1150" → 1150). */
function deriveThroughput(
  coreConfig: string | undefined,
  clock: string | undefined,
): number | undefined {
  const alus = readNumbers(coreConfig ?? '')[0];
  const clocks = readNumbers(clock ?? '');
  if (!alus || clocks.length === 0) return undefined;
  return (alus * 2 * Math.max(...clocks)) / 1000;
}

/** Memory sizes in GB; several values are separate board variants. Shared system memory has no VRAM. */
function readVramSizes(text: string | undefined, header: string): number[] {
  if (!text || /system|shared/i.test(text)) return [];
  text = text.replace(/\d+\s*[×x]\s*(?=\d)/g, '');
  const headerUnit = header.match(/\((MB|MiB|GB|GiB)\)/i)?.[1];
  const sizes = [...text.matchAll(/(\d+(?:\.\d+)?)\s*(MB|MiB|GB|GiB)?/gi)].map(
    ([, value, unit]) => {
      const inMb = /^m/i.test(unit ?? headerUnit ?? 'GB');
      return inMb ? Number(value) / 1024 : Number(value);
    },
  );
  return [...new Set(sizes)].filter((size) => size > 0);
}

function sizeLabel(gb: number): string {
  return gb < 1 ? `${Math.round(gb * 1024)}mb` : `${gb}gb`;
}

/** Drops the AMD code name "(Navi 23)" and normalises laptop markers to a trailing "Laptop". */
function cleanModelName(raw: string, sectionIsMobile: boolean): { name: string; laptop: boolean } {
  let name = raw.replace(/\bmobile\s*\/\s*laptop\b/i, 'Laptop');
  const laptopMarker = /\((?:notebook|laptop|mobile)\)/i.test(name);
  name = name
    .replace(/\((?:notebook|laptop|mobile)\)/gi, '')
    .replace(/\s*\([^)]*\)\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
  const namedAsLaptop = /\b(?:laptop|mobile|mobility|notebook|max-q)\b|\d+M\b/i.test(name);
  const laptop = sectionIsMobile || laptopMarker || namedAsLaptop;
  if (laptop && !namedAsLaptop) name = `${name} Laptop`;
  return { name, laptop };
}

const NVIDIA_ARCHITECTURES: [RegExp, string][] = [
  [/\bGB\d/, 'Blackwell'],
  [/\bAD\d/, 'Ada Lovelace'],
  [/\bGA\d/, 'Ampere'],
  [/\bTU\d/, 'Turing'],
  [/\bGV\d/, 'Volta'],
  [/\bGP\d/, 'Pascal'],
  [/\bGM\d/, 'Maxwell'],
  [/\bGK\d/, 'Kepler'],
  [/\bGF\d/, 'Fermi'],
  [/\b(?:GT?2\d\d|G9\d|G8\d)/, 'Tesla'],
  [/\b(?:G7\d|NV4)/, 'Curie'],
];

const AMD_ARCHITECTURES: [RegExp, string][] = [
  [/navi\s*4\d/i, 'RDNA 4'],
  [/navi\s*3\d/i, 'RDNA 3'],
  [/navi\s*2\d/i, 'RDNA 2'],
  [/navi\s*1\d/i, 'RDNA 1'],
  [/vega/i, 'GCN 5'],
  [/polaris|ellesmere|baffin|lexa/i, 'GCN 4'],
  [/tonga|fiji|antigua|iceland|carrizo|tobago/i, 'GCN 3'],
  [/bonaire|hawaii|grenada|vesuvius|kaveri|kabini|saturn|strato/i, 'GCN 2'],
  [/tahiti|pitcairn|cape verde|oland|hainan|curacao|trinidad|malta|new zealand|tahiti/i, 'GCN 1'],
  [/cayman|antilles|blackcomb/i, 'TeraScale 3'],
  [
    /cypress|hemlock|juniper|redwood|cedar|barts|turks|caicos|broadway|madison|park|manhattan|whistler|seymour/i,
    'TeraScale 2',
  ],
  [/^R[V]?[67]\d\d/i, 'TeraScale 1'],
];

const INTEL_ARCHITECTURES: [RegExp, string][] = [
  [/^BMG/i, 'Xe2-HPG'],
  [/^(?:ACM|DG2)/i, 'Xe-HPG'],
  [/^DG1/i, 'Xe-LP'],
];

function readArchitecture(
  vendor: GpuVendor,
  architectureCell: string,
  codeName: string,
): string | undefined {
  const fromColumn = architectureCell.match(
    /\b(RDNA|GCN|TeraScale)(?:\s+(\d)(?:st|nd|rd|th)?\b)?/i,
  );
  if (fromColumn) {
    const [, family, generation] = fromColumn;
    if (generation) return `${family} ${generation}`;
    if (family === 'RDNA') return 'RDNA 1';
  }
  const table = {
    nvidia: NVIDIA_ARCHITECTURES,
    amd: AMD_ARCHITECTURES,
    intel: INTEL_ARCHITECTURES,
  }[vendor];
  return table.find(([pattern]) => pattern.test(codeName.trim()))?.[1];
}

/** Direct3D API level by architecture, for tables that have no Direct3D column. */
const DIRECTX_BY_ARCHITECTURE: Record<string, number> = {
  Blackwell: 12,
  'Ada Lovelace': 12,
  Ampere: 12,
  Turing: 12,
  Volta: 12,
  Pascal: 12,
  Maxwell: 12,
  Kepler: 12,
  Fermi: 12,
  Tesla: 10,
  Curie: 9,
  'RDNA 4': 12,
  'RDNA 3': 12,
  'RDNA 2': 12,
  'RDNA 1': 12,
  'GCN 5': 12,
  'GCN 4': 12,
  'GCN 3': 12,
  'GCN 2': 12,
  'GCN 1': 12,
  'TeraScale 3': 11,
  'TeraScale 2': 11,
  'TeraScale 1': 10.1,
  'Xe2-HPG': 12,
  'Xe-HPG': 12,
  'Xe-LP': 12,
};
