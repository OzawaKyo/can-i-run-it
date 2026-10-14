import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseSteamRequirements } from './parse-steam-requirements';

function fixture(appid: number): unknown {
  const url = new URL(`./fixtures/${appid}.json`, import.meta.url);
  return JSON.parse(readFileSync(url, 'utf8')).pc_requirements;
}

describe('parseSteamRequirements', () => {
  describe('Cyberpunk 2077 (standard bullet list)', () => {
    const requirements = parseSteamRequirements(fixture(1091500));

    it('reads the minimum RAM in GB', () => {
      expect(requirements.minimum?.ramGb).toBe(12);
    });

    it('splits processor alternatives on "or"', () => {
      expect(requirements.minimum?.cpu).toEqual(['Core i7-6700', 'Ryzen 5 1600']);
    });

    it('splits graphics alternatives and pulls out their VRAM', () => {
      expect(requirements.minimum?.gpu).toEqual([
        { name: 'GeForce GTX 1060', vramGb: 6 },
        { name: 'Radeon RX 580', vramGb: 8 },
        { name: 'Arc A380' },
      ]);
    });

    it('reads the DirectX version', () => {
      expect(requirements.minimum?.directX).toBe(12);
    });

    it('reads storage and picks up "SSD required" from the notes', () => {
      expect(requirements.minimum?.storage).toEqual({ gb: 70, ssd: true });
    });

    it('keeps the raw text of each line for display', () => {
      expect(requirements.minimum?.raw).toMatchObject({
        os: '64-bit Windows 10',
        processor: 'Core i7-6700 or Ryzen 5 1600',
        graphics: 'GeForce GTX 1060 6GB or Radeon RX 580 8GB or Arc A380',
      });
    });

    it('parses the recommended tier', () => {
      expect(requirements.recommended).toMatchObject({
        cpu: ['Core i7-12700', 'Ryzen 7 7800X3D'],
        gpu: [
          { name: 'GeForce RTX 2060 SUPER' },
          { name: 'Radeon RX 5700 XT' },
          { name: 'Arc A770' },
        ],
        ramGb: 16,
      });
    });
  });

  describe('The Witcher 3 (slash separators, VRAM in notes)', () => {
    const requirements = parseSteamRequirements(fixture(292030));

    it('splits alternatives on " / "', () => {
      expect(requirements.minimum?.cpu).toEqual(['Core i5-8400', 'Ryzen 5 2600']);
      expect(requirements.minimum?.gpu).toEqual([
        { name: 'GeForce GTX 1660' },
        { name: 'Radeon RX 5500 XT', vramGb: 8 },
        { name: 'Arc A580' },
      ]);
    });

    it('reads "60 SSD GB" as 60 GB on an SSD', () => {
      expect(requirements.minimum?.storage).toEqual({ gb: 60, ssd: true });
    });

    it('reads a VRAM requirement written in the notes', () => {
      expect(requirements.minimum?.vramGb).toBe(6);
      expect(requirements.recommended?.vramGb).toBe(8);
    });
  });

  describe('Dota 2 (comma separators, odd labels)', () => {
    const requirements = parseSteamRequirements(fixture(570));

    it('splits alternatives on commas, leaving tight slashes to name resolution', () => {
      expect(requirements.minimum?.gpu).toEqual([
        { name: 'NVIDIA GeForce 8600/9600GT' },
        { name: 'ATI/AMD Radeon HD2600/3600' },
      ]);
    });

    it('normalises a label like "OS *:"', () => {
      expect(requirements.minimum?.raw['os']).toBe('Windows 7 or newer');
    });

    it('has no recommended tier', () => {
      expect(requirements.recommended).toBeUndefined();
    });
  });

  describe('GTA V (parentheses containing separators)', () => {
    const requirements = parseSteamRequirements(fixture(271590));

    it('never splits inside parentheses', () => {
      expect(requirements.minimum?.cpu).toEqual([
        'Intel Core 2 Quad CPU Q6600 @ 2.40GHz (4 CPUs)',
        'AMD Phenom 9850 Quad-Core Processor (4 CPUs) @ 2.5GHz',
      ]);
      expect(requirements.minimum?.gpu).toEqual([
        { name: 'NVIDIA 9800 GT', vramGb: 1 },
        { name: 'AMD HD 4870 (DX 10, 10.1, 11)', vramGb: 1 },
      ]);
    });
  });

  describe('Counter-Strike 2 (trademarks, "or higher", generic GPU)', () => {
    const requirements = parseSteamRequirements(fixture(730));

    it('strips trademark symbols', () => {
      expect(requirements.minimum?.raw['os']).toBe('Windows 10');
    });

    it('does not treat "or higher" as an alternative', () => {
      expect(requirements.minimum?.cpu).toEqual(['4 hardware CPU threads - Intel Core i5 750']);
    });

    it('reads the VRAM of a generic graphics requirement', () => {
      expect(requirements.minimum?.gpu).toHaveLength(1);
      expect(requirements.minimum?.gpu[0].vramGb).toBe(1);
    });
  });

  describe('Counter-Strike (both tiers as unlabelled paragraphs in "minimum")', () => {
    const requirements = parseSteamRequirements(fixture(10));

    it('separates the minimum and recommended paragraphs', () => {
      expect(requirements.minimum?.raw['text']).toBe(
        '500 mhz processor, 96mb ram, 16mb video card, Windows XP, Mouse, Keyboard, Internet Connection',
      );
      expect(requirements.recommended?.raw['text']).toBe(
        '800 mhz processor, 128mb ram, 32mb+ video card, Windows XP, Mouse, Keyboard, Internet Connection',
      );
    });

    it('still reads the RAM from free text', () => {
      expect(requirements.minimum?.ramGb).toBe(96 / 1024);
      expect(requirements.recommended?.ramGb).toBe(128 / 1024);
    });

    it('leaves processor and graphics unresolved rather than guessing', () => {
      expect(requirements.minimum?.cpu).toEqual([]);
      expect(requirements.minimum?.gpu).toEqual([]);
    });
  });

  it('returns no tiers for an app without requirements (Steam sends [])', () => {
    expect(parseSteamRequirements([])).toEqual({});
  });

  describe('label variants', () => {
    const tier = (items: string) =>
      parseSteamRequirements({ minimum: `<ul class="bb_ul">${items}</ul>` }).minimum;

    it('reads "Video Card", "Hard Drive" and "Video Memory" as graphics, storage and VRAM', () => {
      expect(
        tier(
          '<li><strong>Video Card:</strong> GeForce GTX 660</li><li><strong>Hard Drive:</strong> 20 GB HD space</li><li><strong>Video Memory:</strong> 2 GB</li>',
        ),
      ).toMatchObject({
        gpu: [{ name: 'GeForce GTX 660' }],
        storage: { gb: 20, ssd: false },
        vramGb: 2,
      });
    });

    it('reads a value written inside the bold label', () => {
      expect(
        tier(
          '<li><strong>Processor: Dual core 3.0 GHz</strong></li><li><strong>Memory: 4GB</strong></li>',
        ),
      ).toMatchObject({
        cpu: ['Dual core 3.0 GHz'],
        ramGb: 4,
      });
    });
  });

  describe('alternative clean-up', () => {
    const tier = (graphics: string) =>
      parseSteamRequirements({
        minimum: `<ul class="bb_ul"><li><strong>Graphics:</strong> ${graphics}</li></ul>`,
      }).minimum;

    it('drops "or similar" and "or comparable"', () => {
      expect(tier('GeForce GTX 970 or similar')?.gpu).toEqual([{ name: 'GeForce GTX 970' }]);
      expect(tier('GeForce GTX 970 or comparable')?.gpu).toEqual([{ name: 'GeForce GTX 970' }]);
    });

    it('attaches a VRAM-only fragment to the GPU before it', () => {
      expect(tier('NVIDIA GeForce GTX 1050 Ti, 4 GB dedicated VRAM')?.gpu).toEqual([
        { name: 'NVIDIA GeForce GTX 1050 Ti', vramGb: 4 },
      ]);
      expect(tier('Dedicated Memory 2GB')?.gpu).toEqual([]);
      expect(tier('Dedicated Memory 2GB')?.vramGb).toBe(2);
    });
  });
});
