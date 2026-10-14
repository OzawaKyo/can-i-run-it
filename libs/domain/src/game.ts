import type { HardwareModel } from './hardware';
import type { StorageRequirement } from './requirements';
import type { ResolvedRequirements, ResolvedTier } from './verdict';

/** A CPU or GPU requirement as published: the names given, and the catalog ids they resolved to. */
export interface StoredComponent {
  raw: string[];
  ids: string[];
  /** CPU named only by clock and core count ("2.4 GHz Dual Core"): a score estimated from them. */
  estimatedScore?: number;
  /** GPU named only by capabilities ("DirectX 11 card"): checked through `directX`/`vramGb` instead. */
  capabilityOnly?: true;
}

export interface StoredTier {
  cpu: StoredComponent;
  gpu: StoredComponent;
  ramGb?: number;
  vramGb?: number;
  directX?: number;
  storage?: StorageRequirement;
  /** Original text of each line, for display. A tier with only `text` was unstructured. */
  raw: Record<string, string>;
}

/** One `data/games/<appid>.json` file. */
export interface GameRecord {
  appid: number;
  name: string;
  slug: string;
  source: 'steam';
  updatedAt: string;
  /** Banner served by Steam's CDN (460×215). */
  headerImage?: string;
  requirements: { minimum?: StoredTier; recommended?: StoredTier };
}

/** One entry of `data/games/index.json`, the search index. */
export interface GameIndexEntry {
  appid: number;
  name: string;
  slug: string;
  /** Popularity, 1 = most popular; the index is sorted by it. */
  rank: number;
  /** Small capsule served by Steam's CDN (231×87). */
  capsuleImage?: string;
}

/** Turns a stored game's requirements into what `computeVerdict` takes, looking ids up in the catalog. */
export function hydrateRequirements(
  requirements: GameRecord['requirements'],
  modelsById: ReadonlyMap<string, HardwareModel>,
): ResolvedRequirements {
  const hydrated: ResolvedRequirements = {};
  if (requirements.minimum) hydrated.minimum = hydrateTier(requirements.minimum, modelsById);
  if (requirements.recommended)
    hydrated.recommended = hydrateTier(requirements.recommended, modelsById);
  return hydrated;
}

function hydrateTier(
  tier: StoredTier,
  modelsById: ReadonlyMap<string, HardwareModel>,
): ResolvedTier {
  const unstructured = tier.raw['text'] !== undefined;
  const resolved: ResolvedTier = {};
  const cpu = hydrateComponent('cpu', tier.cpu, unstructured, modelsById);
  const gpu = hydrateComponent('gpu', tier.gpu, unstructured, modelsById);
  if (cpu !== undefined) resolved.cpu = cpu;
  if (gpu !== undefined) resolved.gpu = gpu;
  if (tier.ramGb !== undefined) resolved.ramGb = tier.ramGb;
  if (tier.vramGb !== undefined) resolved.vramGb = tier.vramGb;
  if (tier.directX !== undefined) resolved.directX = tier.directX;
  if (tier.storage !== undefined) resolved.storage = tier.storage;
  return resolved;
}

function hydrateComponent(
  kind: HardwareModel['kind'],
  component: StoredComponent,
  unstructured: boolean,
  modelsById: ReadonlyMap<string, HardwareModel>,
): HardwareModel[] | 'unresolved' | undefined {
  if (component.capabilityOnly) return undefined;
  if (component.raw.length === 0) return unstructured ? 'unresolved' : undefined;
  const models = component.ids.flatMap((id) => modelsById.get(id) ?? []);
  if (models.length > 0) return models;
  if (component.estimatedScore !== undefined) {
    return [
      { id: 'estimate', kind, name: component.raw.join(' / '), score: component.estimatedScore },
    ];
  }
  return 'unresolved';
}
