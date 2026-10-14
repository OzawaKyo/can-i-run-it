import { describe, expect, it } from 'vitest';
import { estimateFps } from './estimate-fps';
import type { HardwareModel } from './hardware';

const cpu = (score: number): HardwareModel => ({
  id: `cpu-${score}`,
  kind: 'cpu',
  name: 'cpu',
  score,
});
const gpu = (score: number): HardwareModel => ({
  id: `gpu-${score}`,
  kind: 'gpu',
  name: 'gpu',
  score,
});

const requirements = {
  minimum: { cpu: [cpu(50)], gpu: [gpu(2000), gpu(1500)] },
  recommended: { cpu: [cpu(100)], gpu: [gpu(4000)] },
};

describe('estimateFps', () => {
  it('scales the recommended target (60 FPS, high settings) by how much faster the GPU is', () => {
    // GPU 1.5× the recommended card → ≈ 90 FPS high.
    expect(estimateFps({ cpu: cpu(200), gpu: gpu(6000) }, requirements).high).toEqual({
      from: 70,
      to: 115,
    });
  });

  it('scales the minimum target (30 FPS, low settings) against the weakest minimum card', () => {
    // GPU 3000 vs 1500 → 2× → ≈ 60 FPS low; but low settings are at least 1.5× high (≈ 45 → 68).
    expect(estimateFps({ cpu: cpu(100), gpu: gpu(3000) }, requirements).low).toEqual({
      from: 55,
      to: 85,
    });
  });

  it('never estimates low settings below high settings', () => {
    const fps = estimateFps({ cpu: cpu(200), gpu: gpu(6000) }, requirements);
    expect(fps.low!.from).toBeGreaterThan(fps.high!.from);
  });

  it('ignores a CPU below the recommended one (publishers overstate it), but not below the minimum', () => {
    expect(estimateFps({ cpu: cpu(60), gpu: gpu(6000) }, requirements).high).toEqual({
      from: 70,
      to: 115,
    });
    // CPU at half the minimum one: everything halves.
    expect(estimateFps({ cpu: cpu(25), gpu: gpu(6000) }, requirements).high).toEqual({
      from: 35,
      to: 55,
    });
  });

  it('caps very high frame rates at 144+', () => {
    expect(estimateFps({ cpu: cpu(1000), gpu: gpu(40000) }, requirements).high).toEqual({
      from: 144,
      to: undefined,
    });
  });

  it('gives nothing when a score is missing, rather than inventing one', () => {
    expect(estimateFps({ cpu: cpu(100) }, requirements)).toEqual({});
    expect(estimateFps({ gpu: gpu(6000) }, requirements)).toEqual({});
    expect(
      estimateFps(
        { cpu: cpu(200), gpu: gpu(6000) },
        { minimum: { cpu: [cpu(50)], gpu: 'unresolved' } },
      ),
    ).toEqual({});
  });

  it('uses the GPU alone when the game states no CPU', () => {
    expect(estimateFps({ gpu: gpu(3000) }, { minimum: { gpu: [gpu(1500)] } }).low).toEqual({
      from: 50,
      to: 75,
    });
  });
});
