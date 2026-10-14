import type { HardwareModel } from './hardware';
import type { ResolvedRequirements, UserConfig } from './verdict';

export interface FpsRange {
  from: number;
  /** Undefined for an open range ("144+"). */
  to?: number;
}

/**
 * What publishers usually aim for: the minimum tier runs at about 30 FPS on low settings,
 * the recommended tier at about 60 FPS on high settings, both at 1080p. An assumption,
 * not a measurement, which is why the result is shown as a range.
 */
const TARGET_FPS = { low: 30, high: 60 } as const;
/** Low settings are much lighter than high ones: never estimate them below this multiple. */
const LOW_OVER_HIGH = 1.5;
/** Scores carry about ±20% error. */
const RANGE = { below: 0.8, above: 1.25 } as const;
const DISPLAY_CAP = 144;

/**
 * Estimated frame rates at 1080p, low settings (against the minimum tier) and high settings
 * (against the recommended tier). The GPU sets the estimate; the CPU only lowers it when it
 * falls short of the minimum CPU, as publishers tend to overstate recommended processors.
 * Nothing is estimated where a needed score is missing.
 */
export function estimateFps(
  user: UserConfig,
  requirements: ResolvedRequirements,
): { low?: FpsRange; high?: FpsRange } {
  const userGpu = user.gpu?.score;
  if (userGpu === undefined) return {};

  // A CPU below the game's minimum one holds everything back.
  let cpuFactor = 1;
  const minCpu = weakestScore(requirements.minimum?.cpu);
  if (minCpu !== undefined) {
    if (user.cpu?.score === undefined) return {};
    cpuFactor = Math.min(1, user.cpu.score / minCpu);
  }

  const lowGpu = weakestScore(requirements.minimum?.gpu);
  const highGpu = weakestScore(requirements.recommended?.gpu);
  const high =
    highGpu === undefined ? undefined : TARGET_FPS.high * (userGpu / highGpu) * cpuFactor;
  let low = lowGpu === undefined ? undefined : TARGET_FPS.low * (userGpu / lowGpu) * cpuFactor;
  if (low !== undefined && high !== undefined) low = Math.max(low, high * LOW_OVER_HIGH);

  const estimate: { low?: FpsRange; high?: FpsRange } = {};
  if (low !== undefined) estimate.low = range(low);
  if (high !== undefined) estimate.high = range(high);
  return estimate;
}

function range(fps: number): FpsRange {
  const from = roundTo5(fps * RANGE.below);
  const to = roundTo5(fps * RANGE.above);
  if (from >= DISPLAY_CAP) return { from: DISPLAY_CAP };
  return to > DISPLAY_CAP ? { from } : { from, to };
}

function weakestScore(models: HardwareModel[] | 'unresolved' | undefined): number | undefined {
  if (models === undefined || models === 'unresolved') return undefined;
  const scores = models.map((model) => model.score).filter((score) => score !== undefined);
  return scores.length > 0 ? Math.min(...scores) : undefined;
}

function roundTo5(value: number): number {
  return Math.round(value / 5) * 5;
}
