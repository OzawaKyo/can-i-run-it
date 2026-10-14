import type { HardwareModel } from '@can-i-run-it/domain';
import { describe, expect, it } from 'vitest';
import { resolveGameRequirements } from './resolve-game-requirements';

const catalog = {
  cpus: [
    { id: 'i7-6700', kind: 'cpu', name: 'Core i7-6700' },
    { id: 'r5-1600', kind: 'cpu', name: 'Ryzen 5 1600' },
  ] satisfies HardwareModel[],
  gpus: [
    { id: 'gtx-1060-3gb', kind: 'gpu', name: 'GeForce GTX 1060 3GB', vramGb: 3 },
    { id: 'gtx-1060-6gb', kind: 'gpu', name: 'GeForce GTX 1060 6GB', vramGb: 6 },
    { id: 'rx-580-8gb', kind: 'gpu', name: 'Radeon RX 580 8GB', vramGb: 8 },
  ] satisfies HardwareModel[],
};

describe('resolveGameRequirements', () => {
  const { requirements, unresolved } = resolveGameRequirements(
    {
      minimum: {
        cpu: ['Core i7-6700', 'Ryzen 5 1600'],
        gpu: [
          { name: 'GeForce GTX 1060', vramGb: 6 },
          { name: 'Radeon RX 580', vramGb: 8 },
          { name: 'Arc A380' },
        ],
        ramGb: 12,
        raw: { memory: '12 GB RAM' },
      },
    },
    catalog,
  );

  it('stores the raw names with the catalog ids they resolved to', () => {
    expect(requirements.minimum?.cpu).toEqual({
      raw: ['Core i7-6700', 'Ryzen 5 1600'],
      ids: ['i7-6700', 'r5-1600'],
    });
    expect(requirements.minimum?.gpu).toEqual({
      raw: ['GeForce GTX 1060 6GB', 'Radeon RX 580 8GB', 'Arc A380'],
      ids: ['gtx-1060-6gb', 'rx-580-8gb'],
    });
  });

  it('takes the smallest VRAM stated next to a listed GPU', () => {
    expect(requirements.minimum?.vramGb).toBe(6);
  });

  it('copies plain quantities and raw text', () => {
    expect(requirements.minimum).toMatchObject({ ramGb: 12, raw: { memory: '12 GB RAM' } });
  });

  it('reports names it could not resolve', () => {
    expect(unresolved).toEqual([{ kind: 'gpu', name: 'Arc A380' }]);
  });

  describe('generic requirements', () => {
    const resolveMinimum = (cpu: string[], gpu: string[], directX?: number) =>
      resolveGameRequirements(
        { minimum: { cpu, gpu: gpu.map((name) => ({ name })), directX, raw: {} } },
        catalog,
      ).requirements.minimum;

    it('estimates a CPU given only by clock and core count, as a Core 2-era chip', () => {
      const dualCore = resolveMinimum(['2.4 GHz Dual Core Processor'], [])?.cpu;
      const singleCore = resolveMinimum(['2 GHz Processor'], [])?.cpu;
      expect(dualCore?.estimatedScore).toBeGreaterThan(0);
      expect(singleCore?.estimatedScore).toBeLessThan(dualCore?.estimatedScore ?? 0);
    });

    it('does not estimate when a named model resolved', () => {
      expect(
        resolveMinimum(['Core i7-6700', '3 GHz Quad Core'], [])?.cpu.estimatedScore,
      ).toBeUndefined();
    });

    it('turns a GPU given only by DirectX or Shader Model into a DirectX requirement', () => {
      expect(resolveMinimum([], ['DirectX 11+ capable Graphics Card'])).toMatchObject({
        gpu: { capabilityOnly: true },
        directX: 11,
      });
      expect(resolveMinimum([], ['Video card with Shader Model 5.0 support'])).toMatchObject({
        gpu: { capabilityOnly: true },
        directX: 11,
      });
      expect(resolveMinimum([], ['DirectX 10 card'], 11)).toMatchObject({ directX: 11 });
    });

    it('keeps an unrecognised named GPU unresolved', () => {
      expect(resolveMinimum([], ['Matrox Parhelia'])?.gpu.capabilityOnly).toBeUndefined();
    });
  });

  describe('PCGamingWiki fallback', () => {
    const steam = {
      minimum: {
        cpu: ['Intel Core i5'],
        gpu: [{ name: 'GeForce GTX 1060', vramGb: 6 }],
        ramGb: 8,
        raw: {},
      },
    };
    const pcgw = {
      minimum: { cpu: ['Ryzen 5 1600'], gpu: [{ name: 'Radeon RX 580' }], raw: {} },
    };
    const { requirements, unresolved } = resolveGameRequirements(steam, catalog, pcgw);

    it("replaces a component Steam doesn't name precisely, and says where it came from", () => {
      expect(requirements.minimum?.cpu).toEqual({
        raw: ['Ryzen 5 1600'],
        ids: ['r5-1600'],
        source: 'pcgamingwiki',
      });
    });

    it('keeps what Steam resolved', () => {
      expect(requirements.minimum?.gpu).toEqual({
        raw: ['GeForce GTX 1060 6GB'],
        ids: ['gtx-1060-6gb'],
      });
      expect(requirements.minimum?.ramGb).toBe(8);
    });

    it('only reports names that stay unresolved', () => {
      expect(unresolved).toEqual([]);
    });
  });

  describe('pre-DirectX 10 graphics cards', () => {
    const gpuOf = (names: string[]) =>
      resolveGameRequirements(
        { minimum: { cpu: [], gpu: names.map((name) => ({ name })), raw: {} } },
        catalog,
      ).requirements.minimum;

    it('turns them into a DirectX 9 requirement any later card meets', () => {
      expect(gpuOf(['ATI X1600', 'NVidia 7600'])).toMatchObject({
        gpu: { capabilityOnly: true },
        directX: 9,
      });
      expect(gpuOf(['ATI Radeon 9600', 'NVIDIA GeForce 6800 GT'])).toMatchObject({ directX: 9 });
      expect(gpuOf(['Intel GMA 950'])).toMatchObject({ directX: 9 });
    });

    it('does the same when only one alternative is that old, as the weakest sets the bar', () => {
      expect(gpuOf(['GeForce GTX 1060', 'ATI Radeon X1950'])).toMatchObject({
        gpu: { capabilityOnly: true },
        directX: 9,
      });
    });

    it('leaves modern cards with similar numbers alone', () => {
      expect(gpuOf(['GeForce GTX 1060'])?.gpu.capabilityOnly).toBeUndefined();
      expect(gpuOf(['Radeon RX 7600'])?.directX).toBeUndefined();
    });
  });
});
