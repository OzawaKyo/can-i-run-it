import { describe, expect, it } from 'vitest';
import type { WikiTable } from '../wikipedia/read-wiki-tables';
import { extractCpus } from './extract-cpus';

describe('extractCpus', () => {
  it('reads an Intel Core table: branding + model, cores (threads), base and turbo clocks', () => {
    const table: WikiTable = {
      section: ['Core i (4th gen), Xeon E3 V3 and Xeon E5 V2', 'Haswell-DT'],
      columns: [
        'Processor branding',
        'Model',
        'Cores (Threads)',
        'Clock rate (GHz) / Base',
        'Clock rate (GHz) / Turbo',
        'Integrated GPU / Model',
        'TDP',
      ],
      rows: [
        ['Core i7', '4790K', '4 (8)', '4.0', '4.4', 'HD 4600', '88 W'],
        ['Core i5', '4460', '4 (4)', '3.2', '3.4', 'HD 4600', '84 W'],
      ],
    };
    expect(extractCpus(table, 'intel').cpus).toEqual([
      {
        id: 'intel-core-i7-4790k',
        kind: 'cpu',
        vendor: 'intel',
        name: 'Core i7-4790K',
        microarchitecture: 'Haswell',
        cores: 4,
        threads: 8,
        baseGhz: 4.0,
        turboGhz: 4.4,
        laptop: false,
      },
      expect.objectContaining({ id: 'intel-core-i5-4460', cores: 4, threads: 4, turboGhz: 3.4 }),
    ]);
  });

  it('reads hybrid P/E-core tables', () => {
    const table: WikiTable = {
      section: ['Core i (12th gen)', 'Alder Lake-S'],
      columns: [
        'Processor branding',
        'Model',
        'P-core (performance) / Cores (Threads)',
        'P-core (performance) / Clock rate (GHz) / Base',
        'P-core (performance) / Clock rate (GHz) / Turbo',
        'E-core (efficiency) / Cores (Threads)',
        'E-core (efficiency) / Clock rate (GHz) / Base',
        'E-core (efficiency) / Clock rate (GHz) / Turbo',
      ],
      rows: [['Core i5', '12600K', '6 (12)', '3.7', '4.9', '4 (4)', '2.8', '3.6']],
    };
    expect(extractCpus(table, 'intel').cpus[0]).toMatchObject({
      name: 'Core i5-12600K',
      microarchitecture: 'Golden Cove',
      cores: 6,
      threads: 12,
      efficiencyCores: 4,
      baseGhz: 3.7,
      turboGhz: 4.9,
    });
  });

  it('reads a Ryzen table: split branding, "Zen+" from the section, boost column', () => {
    const table: WikiTable = {
      section: ['Ryzen 2000 series', 'Pinnacle Ridge (2000 series, Zen+ based)'],
      columns: [
        'Branding and Model',
        'Branding and Model',
        'Cores (threads)',
        'Clock rate (GHz) / Base',
        'Clock rate (GHz) / PB2',
        'L3 cache (total)',
      ],
      rows: [['Ryzen 5', '2600', '6 (12)', '3.4', '3.9', '16 MB']],
    };
    expect(extractCpus(table, 'amd').cpus[0]).toMatchObject({
      id: 'amd-ryzen-5-2600',
      name: 'Ryzen 5 2600',
      microarchitecture: 'Zen+',
      cores: 6,
      threads: 12,
      baseGhz: 3.4,
      turboGhz: 3.9,
    });
  });

  it('reads Core 2 tables: model with branding, "2.33 GHz" clocks, no turbo', () => {
    const table: WikiTable = {
      section: ['Core 2', '"Yorkfield-6M" (45 nm)'],
      columns: ['Model', 'sSpec number', 'Cores', 'Clock rate', 'L2 cache'],
      rows: [['Core 2 Quad Q8200', 'SLB5M (M1)', '4', '2.33 GHz', '2 × 2 MB']],
    };
    expect(extractCpus(table, 'intel').cpus[0]).toMatchObject({
      name: 'Core 2 Quad Q8200',
      microarchitecture: 'Penryn',
      cores: 4,
      threads: 4,
      baseGhz: 2.33,
      turboGhz: 2.33,
    });
  });

  it('flags mobile parts', () => {
    const table: WikiTable = {
      section: ['Ryzen 4000 series', 'Renoir (4000 series, Zen 2/GCN5 based)'],
      columns: [
        'Branding and Model',
        'Branding and Model',
        'CPU / Cores (threads)',
        'CPU / Clock rate (GHz) / Base',
        'CPU / Clock rate (GHz) / Boost',
      ],
      rows: [['Ryzen 7', '4800H', '8 (16)', '2.9', '4.2']],
    };
    expect(extractCpus(table, 'amd').cpus[0]).toMatchObject({
      microarchitecture: 'Zen 2',
      laptop: true,
    });
  });

  it('rejects rows without a clock or core count, and skips non-CPU tables', () => {
    const table: WikiTable = {
      section: ['Core i (4th gen)', 'Haswell-DT'],
      columns: ['Processor branding', 'Model', 'Cores (Threads)', 'Clock rate (GHz) / Base'],
      rows: [['Core i5', '4590', '4 (4)', '?']],
    };
    expect(extractCpus(table, 'intel').rejected).toEqual([
      { model: 'Core i5-4590', reason: 'no clock rate' },
    ]);
    expect(
      extractCpus({ section: [], columns: ['Year', 'Name'], rows: [['1978', '8086']] }, 'intel'),
    ).toEqual({ cpus: [], rejected: [] });
  });

  it('reads the microarchitecture from "Nth generation" and "Core Series" headings', () => {
    const table = (section: string): WikiTable => ({
      section: ['Latest', section, 'Desktop'],
      columns: [
        'Processor Family',
        'Model',
        'Cores (threads)',
        'Clock rate (GHz) / Base',
        'Clock rate (GHz) / Turbo',
      ],
      rows: [['Core i5', '1', '6 (12)', '3.0', '4.0']],
    });
    const microarchitecture = (section: string) =>
      extractCpus(table(section), 'intel').cpus[0].microarchitecture;
    expect(microarchitecture('14th generation Core i')).toBe('Raptor Cove');
    expect(microarchitecture('12th generation Core I')).toBe('Golden Cove');
    expect(microarchitecture('11th generation Core i')).toBe('Cypress Cove');
    expect(microarchitecture('8th generation Core i')).toBe('Skylake');
    expect(microarchitecture('Core Series 2')).toBe('Lion Cove');
    expect(microarchitecture('Core Series 1')).toBe('Redwood Cove');
  });

  it('reads E-core-only Alder Lake-N chips as Gracemont, not Golden Cove', () => {
    const table: WikiTable = {
      section: ['Core i (12th gen)', 'Alder Lake-N'],
      columns: [
        'Processor branding',
        'Model',
        'Cores (Threads)',
        'Clock rate (GHz) / Base',
        'Clock rate (GHz) / Turbo',
      ],
      rows: [['Core i3', 'N305', '8 (8)', '1.8', '3.8']],
    };
    expect(extractCpus(table, 'intel').cpus[0].microarchitecture).toBe('Gracemont');
  });

  it('maps AMD low-power and Zen-based Athlon codenames', () => {
    const microarchitecture = (section: string) =>
      extractCpus(
        {
          section: ['APU', section],
          columns: [
            'Model',
            'Cores (threads)',
            'Clock rate (GHz) / Base',
            'Clock rate (GHz) / Boost',
          ],
          rows: [['Athlon 5350', '4 (4)', '2.05', '2.05']],
        },
        'amd',
      ).cpus[0].microarchitecture;
    expect(microarchitecture('Kabini (2013)')).toBe('Jaguar');
    expect(microarchitecture('Beema (2014)')).toBe('Jaguar');
    expect(microarchitecture('Zacate (2011)')).toBe('Bobcat');
    expect(microarchitecture('Dalí (2020)')).toBe('Zen');
    expect(microarchitecture('Pollock (2020)')).toBe('Zen');
  });

  it('reads Phenom tables: "Model number", cores from "X4" or the heading, "Turbo speed"', () => {
    const table: WikiTable = {
      section: ['Phenom II series', '"Thuban" (E0, 45 nm, Hexa-core)'],
      columns: [
        'Model Number',
        'Step.',
        'Clock speed',
        'Turbo speed',
        'L2 cache',
        'Hyper Transport',
      ],
      rows: [['Phenom II X6 1090T', 'E0', '3.2 GHz', '3.6 GHz', '6×512 KB', '2.0 GHz']],
    };
    expect(extractCpus(table, 'amd').cpus[0]).toMatchObject({
      name: 'Phenom II X6 1090T',
      microarchitecture: 'K10',
      cores: 6,
      threads: 6,
      baseGhz: 3.2,
      turboGhz: 3.6,
    });
    const deneb: WikiTable = {
      section: ['Phenom II series', '"Deneb" (C2/C3, 45 nm, Quad-core)'],
      columns: ['Model number', 'Step.', 'Clock speed', 'L2 cache'],
      rows: [['Phenom II 965 Black Edition', 'C3', '3.4 GHz', '4×512 KB']],
    };
    expect(extractCpus(deneb, 'amd').cpus[0]).toMatchObject({
      cores: 4,
      baseGhz: 3.4,
      turboGhz: 3.4,
    });
  });
});
