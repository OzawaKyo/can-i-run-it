import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parsePcgwRequirements, steamAppIds } from './parse-pcgw-requirements';

const fixture = (name: string) =>
  readFileSync(new URL(`./fixtures/${name}.wikitext`, import.meta.url), 'utf8');

describe('parsePcgwRequirements', () => {
  describe('The Witcher 3', () => {
    const { minimum, recommended } = parsePcgwRequirements(fixture('the_witcher_3_wild_hunt'));

    it('reads numbered CPU and GPU alternatives, with VRAM written in a GPU name', () => {
      expect(minimum?.cpu).toEqual(['Intel Core i3-8400', 'AMD Ryzen 5 2600']);
      expect(minimum?.gpu).toEqual([
        { name: 'Nvidia GeForce GTX 1660' },
        { name: 'AMD Radeon RX 5500 XT', vramGb: 8 },
        { name: 'Intel Arc A580' },
      ]);
    });

    it('reads RAM, VRAM and storage, dropping {{note}} templates', () => {
      expect(minimum).toMatchObject({ ramGb: 12, vramGb: 6, storage: { gb: 60, ssd: false } });
      expect(minimum?.raw['storage']).toBe('60 GB');
    });

    it('reads the recommended tier and ignores the extra "alt" tiers', () => {
      expect(recommended?.cpu).toEqual(['Intel Core i7-8700K', 'AMD Ryzen 5 3600X']);
      expect(recommended?.ramGb).toBe(16);
    });
  });

  describe('Rocket League (Windows, OS X and Linux blocks)', () => {
    const { minimum, recommended } = parsePcgwRequirements(fixture('rocket_league'));

    it('reads the Windows block only', () => {
      expect(minimum).toMatchObject({
        cpu: ['Dual Core 2.5 GHz'],
        gpu: [{ name: 'Nvidia GeForce GTX 760' }, { name: 'AMD Radeon R7 270X' }],
        ramGb: 4,
        directX: 11,
      });
    });

    it('leaves out fields left empty', () => {
      expect(recommended?.directX).toBeUndefined();
      expect(recommended?.storage).toBeUndefined();
    });
  });

  it('returns no tiers without a Windows block', () => {
    expect(
      parsePcgwRequirements('{{System requirements\n|OSfamily = Linux\n|minCPU = X\n}}'),
    ).toEqual({});
  });
});

describe('steamAppIds', () => {
  it('reads the Steam app ids from the infobox', () => {
    expect(steamAppIds(fixture('the_witcher_3_wild_hunt'))).toContain(292030);
    expect(steamAppIds(fixture('rocket_league'))).toEqual([252950]);
    expect(steamAppIds('no infobox')).toEqual([]);
  });
});
