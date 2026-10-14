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
      vramGb: tier.vramGb ?? (statedVram.length > 0 ? Math.min(...statedVram) : undefined),
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
      estimatedScore: ids.length === 0 ? estimateGenericCpu(names) : undefined,
    }),
    unresolved,
  };
}

function resolveGpus(gpus: GpuRequirement[], catalog: Catalog): ResolvedComponent {
  const unresolved: string[] = [];
  const ids = gpus.flatMap((gpu) => {
    const matches = resolveHardware(gpu.name, catalog.gpus, { vramGb: gpu.vramGb });
    if (matches.length === 0) unresolved.push(gpu.name);
    return matches.map((match) => match.model.id);
  });
  const directX =
    ids.length === 0 ? directXFromCapabilities(gpus.map((gpu) => gpu.name)) : undefined;
  return {
    component: withoutUndefined({
      raw: gpus.map((gpu) => (gpu.vramGb === undefined ? gpu.name : `${gpu.name} ${gpu.vramGb}GB`)),
      ids: unique(ids),
      capabilityOnly: directX !== undefined ? (true as const) : undefined,
    }),
    unresolved,
    directX,
  };
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
 * requirements come from. Without a core count, one core is assumed.
 */
function estimateGenericCpu(names: string[]): number | undefined {
  const estimates = names.flatMap((name) => {
    const ghz = Number(name.match(/(\d+(?:\.\d+)?)\s*ghz/i)?.[1]);
    if (!ghz) return [];
    const cores = /quad|4[- ]core/i.test(name)
      ? 4
      : /dual|2[- ]core/i.test(name)
        ? 2
        : /hexa|6[- ]core/i.test(name)
          ? 6
          : 1;
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

/** "DirectX 11+ capable card" or "Shader Model 5.0" with no model named → Direct3D 11. */
function directXFromCapabilities(names: string[]): number | undefined {
  const text = names.join(' ');
  if (/\b(?:geforce|radeon|gtx|rtx|nvidia\s+\d|ati\s+x|intel\s+(?:hd|uhd|iris))/i.test(text))
    return undefined;
  const directX = Number(text.match(/directx\s*(\d+(?:\.\d+)?)/i)?.[1]);
  if (directX) return directX;
  const shaderModel = text.match(/shader\s*model\s*(\d)/i)?.[1];
  return shaderModel ? DIRECTX_BY_SHADER_MODEL[shaderModel] : undefined;
}

function unique(ids: string[]): string[] {
  return [...new Set(ids)];
}

function withoutUndefined<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, field]) => field !== undefined)) as T;
}
