import type { HardwareModel } from './hardware';
import type { StorageRequirement } from './requirements';

export interface UserConfig {
  cpu?: HardwareModel;
  gpu?: HardwareModel;
  ramGb?: number;
  freeStorageGb?: number;
  storageType?: 'ssd' | 'hdd';
}

/**
 * A requirement tier whose CPU/GPU names were resolved against the catalog.
 * `undefined`: the game states no requirement. `'unresolved'`: it does, but we could not read it.
 */
export interface ResolvedTier {
  cpu?: HardwareModel[] | 'unresolved';
  gpu?: HardwareModel[] | 'unresolved';
  ramGb?: number;
  vramGb?: number;
  directX?: number;
  storage?: StorageRequirement;
}

export interface ResolvedRequirements {
  minimum?: ResolvedTier;
  recommended?: ResolvedTier;
}

/** Worst to best. */
export type VerdictLevel = 'below' | 'unknown' | 'borderline' | 'minimum' | 'recommended';

export type Component = 'cpu' | 'gpu' | 'ram' | 'vram' | 'directX' | 'storage';

export interface Verdict {
  overall: VerdictLevel;
  components: Partial<Record<Component, VerdictLevel>>;
}

const WORST_FIRST: VerdictLevel[] = ['below', 'unknown', 'borderline', 'minimum', 'recommended'];

export function computeVerdict(user: UserConfig, requirements: ResolvedRequirements): Verdict {
  const { minimum, recommended } = requirements;
  const components: Verdict['components'] = {};
  if (!minimum) return { overall: 'unknown', components };

  if (minimum.cpu !== undefined)
    components.cpu = compareModel(user.cpu, minimum.cpu, recommended?.cpu);
  if (minimum.gpu !== undefined)
    components.gpu = compareModel(user.gpu, minimum.gpu, recommended?.gpu);
  if (minimum.ramGb !== undefined)
    components.ram = compareAmount(user.ramGb, minimum.ramGb, recommended?.ramGb);
  const minVram = requiredVram(minimum);
  if (minVram !== undefined) {
    components.vram = compareAmount(
      user.gpu?.vramGb,
      minVram,
      recommended && requiredVram(recommended),
    );
  }
  if (minimum.directX !== undefined) {
    components.directX = compareAmount(user.gpu?.directX, minimum.directX, recommended?.directX);
  }
  if (minimum.storage !== undefined)
    components.storage = compareStorage(user, minimum.storage, recommended?.storage);
  return { overall: worst(Object.values(components)), components };
}

/** Plain quantities (GB, Direct3D version) are exact: no estimation, so no borderline zone. */
function compareAmount(
  owned: number | undefined,
  minimum: number,
  recommended: number | undefined,
): VerdictLevel {
  if (owned === undefined) return 'unknown';
  if (owned < minimum) return 'below';
  return recommended !== undefined && owned >= recommended ? 'recommended' : 'minimum';
}

function compareStorage(
  user: UserConfig,
  minimum: StorageRequirement,
  recommended: StorageRequirement | undefined,
): VerdictLevel {
  if (minimum.ssd) {
    if (user.storageType === undefined) return 'unknown';
    if (user.storageType === 'hdd') return 'below';
  }
  const ssdOk = !recommended?.ssd || user.storageType === 'ssd';
  return compareAmount(user.freeStorageGb, minimum.gb, ssdOk ? recommended?.gb : undefined);
}

/** The tier's stated VRAM, else the smallest VRAM among its listed GPUs. */
function requiredVram(tier: ResolvedTier): number | undefined {
  if (tier.vramGb !== undefined) return tier.vramGb;
  if (tier.gpu === undefined || tier.gpu === 'unresolved') return undefined;
  const sizes = tier.gpu.map((model) => model.vramGb).filter((size) => size !== undefined);
  return sizes.length > 0 ? Math.min(...sizes) : undefined;
}

function compareModel(
  owned: HardwareModel | undefined,
  minimum: HardwareModel[] | 'unresolved',
  recommended: HardwareModel[] | 'unresolved' | undefined,
): VerdictLevel {
  const minScore = weakestScore(minimum);
  if (owned?.score === undefined || minScore === undefined) return 'unknown';
  if (recommended !== undefined && lists(recommended, owned)) return 'recommended';
  if (!lists(minimum, owned)) {
    // Scores are estimates (±20-25%): don't call a near miss either way.
    const margin = owned.laptop ? LAPTOP_MARGIN : DESKTOP_MARGIN;
    if (owned.score < minScore * (1 - margin)) return 'below';
    if (owned.score < minScore * (1 + margin)) return 'borderline';
  }
  const recScore = recommended === undefined ? undefined : weakestScore(recommended);
  return recScore !== undefined && owned.score >= recScore ? 'recommended' : 'minimum';
}

const DESKTOP_MARGIN = 0.1;
const LAPTOP_MARGIN = 0.15;

function lists(models: HardwareModel[] | 'unresolved', owned: HardwareModel): boolean {
  return models !== 'unresolved' && models.some((model) => model.id === owned.id);
}

/** Any one alternative satisfies a tier, so the tier's bar is its weakest scored alternative. */
function weakestScore(models: HardwareModel[] | 'unresolved'): number | undefined {
  if (models === 'unresolved') return undefined;
  const scores = models.map((model) => model.score).filter((score) => score !== undefined);
  return scores.length > 0 ? Math.min(...scores) : undefined;
}

function worst(levels: VerdictLevel[]): VerdictLevel {
  if (levels.length === 0) return 'unknown';
  return levels.reduce((a, b) => (WORST_FIRST.indexOf(a) <= WORST_FIRST.indexOf(b) ? a : b));
}
