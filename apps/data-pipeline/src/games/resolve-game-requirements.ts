import {
  resolveHardware,
  type GameRecord,
  type GameRequirements,
  type HardwareModel,
  type RequirementTier,
  type StoredTier,
} from '@can-i-run-it/domain';
import { scoreCpu } from '../hardware/score-cpu';

export interface UnresolvedName {
  kind: 'cpu' | 'gpu';
  name: string;
}

/** Resolves every CPU/GPU alternative of a parsed game against the hardware catalog. */
export function resolveGameRequirements(
  parsed: GameRequirements,
  catalog: { cpus: readonly HardwareModel[]; gpus: readonly HardwareModel[] },
): { requirements: GameRecord['requirements']; unresolved: UnresolvedName[] } {
  const unresolved: UnresolvedName[] = [];
  const resolveTier = (tier: RequirementTier): StoredTier => {
    const cpuIds = tier.cpu.flatMap((name) => {
      const matches = resolveHardware(name, catalog.cpus);
      if (matches.length === 0) unresolved.push({ kind: 'cpu', name });
      return matches.map((match) => match.model.id);
    });
    const gpuIds = tier.gpu.flatMap((gpu) => {
      const matches = resolveHardware(gpu.name, catalog.gpus, { vramGb: gpu.vramGb });
      if (matches.length === 0) unresolved.push({ kind: 'gpu', name: gpu.name });
      return matches.map((match) => match.model.id);
    });
    const statedVram = tier.gpu.map((gpu) => gpu.vramGb).filter((size) => size !== undefined);
    const capabilityDirectX =
      gpuIds.length === 0 ? directXFromCapabilities(tier.gpu.map((gpu) => gpu.name)) : undefined;

    return withoutUndefined({
      cpu: withoutUndefined({
        raw: tier.cpu,
        ids: unique(cpuIds),
        estimatedScore: cpuIds.length === 0 ? estimateGenericCpu(tier.cpu) : undefined,
      }),
      gpu: withoutUndefined({
        raw: tier.gpu.map((gpu) =>
          gpu.vramGb === undefined ? gpu.name : `${gpu.name} ${gpu.vramGb}GB`,
        ),
        ids: unique(gpuIds),
        capabilityOnly: capabilityDirectX !== undefined ? (true as const) : undefined,
      }),
      ramGb: tier.ramGb,
      vramGb: tier.vramGb ?? (statedVram.length > 0 ? Math.min(...statedVram) : undefined),
      directX: tier.directX ?? capabilityDirectX,
      storage: tier.storage,
      raw: tier.raw,
    });
  };

  const requirements: GameRecord['requirements'] = {};
  if (parsed.minimum) requirements.minimum = resolveTier(parsed.minimum);
  if (parsed.recommended) requirements.recommended = resolveTier(parsed.recommended);
  return { requirements, unresolved };
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
