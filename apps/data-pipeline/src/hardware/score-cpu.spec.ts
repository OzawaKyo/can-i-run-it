import { describe, expect, it } from 'vitest';
import { scoreCpu, type CpuScoreInput } from './score-cpu';

const cpu = (
  microarchitecture: string,
  cores: number,
  threads: number,
  baseGhz: number,
  turboGhz: number,
  extra: Partial<CpuScoreInput> = {},
) => scoreCpu({ name: '', microarchitecture, cores, threads, baseGhz, turboGhz, ...extra });

/** Asserts `a ≈ ratio × b` within ±12%. */
function expectRatio(a: number | undefined, b: number | undefined, ratio: number) {
  expect(a).toBeDefined();
  expect(b).toBeDefined();
  expect((a as number) / (b as number) / ratio).toBeGreaterThan(0.88);
  expect((a as number) / (b as number) / ratio).toBeLessThan(1.12);
}

const i5_8400 = cpu('Skylake', 6, 6, 2.8, 4.0);
const i7_8700k = cpu('Skylake', 6, 12, 3.7, 4.7);
const i5_2500k = cpu('Sandy Bridge', 4, 4, 3.3, 3.7);

describe('scoreCpu', () => {
  it('is 100 for the reference Core i5-8400', () => {
    expect(i5_8400).toBe(100);
  });

  it('matches equivalences publishers state in Steam requirements', () => {
    expectRatio(cpu('Skylake', 4, 8, 3.4, 4.0), cpu('Zen', 6, 12, 3.2, 3.6), 1); // Cyberpunk: i7-6700 / Ryzen 5 1600
    expectRatio(i5_8400, cpu('Zen+', 6, 12, 3.4, 3.9), 1); // Witcher 3: i5-8400 / Ryzen 5 2600
    expectRatio(i5_8400, cpu('Zen 2', 4, 8, 3.8, 4.3), 1); // Elden Ring: i5-8400 / Ryzen 3 3300X
    expectRatio(i7_8700k, cpu('Zen 2', 6, 12, 3.8, 4.4), 1); // Elden Ring: i7-8700K / Ryzen 5 3600X
    expectRatio(cpu('Core', 4, 4, 2.4, 2.4), cpu('K10', 4, 4, 2.5, 2.5), 1); // GTA V: Q6600 / Phenom 9850
  });

  it('matches widely reported gaming equivalences', () => {
    expectRatio(cpu('Haswell', 4, 8, 4.0, 4.4), i5_8400, 0.95); // i7-4790K
    expectRatio(i5_2500k, cpu('Haswell', 4, 4, 3.2, 3.4), 1); // vs i5-4460
    expectRatio(cpu('Piledriver', 4, 8, 4.0, 4.2), i5_2500k, 0.9); // FX-8350
    expectRatio(cpu('Golden Cove', 6, 12, 2.5, 4.4), cpu('Zen 3', 6, 12, 3.7, 4.6), 1); // i5-12400 / Ryzen 5 5600X
    expectRatio(cpu('Zen 3', 6, 12, 3.7, 4.6), i7_8700k, 1.2); // Ryzen 5 5600X
    expectRatio(
      cpu('Zen 4', 8, 16, 4.2, 5.0, { name: 'Ryzen 7 7800X3D' }),
      cpu('Raptor Cove', 8, 16, 3.0, 5.8, { efficiencyCores: 16 }), // i9-13900K
      1,
    );
  });

  it('scores E-core-only chips below a mainstream desktop part', () => {
    expectRatio(cpu('Gracemont', 8, 8, 1.8, 3.8), cpu('Skylake', 4, 8, 3.4, 4.0), 0.85); // i3-N305 vs i7-6700
  });

  it('gives extra cores beyond what games use little weight', () => {
    const ryzen7_5800x = cpu('Zen 3', 8, 16, 3.8, 4.7);
    const ryzen9_5950x = cpu('Zen 3', 16, 32, 3.4, 4.9);
    expectRatio(ryzen9_5950x, ryzen7_5800x, 1.03);
  });

  it('cannot score an unknown microarchitecture', () => {
    expect(cpu('NetBurst', 1, 2, 3.0, 3.0)).toBeUndefined();
  });
});
