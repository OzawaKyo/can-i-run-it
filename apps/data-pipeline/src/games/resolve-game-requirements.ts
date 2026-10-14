import {
  resolveHardware,
  type GameRecord,
  type GameRequirements,
  type HardwareModel,
  type GpuRequirement,
  type RequirementTier,
  type StoredComponent,
  type StoredTier,
} from '@can-i-run-it/domain';
import { scoreCpu } from '../hardware/score-cpu';
import { parseDirectX, parseSizeGb } from '../steam/parse-steam-requirements';

export interface UnresolvedName {
  kind: 'cpu' | 'gpu';
  name: string;
}

type Catalog = { cpus: readonly HardwareModel[]; gpus: readonly HardwareModel[] };

/**
 * Resolves every CPU/GPU alternative of a parsed game against the hardware catalog.
 * `fallback` (PCGamingWiki) stands in for a CPU or GPU that Steam doesn't name precisely
 * enough to resolve; the component then records where it came from. Steam wins otherwise.
 */
export function resolveGameRequirements(
  parsed: GameRequirements,
  catalog: Catalog,
  fallback: GameRequirements = {},
): { requirements: GameRecord['requirements']; unresolved: UnresolvedName[] } {
  const unresolved: UnresolvedName[] = [];

  const resolveTier = (
    tier: RequirementTier,
    fallbackTier: RequirementTier | undefined,
  ): StoredTier => {
    let cpu = resolveCpus(tier.cpu, catalog);
    let gpu = resolveGpus(tier.gpu, catalog);
    if (fallbackTier) {
      const fallbackCpu = resolveCpus(fallbackTier.cpu, catalog);
      if (betterThan(fallbackCpu.component, cpu.component)) cpu = fromFallback(fallbackCpu);
      const fallbackGpu = resolveGpus(fallbackTier.gpu, catalog);
      if (betterThan(fallbackGpu.component, gpu.component)) gpu = fromFallback(fallbackGpu);
    }
    unresolved.push(
      ...cpu.unresolved.map((name) => ({ kind: 'cpu' as const, name })),
      ...gpu.unresolved.map((name) => ({ kind: 'gpu' as const, name })),
    );
    const statedVram = tier.gpu
      .map((alternative) => alternative.vramGb)
      .filter((gb) => gb !== undefined);

    return withoutUndefined({
      cpu: cpu.component,
      gpu: gpu.component,
      ramGb: tier.ramGb,
      vramGb: tier.vramGb ?? (statedVram.length > 0 ? Math.min(...statedVram) : gpu.vramGb),
      directX: tier.directX ?? gpu.directX,
      storage: tier.storage,
      raw: tier.raw,
    });
  };

  const requirements: GameRecord['requirements'] = {};
  for (const name of ['minimum', 'recommended'] as const) {
    const tier = parsed[name];
    if (tier) requirements[name] = resolveTier(tier, fallback[name]);
    else if (fallback[name])
      requirements[name] = markFallback(resolveTier(fallback[name], undefined));
  }
  return { requirements, unresolved };
}

interface ResolvedComponent {
  component: StoredComponent;
  unresolved: string[];
  directX?: number;
  /** Memory a generic card description asks for ("256 MB video card"). */
  vramGb?: number;
}

function resolveCpus(names: string[], catalog: Catalog): ResolvedComponent {
  const unresolved: string[] = [];
  const ids = names.flatMap((name) => {
    const matches = resolveHardware(name, catalog.cpus);
    if (matches.length === 0) unresolved.push(name);
    return matches.map((match) => match.model.id);
  });
  return {
    component: withoutUndefined({
      raw: names,
      ids: unique(ids),
      estimatedScore: ids.length === 0 ? estimateCpu(names, catalog.cpus) : undefined,
    }),
    unresolved,
  };
}

/** Each alternative estimated from its family, else its clock; the weakest sets the bar. */
function estimateCpu(names: string[], cpus: readonly HardwareModel[]): number | undefined {
  const estimates = names.flatMap(
    (name) =>
      (isPreCoreCpu(name) ? PRE_CORE_CPU_SCORE : undefined) ??
      familyScore(name, cpus) ??
      estimateGenericCpu([name]) ??
      [],
  );
  return estimates.length > 0 ? Math.min(...estimates) : undefined;
}

/**
 * Pentium III/4/D, Athlon XP/64, Celeron, Sempron: processors from before the Core era,
 * which every catalogued CPU outruns. They get a token score below any Core 2.
 */
const PRE_CORE_CPU_SCORE = 10;

function isPreCoreCpu(name: string): boolean {
  return /\bpentium\s*(?:iii|ii|iv|[234]|d|m|pro)\b|\bp4\b|\bathlon\s*(?:xp|mp|64)\b|\bathlon\s*\d{3,4}\+|\bathlon\b(?!\s*(?:ii|x[24]|gold|silver|pro|\d{3,4}[a-z]))|\bceleron\b|\bsempron\b|\bduron\b/i.test(
    name,
  );
}

/** Processor families games name without a model: pattern in the requirement → catalog models. */
const CPU_FAMILIES: [RegExp, (match: RegExpMatchArray) => RegExp][] = [
  [
    /(?:\bcore\s*|\bintel\s+|\bnew-gen\s+|^)i([3579])\b(?![\s-]*\d{3})/i,
    (m) => new RegExp(`^Core i${m[1]}-\\d`),
  ],
  [/\bryzen\s*([3579])\b(?!\s*\d{3})/i, (m) => new RegExp(`^Ryzen ${m[1]} \\d`)],
  [/\bcore\s*2\s*duo\b(?!\s*[a-z]?\d{3})/i, () => /^Core 2 Duo /],
  [/\bcore\s*2\s*quad\b(?!\s*[a-z]?\d{3})/i, () => /^Core 2 Quad /],
  [/\bphenom\s*(?:ii\s*)?x4\b(?!\s*\d{3})/i, () => /^Phenom (?:II )?X4 /],
];

/**
 * "Intel Core i5" with no model: any i5 meets it, so the bar is the weakest desktop i5 in
 * the catalog. Undefined when the name isn't a known family.
 */
function familyScore(name: string, cpus: readonly HardwareModel[]): number | undefined {
  for (const [pattern, members] of CPU_FAMILIES) {
    const match = name.match(pattern);
    if (!match) continue;
    const memberPattern = members(match);
    const scores = cpus
      .filter((cpu) => !cpu.laptop && cpu.score !== undefined && memberPattern.test(cpu.name))
      .map((cpu) => cpu.score as number);
    if (scores.length > 0) return Math.min(...scores);
  }
  return undefined;
}

function resolveGpus(gpus: GpuRequirement[], catalog: Catalog): ResolvedComponent {
  const unresolved: string[] = [];
  const ids = gpus.flatMap((gpu) => {
    const matches = resolveHardware(gpu.name, catalog.gpus, { vramGb: gpu.vramGb });
    if (matches.length === 0 && !isPreDirectX10(gpu.name)) unresolved.push(gpu.name);
    return matches.map((match) => match.model.id);
  });
  // A card from before DirectX 10 sets the bar so low (the weakest alternative wins) that
  // the requirement is really "a DirectX 9 card", which the catalog's GPUs all exceed.
  const legacy = gpus.some((gpu) => isPreDirectX10(gpu.name));
  const directX = legacy
    ? 9
    : ids.length === 0
      ? directXFromCapabilities(gpus.map((gpu) => gpu.name))
      : undefined;
  // "256 MB", "128 MB video card": no model, only a memory size (and maybe an API level).
  const generic =
    !legacy && ids.length === 0 && gpus.length > 0 && gpus.every((gpu) => isGenericCard(gpu.name));
  const vramGb = generic ? smallestSize(gpus.map((gpu) => gpu.name)) : undefined;
  return {
    component: withoutUndefined({
      raw: gpus.map((gpu) => (gpu.vramGb === undefined ? gpu.name : `${gpu.name} ${gpu.vramGb}GB`)),
      ids: legacy ? [] : unique(ids),
      capabilityOnly: directX !== undefined || generic ? (true as const) : undefined,
    }),
    unresolved: generic ? [] : unresolved,
    directX,
    vramGb,
  };
}

/** A card described without any model: a memory size, an API, "video card", "dedicated". */
function isGenericCard(name: string): boolean {
  if (/\b(?:geforce|radeon|gtx|rtx|quadro|arc\s+[ab]\d|\bhd\s*\d{3,4}|iris|uhd)\b/i.test(name))
    return false;
  return /^\W*\d+(?:\.\d+)?\s*[mg]b\b|\b(?:video|graphics)\s*card|direct\s*3d|dedicated|3d[- ]accelerat|\bany\b|\bcompatible\b|\bcapable\b|opengl|shader/i.test(
    name,
  );
}

function smallestSize(names: string[]): number | undefined {
  const sizes = names.map((name) => parseSizeGb(name)).filter((gb) => gb !== undefined);
  return sizes.length > 0 ? Math.min(...sizes) : undefined;
}

/** Named models beat an estimate or a capability; anything usable beats nothing. */
function betterThan(candidate: StoredComponent, current: StoredComponent): boolean {
  const rank = (component: StoredComponent) =>
    component.ids.length > 0
      ? 2
      : component.estimatedScore !== undefined || component.capabilityOnly
        ? 1
        : 0;
  return rank(candidate) > rank(current);
}

function fromFallback(resolved: ResolvedComponent): ResolvedComponent {
  return { ...resolved, component: { ...resolved.component, source: 'pcgamingwiki' } };
}

function markFallback(tier: StoredTier): StoredTier {
  return {
    ...tier,
    cpu: tier.cpu.raw.length ? { ...tier.cpu, source: 'pcgamingwiki' } : tier.cpu,
    gpu: tier.gpu.raw.length ? { ...tier.gpu, source: 'pcgamingwiki' } : tier.gpu,
  };
}

/**
 * "2.4 GHz Dual Core": scored as a Core 2-era chip at that clock, the era such vague
 * requirements come from. Without a core count, one core is assumed; without a clock
 * ("Quad Core CPU"), 2 GHz.
 */
function estimateGenericCpu(names: string[]): number | undefined {
  const estimates = names.flatMap((name) => {
    const clock = name.match(/(\d+(?:\.\d+)?)\s*(ghz|mhz)/i);
    const cores = /quad|four|4[- ]?cores?\b/i.test(name)
      ? 4
      : /dual|two|2[- ]?cores?\b/i.test(name)
        ? 2
        : /hexa|six|6[- ]?cores?\b/i.test(name)
          ? 6
          : clock
            ? 1
            : undefined;
    if (cores === undefined) return [];
    const ghz = clock ? Number(clock[1]) / (clock[2].toLowerCase() === 'mhz' ? 1000 : 1) : 2;
    if (!ghz) return [];
    return (
      scoreCpu({
        name,
        microarchitecture: 'Core',
        cores,
        threads: cores,
        baseGhz: ghz,
        turboGhz: ghz,
      }) ?? []
    );
  });
  return estimates.length > 0 ? Math.min(...estimates) : undefined;
}

/** Shader Model to the Direct3D version that introduced it. */
const DIRECTX_BY_SHADER_MODEL: Record<string, number> = {
  '2': 9,
  '3': 9,
  '4': 10,
  '5': 11,
  '6': 12,
};

/**
 * The Direct3D level a card description asks for, when it names no model: "DirectX 11",
 * "Direct X9.0c", "DX11", "Shader Model 5.0", "Pixel Shader 2.0", "OpenGL 3.3".
 */
function directXFromCapabilities(names: string[]): number | undefined {
  const text = names.join(' ');
  if (/\b(?:geforce|radeon|gtx|rtx|nvidia\s+\d|ati\s+x|intel\s+(?:hd|uhd|iris))/i.test(text))
    return undefined;
  const directX = parseDirectX(text.match(/(?:direct\s*x|\bdx)\s*(\d+(?:\.\d+)?)/i)?.[1]);
  if (directX) return directX;
  const shaderModel = text.match(/(?:shader\s*model|pixel\s*shader|vertex\s*shader)\s*(\d)/i)?.[1];
  if (shaderModel) return DIRECTX_BY_SHADER_MODEL[shaderModel];
  const openGl = Number(text.match(/opengl\s*(\d)/i)?.[1]);
  if (openGl) return openGl <= 2 ? 9 : openGl === 3 ? 10 : 11;
  return undefined;
}

/** GeForce FX/6/7, Radeon 9000/X/X1000, Intel GMA: graphics cards from before DirectX 10. */
function isPreDirectX10(name: string): boolean {
  const text = name.toLowerCase();
  const nvidia =
    /\b(?:nvidia|geforce)\b/.test(text) &&
    (/\bfx\s*\d{4}\b/.test(text) || /(?<!\b(?:gtx|rtx|gts|gt)\s*)\b[5-7]\d{3}\b/.test(text));
  const ati =
    /\b(?:ati|radeon)\b/.test(text) &&
    /(?<!\brx\s*)\b(?:x1?\d{3,4}|9\d{3}|1\d{3}(?:xt|pro|gt|se)?)\b/.test(text);
  return nvidia || ati || /\bgma\b/.test(text);
}

function unique(ids: string[]): string[] {
  return [...new Set(ids)];
}

function withoutUndefined<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, field]) => field !== undefined)) as T;
}
