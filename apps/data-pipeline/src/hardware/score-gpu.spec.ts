import { describe, expect, it } from 'vitest';
import { calibrateGpuScore } from './calibrate-gpu-score';
import { GPU_ANCHORS } from './gpu-anchors';
import savedCalibration from './gpu-calibration.json' with { type: 'json' };
import { scoreGpu } from './score-gpu';

const errorOf = (a: string, b: string) => {
  const anchor = GPU_ANCHORS.find((candidate) => candidate.a.name === a && candidate.b.name === b);
  if (!anchor) throw new Error(`no anchor ${a} / ${b}`);
  return (scoreGpu(anchor.a) as number) / (scoreGpu(anchor.b) as number) / anchor.ratio - 1;
};

describe('scoreGpu', () => {
  it('scores the reference GTX 1060 6GB at its FP32 throughput', () => {
    expect(scoreGpu({ fp32Gflops: 4372, bandwidthGBs: 192, architecture: 'Pascal' })).toBe(4372);
  });

  it('reproduces the gaming equivalences it is calibrated on', () => {
    const errors = GPU_ANCHORS.map(({ a, b, ratio }) =>
      Math.abs((scoreGpu(a) as number) / (scoreGpu(b) as number) / ratio - 1),
    );
    const sorted = [...errors].sort((x, y) => x - y);
    expect(sorted[Math.floor(sorted.length / 2)]).toBeLessThan(0.05);
    expect(Math.max(...errors)).toBeLessThan(0.22);
  });

  it('gets the mainstream cards that requirements most often name within 10%', () => {
    for (const [a, b] of [
      ['GeForce GTX 1660', 'GeForce GTX 1060 6GB'],
      ['Radeon RX 580 8GB', 'GeForce GTX 1060 6GB'],
      ['GeForce GTX 1070', 'GeForce GTX 1060 6GB'],
      ['GeForce RTX 2060', 'GeForce GTX 1080'],
      ['GeForce RTX 3060 12GB', 'GeForce RTX 2070'],
      ['Radeon RX 6600', 'GeForce RTX 3060 12GB'],
      ['GeForce GT 1030 DDR4', 'GeForce GT 1030 GDDR5'],
      ['GeForce GTX 1650', 'GeForce GTX 1050 Ti'],
    ]) {
      expect(Math.abs(errorOf(a, b)), `${a} / ${b}`).toBeLessThan(0.1);
    }
  });

  it('matches the saved calibration (rerun calibrate-gpus after editing the anchors)', () => {
    expect(calibrateGpuScore().calibration).toEqual(savedCalibration);
  });

  it('scores every Intel integrated generation with the calibrated Gen9 efficiency', () => {
    for (const architecture of ['Gen7.5', 'Gen8', 'Gen11', 'Gen12', 'Gen12.2', 'Xe-LP']) {
      expect(scoreGpu({ fp32Gflops: 384, architecture }), architecture).toBe(
        scoreGpu({ fp32Gflops: 384, architecture: 'Gen9' }),
      );
    }
  });

  it('cannot score an unknown architecture', () => {
    expect(scoreGpu({ fp32Gflops: 1000, architecture: 'Curie' })).toBeUndefined();
    expect(scoreGpu({ fp32Gflops: 1000 })).toBeUndefined();
  });
});
