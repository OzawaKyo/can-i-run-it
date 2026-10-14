import { describe, expect, it } from 'vitest';
import { buildHardwareCatalog } from './build-hardware-catalog';

const page = (title: string, rows: string) =>
  `<section><h2>${title}</h2><table class="wikitable">${rows}</table></section>`;

describe('buildHardwareCatalog', () => {
  const catalog = buildHardwareCatalog([
    {
      kind: 'gpu',
      vendor: 'nvidia',
      html: page(
        'GeForce 10 series',
        `<tr><th>Model</th><th>Code name</th><th>Memory / Size (GB)</th><th>Processing power (GFLOPS) / Single precision</th></tr>
         <tr><td>GeForce GTX 1060 6GB</td><td>GP106-400-A1</td><td>6</td><td>3,855 (4,372)</td></tr>
         <tr><td>GeForce 7800 GTX</td><td>G70</td><td>0.25</td><td>165</td></tr>
         <tr><td>GeForce GTX 1080 Ti</td><td>GP102</td><td>11</td><td>?</td></tr>`,
      ),
    },
    {
      kind: 'cpu',
      vendor: 'intel',
      html: page(
        'Coffee Lake-S',
        `<tr><th>Processor branding</th><th>Model</th><th>Cores (Threads)</th><th>Clock rate (GHz) / Base</th><th>Clock rate (GHz) / Turbo</th></tr>
         <tr><td>Core i5</td><td>8400</td><td>6 (6)</td><td>2.8</td><td>4.0</td></tr>`,
      ),
    },
    {
      kind: 'cpu',
      vendor: 'intel',
      html: page(
        '8th generation Core i',
        `<tr><th>Processor branding</th><th>Model</th><th>Cores (Threads)</th><th>Clock rate (GHz) / Base</th><th>Clock rate (GHz) / Turbo</th></tr>
         <tr><td>Core i5</td><td>8400</td><td>6 (12)</td><td>2.8</td><td>4.0</td></tr>`,
      ),
    },
  ]);

  it('scores each model and keeps only what the app needs', () => {
    expect(catalog.gpus).toContainEqual({
      id: 'nvidia-geforce-gtx-1060-6gb',
      kind: 'gpu',
      name: 'GeForce GTX 1060 6GB',
      score: 4372,
      vramGb: 6,
      directX: 12,
    });
  });

  it('keeps models it cannot score, so their names still resolve', () => {
    const geforce7800 = catalog.gpus.find((gpu) => gpu.name === 'GeForce 7800 GTX');
    expect(geforce7800).toBeDefined();
    expect(geforce7800?.score).toBeUndefined();
    expect(catalog.report.unscored).toContain('nvidia-geforce-7800-gtx');
  });

  it('lets the earlier page win when two pages list the same model', () => {
    expect(catalog.cpus).toEqual([
      { id: 'intel-core-i5-8400', kind: 'cpu', name: 'Core i5-8400', score: 100 },
    ]);
  });

  it('reports rejected rows', () => {
    expect(catalog.report.rejected).toEqual([
      { model: 'GeForce GTX 1080 Ti', reason: 'no FP32 throughput' },
    ]);
  });
});
