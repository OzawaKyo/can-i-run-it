import { describe, expect, it } from 'vitest';
import type { WikiTable } from '../wikipedia/read-wiki-tables';
import { extractGpus } from './extract-gpus';

const nvidiaDesktop: WikiTable = {
  section: ['Desktop GPUs', 'GeForce 10 series'],
  columns: [
    'Model',
    'Code Name',
    'Memory Configuration / Size (GB)',
    'Memory Configuration / Bandwidth (GB/s)',
    'Processing Power (GFLOPS) / Half Precision',
    'Processing Power (GFLOPS) / Single Precision',
  ],
  rows: [
    ['GeForce GTX 1070', 'GP104-200-A1', '8', '256.3', 'n/a', '5,783 (6,463)'],
    ['GeForce GTX 1060', 'GP106-400-A1', '3 6', '192.2', 'n/a', '3,470 (3,855)'],
    ['GeForce GTX 1080 Ti', 'GP102-350-K1-A1', '11', '484.4', 'n/a', '?'],
  ],
};

describe('extractGpus', () => {
  describe('NVIDIA desktop table', () => {
    const { gpus, rejected } = extractGpus(nvidiaDesktop, 'nvidia');

    it('reads FP32 throughput, preferring the boost figure in parentheses', () => {
      expect(gpus.find((gpu) => gpu.name === 'GeForce GTX 1070')).toMatchObject({
        fp32Gflops: 6463,
        vramGb: 8,
        bandwidthGBs: 256.3,
        laptop: false,
      });
    });

    it('derives the architecture and DirectX from the code name', () => {
      expect(gpus[0]).toMatchObject({ architecture: 'Pascal', directX: 12 });
    });

    it('emits one model per memory variant', () => {
      expect(
        gpus
          .filter((gpu) => gpu.name.startsWith('GeForce GTX 1060'))
          .map((gpu) => [gpu.id, gpu.vramGb]),
      ).toEqual([
        ['nvidia-geforce-gtx-1060-3gb', 3],
        ['nvidia-geforce-gtx-1060-6gb', 6],
      ]);
    });

    it('rejects rows it cannot read, with a reason', () => {
      expect(rejected).toEqual([{ model: 'GeForce GTX 1080 Ti', reason: 'no FP32 throughput' }]);
    });
  });

  it('converts TFLOPS columns to GFLOPS', () => {
    const table: WikiTable = {
      section: ['Desktop GPUs', 'GeForce RTX 30 series'],
      columns: [
        'Model',
        'Code Name',
        'Memory Configuration / Size (GB)',
        'Processing Power (TFLOPS) / Single Precision (FP32)',
      ],
      rows: [['GeForce RTX 3060', 'GA106-300-A1', '12', '9.46 (12.74)']],
    };
    expect(extractGpus(table, 'nvidia').gpus[0]).toMatchObject({
      fp32Gflops: 12740,
      architecture: 'Ampere',
    });
  });

  it('reads AMD tables: code name in the model, architecture column, base and boost separated by a space', () => {
    const table: WikiTable = {
      section: ['Desktop GPUs', 'Radeon RX 6000 series'],
      columns: [
        'Model (Code name)',
        'Architecture & fab',
        'Processing power (GFLOPS) / Single',
        'Memory / Size',
      ],
      rows: [['Radeon RX 6600 XT (Navi 23)', 'RDNA 2 TSMC N7', '9,355 10,600', '8 GB']],
    };
    expect(extractGpus(table, 'amd').gpus).toEqual([
      expect.objectContaining({
        id: 'amd-radeon-rx-6600-xt',
        name: 'Radeon RX 6600 XT',
        fp32Gflops: 10600,
        vramGb: 8,
        architecture: 'RDNA 2',
        directX: 12,
      }),
    ]);
  });

  it('uses an explicit Direct3D column over the architecture default', () => {
    const table: WikiTable = {
      section: ['Desktop GPUs', 'Radeon HD 4000 series'],
      columns: [
        'Model',
        'Code name',
        'Memory / Size (MB)',
        'Processing power (GFLOPS) / Single precision',
        'API support (version) / Direct3D',
      ],
      rows: [['Radeon HD 4870', 'RV770', '512 1024', '1200', '10.1']],
    };
    expect(extractGpus(table, 'amd').gpus.map((gpu) => [gpu.vramGb, gpu.directX])).toEqual([
      [0.5, 10.1],
      [1, 10.1],
    ]);
  });

  it('flags mobile GPUs and takes the middle of a clock-dependent range', () => {
    const table: WikiTable = {
      section: ['Mobile GPUs', 'GeForce RTX 30 series'],
      columns: [
        'Model name',
        'Code name',
        'Memory / Size (GiB)',
        'Processing power (TFLOPS) / Single precision',
      ],
      rows: [['GeForce RTX 3060 Mobile/ Laptop', 'GA106', '6', '8.0-12.0']],
    };
    expect(extractGpus(table, 'nvidia').gpus[0]).toMatchObject({
      id: 'nvidia-geforce-rtx-3060-laptop',
      name: 'GeForce RTX 3060 Laptop',
      laptop: true,
      fp32Gflops: 10000,
    });
  });

  it('skips tables without a model and FP32 column (overviews, transposed tables)', () => {
    const table: WikiTable = {
      section: ['Mobile GPUs', 'GeForce RTX 50 series'],
      columns: ['GeForce RTX', 'GeForce RTX', '5050 Laptop'],
      rows: [['Release date', 'Release date', 'Jun 2025']],
    };
    expect(extractGpus(table, 'nvidia')).toEqual({ gpus: [], rejected: [] });
  });

  describe('real-table quirks', () => {
    const table: WikiTable = {
      section: ['Desktop GPUs', 'Radeon HD 4000 series'],
      columns: [
        'Model',
        'Code name',
        'Memory / Size (MB)',
        'Processing power (GFLOPS) / Single precision',
      ],
      rows: [
        [
          'Model',
          'Code name',
          'Memory / Size (MB)',
          'Processing power (GFLOPS) / Single precision',
        ],
        ['GeForce 9800 GTX+', 'G92b', '512', '470'],
        ['Radeon HD 4870 X2', 'R700', '2× 1024', '2400'],
        ['Radeon HD 4850', 'RV770', '512', '1000'],
        ['Radeon HD 4850', 'RV770', '512', '1000'],
        ['Radeon HD 4830', 'RV770', '512', '736'],
        ['Radeon HD 4830', 'RV770 LE', '512', '640'],
      ],
    };
    const { gpus, rejected } = extractGpus(table, 'amd');
    const byName = (name: string) => gpus.filter((gpu) => gpu.name === name);

    it('skips header rows repeated inside the body', () => {
      expect(rejected).toEqual([]);
      expect(gpus.some((gpu) => gpu.name === 'Model')).toBe(false);
    });

    it('keeps "+" in names and ids', () => {
      expect(byName('GeForce 9800 GTX+')[0].id).toBe('amd-geforce-9800-gtxplus');
    });

    it('does not read "2×" (dual GPU) as a memory size', () => {
      expect(byName('Radeon HD 4870 X2').map((gpu) => gpu.vramGb)).toEqual([1]);
    });

    it('merges identical duplicate rows', () => {
      expect(byName('Radeon HD 4850')).toHaveLength(1);
    });

    it('keeps conflicting rows as variants named after their code name', () => {
      expect(
        gpus
          .filter((gpu) => gpu.name.startsWith('Radeon HD 4830'))
          .map((gpu) => [gpu.id, gpu.name, gpu.fp32Gflops]),
      ).toEqual([
        ['amd-radeon-hd-4830-rv770', 'Radeon HD 4830 (RV770)', 736],
        ['amd-radeon-hd-4830-rv770-le', 'Radeon HD 4830 (RV770 LE)', 640],
      ]);
    });

    it('maps AMD code names to an architecture when there is no architecture column', () => {
      expect(byName('Radeon HD 4850')[0].architecture).toBe('TeraScale 1');
    });
  });

  it('joins a model name split over two cells ("Arc 3 | A310")', () => {
    const table: WikiTable = {
      section: ['Gen 12.7', 'Desktop'],
      columns: [
        'Branding and Model',
        'Branding and Model',
        'Code name',
        'Memory / Size (GB)',
        'Processing power (TFLOPS) / Single precision (base)',
      ],
      rows: [['Arc 7', 'A770', 'ACM-G10 (DG2-512)', '8 16', '17.2']],
    };
    expect(
      extractGpus(table, 'intel').gpus.map((gpu) => [
        gpu.id,
        gpu.name,
        gpu.architecture,
        gpu.directX,
      ]),
    ).toEqual([
      ['intel-arc-a770-8gb', 'Arc A770 8GB', 'Xe-HPG', 12],
      ['intel-arc-a770-16gb', 'Arc A770 16GB', 'Xe-HPG', 12],
    ]);
  });

  describe('Intel integrated graphics (no FLOPS column)', () => {
    const table: WikiTable = {
      section: ['Gen9'],
      columns: [
        'Name',
        'Release year',
        'Market',
        'Processor',
        'Code name',
        'Clock rate / Min (MHz)',
        'Clock rate / Max (MHz)',
        'Core config1',
        'API support / Direct3D',
      ],
      rows: [
        [
          'UHD Graphics 630',
          '2017',
          'Desktop',
          'Core i5-8400',
          'Coffee Lake',
          '350',
          '1050',
          '192:24:3',
          '12',
        ],
        [
          'UHD Graphics 630',
          '2017',
          'Desktop',
          'Core i7-8700K',
          'Coffee Lake',
          '350',
          '1200',
          '192:24:3',
          '12',
        ],
        [
          'UHD Graphics 620',
          '2017',
          'Mobile',
          'Core i5-8250U',
          'Kaby Lake R',
          '300',
          '1100',
          '192:24:3',
          '12 FL12_1',
        ],
      ],
    };
    const { gpus } = extractGpus(table, 'intel');

    it('computes FP32 throughput as shader ALUs x 2 (FMA) x max clock, keeping the slowest CPU pairing', () => {
      expect(gpus.find((gpu) => gpu.name === 'UHD Graphics 630')?.fp32Gflops).toBeCloseTo(403.2);
    });

    it('has no dedicated VRAM and flags mobile parts', () => {
      expect(gpus.map((gpu) => [gpu.id, gpu.vramGb, gpu.laptop, gpu.directX])).toEqual([
        ['intel-uhd-graphics-630', undefined, false, 12],
        ['intel-uhd-graphics-620', undefined, true, 12],
      ]);
    });
  });
});
