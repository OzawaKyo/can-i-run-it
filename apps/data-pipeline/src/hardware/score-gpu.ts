import { logScore, type GpuCalibration } from './calibrate-gpu-score';
import calibration from './gpu-calibration.json' with { type: 'json' };

/**
 * Relative gaming performance, on the scale of the reference GTX 1060 6GB (= 4372).
 *
 * Blends FP32 throughput, corrected per architecture, with memory bandwidth: raw FLOPS
 * mislead across architectures (dual-issue FP32 on Ampere/RDNA 3, idle VLIW lanes on
 * TeraScale), and bandwidth-starved cards (GT 1030 DDR4, GTX 1660 vs 1660 Super) fall
 * well short of their FLOPS. The factors are fitted to the gaming equivalences in
 * gpu-anchors.ts by `nx run data-pipeline:calibrate-gpus`.
 * Blender Open Data was considered but measures path tracing, which overrates Turing
 * and cannot compare CUDA with HIP.
 */
/**
 * Intel integrated generations calibrated through a single anchor (UHD 630, Gen9): shared
 * memory dominates their gaming performance, so their efficiency per GFLOP is alike.
 */
const SAME_EFFICIENCY_AS: Record<string, string> = {
  Gen7: 'Gen9',
  'Gen7.5': 'Gen9',
  Gen8: 'Gen9',
  Gen11: 'Gen9',
  Gen12: 'Gen9',
  'Gen12.2': 'Gen9',
  'Xe-LP': 'Gen9',
};

export function scoreGpu(gpu: {
  fp32Gflops: number;
  bandwidthGBs?: number;
  architecture?: string;
}): number | undefined {
  if (gpu.architecture === undefined) return undefined;
  const architecture = SAME_EFFICIENCY_AS[gpu.architecture] ?? gpu.architecture;
  const score = logScore(calibration as GpuCalibration, { ...gpu, architecture });
  return score === undefined ? undefined : Math.round(Math.exp(score));
}
