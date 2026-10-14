export interface CpuScoreInput {
  name: string;
  microarchitecture?: string;
  /** Performance cores (all cores on non-hybrid chips). */
  cores: number;
  threads: number;
  efficiencyCores?: number;
  baseGhz: number;
  turboGhz: number;
}

/**
 * Gaming performance per clock, relative to Skylake (= 1). Solved from the equivalences
 * in score-cpu.spec.ts (publisher pairings from Steam requirements, then widely reported
 * gaming results), which the spec checks within ±12%.
 */
const PERFORMANCE_PER_CLOCK: Record<string, number> = {
  // Intel
  'Cougar Cove': 1.36,
  'Lion Cove': 1.33,
  'Redwood Cove': 1.3,
  'Raptor Cove': 1.39,
  'Golden Cove': 1.35,
  Gracemont: 0.81,
  'Cypress Cove': 1.18,
  'Willow Cove': 1.2,
  'Sunny Cove': 1.15,
  Skylake: 1,
  Broadwell: 0.92,
  Haswell: 0.89,
  'Ivy Bridge': 0.86,
  'Sandy Bridge': 0.82,
  Nehalem: 0.74,
  Penryn: 0.66,
  Core: 0.61,
  // AMD
  'Zen 5': 1.38,
  'Zen 4': 1.3,
  'Zen 3': 1.22,
  'Zen 2': 1,
  'Zen+': 0.91,
  Zen: 0.88,
  Excavator: 0.7,
  Steamroller: 0.66,
  Piledriver: 0.6,
  Bulldozer: 0.52,
  K10: 0.6,
  Jaguar: 0.55,
  Bobcat: 0.45,
};

/** Games scale to about 8 cores; beyond that, cores barely change frame rates. */
const GAME_CORE_CAP = 8;
/** An E-core counts as about half a P-core in games. */
const EFFICIENCY_CORE_WEIGHT = 0.5;
/** SMT/CMT adds about a quarter to multi-threaded throughput. */
const SMT_GAIN = 1.25;
/** 3D V-Cache lifts gaming performance well beyond what clocks suggest. */
const X3D_GAIN = 1.12;

/** Reference: Core i5-8400 (Skylake, 6 cores, 2.8/4.0 GHz) scores 100. */
const REFERENCE_SINGLE = 4.0;
const REFERENCE_MULTI = 3.4 * 6;

/**
 * Relative gaming performance, 60% single-thread and 40% multi-thread (games lean on their
 * main thread). Undefined when the microarchitecture has no calibrated factor.
 */
export function scoreCpu(cpu: CpuScoreInput): number | undefined {
  const perClock =
    cpu.microarchitecture === undefined ? undefined : PERFORMANCE_PER_CLOCK[cpu.microarchitecture];
  if (perClock === undefined) return undefined;

  const cache = /X3D/i.test(cpu.name) ? X3D_GAIN : 1;
  const single = perClock * cpu.turboGhz * cache;
  const allCoreGhz = (cpu.baseGhz + cpu.turboGhz) / 2;
  const effectiveCores = Math.min(
    cpu.cores + EFFICIENCY_CORE_WEIGHT * (cpu.efficiencyCores ?? 0),
    GAME_CORE_CAP,
  );
  const smt = cpu.threads > cpu.cores ? SMT_GAIN : 1;
  const multi = perClock * allCoreGhz * effectiveCores * smt * cache;

  return Math.round(100 * (0.6 * (single / REFERENCE_SINGLE) + 0.4 * (multi / REFERENCE_MULTI)));
}
