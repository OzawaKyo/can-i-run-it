import { GPU_ANCHORS, type AnchorGpu } from './gpu-anchors';

/** Model: log score = (1 − w)·(log FP32 + x_arch) + w·log(bandwidth × K); w = 0 without bandwidth. */
export interface GpuCalibration {
  bandwidthWeight: number;
  /** Scales bandwidth to the reference GPU's FP32 (GTX 1060 6GB: 4372 GFLOPS, 192 GB/s). */
  bandwidthScale: number;
  /** Per-architecture gaming efficiency per GFLOP, Pascal = 1. */
  factors: Record<string, number>;
}

const REFERENCE_ARCHITECTURE = 'Pascal';
export const BANDWIDTH_SCALE = 4372 / 192;

/**
 * Fits the per-architecture factors to the anchors by least squares on log ratios, for
 * the bandwidth weight that fits best. Returns the calibration and each anchor's error.
 */
export function calibrateGpuScore(): {
  calibration: GpuCalibration;
  errors: { anchor: string; error: number }[];
} {
  let best: { calibration: GpuCalibration; cost: number } | undefined;
  for (let weight = 0; weight <= 0.6001; weight += 0.05) {
    const factors = solveFactors(weight);
    const calibration = {
      bandwidthWeight: round(weight),
      bandwidthScale: BANDWIDTH_SCALE,
      factors,
    };
    const cost = GPU_ANCHORS.reduce(
      (sum, anchor) => sum + anchorError(calibration, anchor) ** 2,
      0,
    );
    if (!best || cost < best.cost) best = { calibration, cost };
  }
  const calibration = best!.calibration;
  return {
    calibration,
    errors: GPU_ANCHORS.map((anchor) => ({
      anchor: `${anchor.a.name} / ${anchor.b.name}`,
      error: Math.exp(anchorError(calibration, anchor)) - 1,
    })),
  };
}

export function logScore(
  calibration: GpuCalibration,
  gpu: Omit<AnchorGpu, 'name'>,
): number | undefined {
  const factor = calibration.factors[gpu.architecture];
  if (factor === undefined) return undefined;
  const compute = Math.log(gpu.fp32Gflops * factor);
  if (gpu.bandwidthGBs === undefined) return compute;
  const w = calibration.bandwidthWeight;
  return (1 - w) * compute + w * Math.log(gpu.bandwidthGBs * calibration.bandwidthScale);
}

function anchorError(
  calibration: GpuCalibration,
  { a, b, ratio }: (typeof GPU_ANCHORS)[number],
): number {
  return (
    (logScore(calibration, a) as number) - (logScore(calibration, b) as number) - Math.log(ratio)
  );
}

function solveFactors(weight: number): Record<string, number> {
  const architectures = [
    ...new Set(GPU_ANCHORS.flatMap(({ a, b }) => [a.architecture, b.architecture])),
  ].filter((architecture) => architecture !== REFERENCE_ARCHITECTURE);
  const column = new Map(architectures.map((architecture, index) => [architecture, index]));
  const n = architectures.length;
  const ata = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  const aty = new Array<number>(n).fill(0);

  for (const { a, b, ratio } of GPU_ANCHORS) {
    const row = new Array<number>(n).fill(0);
    const wa = a.bandwidthGBs === undefined ? 0 : weight;
    const wb = b.bandwidthGBs === undefined ? 0 : weight;
    if (column.has(a.architecture)) row[column.get(a.architecture)!] += 1 - wa;
    if (column.has(b.architecture)) row[column.get(b.architecture)!] -= 1 - wb;
    const known = (gpu: AnchorGpu, w: number) =>
      (1 - w) * Math.log(gpu.fp32Gflops) +
      (gpu.bandwidthGBs === undefined ? 0 : w * Math.log(gpu.bandwidthGBs * BANDWIDTH_SCALE));
    const y = Math.log(ratio) - known(a, wa) + known(b, wb);
    for (let i = 0; i < n; i++) {
      aty[i] += row[i] * y;
      for (let j = 0; j < n; j++) ata[i][j] += row[i] * row[j];
    }
  }
  for (let i = 0; i < n; i++) ata[i][i] += 1e-9;

  const x = gaussianElimination(ata, aty);
  const factors: Record<string, number> = { [REFERENCE_ARCHITECTURE]: 1 };
  architectures.forEach(
    (architecture, index) => (factors[architecture] = round(Math.exp(x[index]))),
  );
  return factors;
}

function gaussianElimination(matrix: number[][], vector: number[]): number[] {
  const n = vector.length;
  const m = matrix.map((row, i) => [...row, vector[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++)
      if (Math.abs(m[row][col]) > Math.abs(m[pivot][col])) pivot = row;
    [m[col], m[pivot]] = [m[pivot], m[col]];
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const f = m[row][col] / m[col][col];
      for (let k = col; k <= n; k++) m[row][k] -= f * m[col][k];
    }
  }
  return m.map((row, i) => row[n] / row[i]);
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
