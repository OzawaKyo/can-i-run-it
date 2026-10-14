/** One tier (minimum or recommended) of a game's published system requirements. */
export interface RequirementTier {
  /** Raw processor names, any one of which satisfies the tier. */
  cpu: string[];
  /** Graphics alternatives, any one of which satisfies the tier. */
  gpu: GpuRequirement[];
  ramGb?: number;
  /** VRAM stated for the tier as a whole (e.g. in the notes), independent of any GPU model. */
  vramGb?: number;
  directX?: number;
  storage?: StorageRequirement;
  /** Original text of each line, keyed by lowercased label ("os", "processor"…). */
  raw: Record<string, string>;
}

export interface StorageRequirement {
  gb: number;
  ssd: boolean;
}

export interface GpuRequirement {
  /** Raw model name, VRAM stripped. */
  name: string;
  vramGb?: number;
}

export interface GameRequirements {
  minimum?: RequirementTier;
  recommended?: RequirementTier;
}
