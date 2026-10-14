import type { HardwareModel } from '@can-i-run-it/domain';
import { applyPcReport, parsePcReport, PC_REPORT_PREFIX } from './pc-report';

const report = (fields: object) => `${PC_REPORT_PREFIX}${JSON.stringify({ v: 1, ...fields })}`;

describe('parsePcReport', () => {
  it('reads the report the PowerShell command copies', () => {
    expect(
      parsePcReport(
        report({
          cpu: 'AMD Ryzen 5 3600 6-Core Processor',
          gpus: ['NVIDIA GeForce RTX 3060'],
          ramGb: 16,
          freeGb: 412,
          disk: 'SSD',
        }),
      ),
    ).toEqual({
      cpu: 'AMD Ryzen 5 3600 6-Core Processor',
      gpus: ['NVIDIA GeForce RTX 3060'],
      ramGb: 16,
      freeStorageGb: 412,
      storageType: 'ssd',
    });
  });

  it('tolerates surrounding whitespace and a single GPU given as a string', () => {
    expect(parsePcReport(`  ${report({ cpu: 'X', gpus: 'Y', ramGb: 8 })}\r\n`)?.gpus).toEqual([
      'Y',
    ]);
  });

  it('maps disk media types, leaving unknown ones out', () => {
    expect(parsePcReport(report({ disk: 'HDD' }))?.storageType).toBe('hdd');
    expect(parsePcReport(report({ disk: 'Unspecified' }))?.storageType).toBeUndefined();
  });

  it('rejects anything that is not a report', () => {
    expect(parsePcReport('hello')).toBeUndefined();
    expect(parsePcReport(`${PC_REPORT_PREFIX}{not json`)).toBeUndefined();
    expect(parsePcReport(report({ v: 2 }))).toBeUndefined();
  });

  it('drops values of the wrong type or size', () => {
    expect(
      parsePcReport(report({ cpu: 42, ramGb: -3, freeGb: 'lots', gpus: ['x'.repeat(500)] })),
    ).toEqual({ gpus: [] });
  });
});

describe('applyPcReport', () => {
  const catalog = {
    cpus: [
      { id: 'r5-3600', kind: 'cpu', name: 'Ryzen 5 3600', score: 120 },
    ] satisfies HardwareModel[],
    gpus: [
      { id: 'uhd-630', kind: 'gpu', name: 'UHD Graphics 630', score: 370 },
      { id: 'rtx-3060', kind: 'gpu', name: 'GeForce RTX 3060', score: 7000 },
    ] satisfies HardwareModel[],
  };

  it('resolves names and keeps the fastest of several GPUs', () => {
    const { config, unmatched } = applyPcReport(
      {
        cpu: 'AMD Ryzen 5 3600 6-Core Processor',
        gpus: ['Intel(R) UHD Graphics 630', 'NVIDIA GeForce RTX 3060'],
        ramGb: 16,
        freeStorageGb: 412,
        storageType: 'ssd',
      },
      catalog,
    );
    expect(config).toEqual({
      cpuId: 'r5-3600',
      gpuId: 'rtx-3060',
      ramGb: 16,
      freeStorageGb: 412,
      storageType: 'ssd',
    });
    expect(unmatched).toEqual([]);
  });

  it('reports names it could not recognise, ignoring virtual display adapters', () => {
    const { config, unmatched } = applyPcReport(
      {
        cpu: 'Mystery CPU',
        gpus: ['Microsoft Basic Display Adapter', 'Parsec Virtual Display Adapter'],
      },
      catalog,
    );
    expect(config).toEqual({});
    expect(unmatched).toEqual(['Mystery CPU']);
  });
});
