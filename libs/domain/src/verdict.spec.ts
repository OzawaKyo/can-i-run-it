import { describe, expect, it } from 'vitest';
import type { HardwareModel } from './hardware';
import { computeVerdict } from './verdict';

const gpu = (id: string, score: number, extra: Partial<HardwareModel> = {}): HardwareModel => ({
  id,
  kind: 'gpu',
  name: id,
  score,
  ...extra,
});

const gtx1060 = gpu('gtx-1060', 100);
const rtx2060 = gpu('rtx-2060', 150);

describe('computeVerdict', () => {
  describe('GPU', () => {
    const requirements = { minimum: { gpu: [gtx1060] }, recommended: { gpu: [rtx2060] } };

    it('is below the minimum when clearly weaker', () => {
      expect(computeVerdict({ gpu: gpu('weak', 50) }, requirements).components.gpu).toBe('below');
    });

    it('meets the minimum when between the two tiers', () => {
      expect(computeVerdict({ gpu: gpu('mid', 125) }, requirements).components.gpu).toBe('minimum');
    });

    it('meets the recommended tier at or above its score', () => {
      expect(computeVerdict({ gpu: gpu('strong', 200) }, requirements).components.gpu).toBe(
        'recommended',
      );
    });

    it('is borderline within 10% of the minimum, either side', () => {
      expect(computeVerdict({ gpu: gpu('a', 95) }, requirements).components.gpu).toBe('borderline');
      expect(computeVerdict({ gpu: gpu('b', 105) }, requirements).components.gpu).toBe(
        'borderline',
      );
    });

    it('compares exactly when the user owns a listed model', () => {
      expect(computeVerdict({ gpu: gtx1060 }, requirements).components.gpu).toBe('minimum');
    });

    it('widens the borderline zone to 15% for laptop parts', () => {
      expect(computeVerdict({ gpu: gpu('desktop', 88) }, requirements).components.gpu).toBe(
        'below',
      );
      expect(
        computeVerdict({ gpu: gpu('laptop', 88, { laptop: true }) }, requirements).components.gpu,
      ).toBe('borderline');
    });

    it('uses the weakest listed alternative as the bar', () => {
      const withAlternative = { minimum: { gpu: [gtx1060, gpu('rx-580', 80)] } };
      expect(computeVerdict({ gpu: gpu('c', 95) }, withAlternative).components.gpu).toBe('minimum');
    });
  });

  it('applies the same rules to the CPU', () => {
    const i5 = { id: 'i5', kind: 'cpu' as const, name: 'i5', score: 100 };
    const verdict = computeVerdict(
      { cpu: { ...i5, id: 'other', score: 60 } },
      { minimum: { cpu: [i5] } },
    );
    expect(verdict.components.cpu).toBe('below');
  });

  describe('unknowns', () => {
    it('is unknown when the requirement could not be read', () => {
      expect(
        computeVerdict({ gpu: gtx1060 }, { minimum: { gpu: 'unresolved' } }).components.gpu,
      ).toBe('unknown');
    });

    it('is unknown when the user has not told us their part', () => {
      expect(computeVerdict({}, { minimum: { gpu: [gtx1060], ramGb: 8 } }).components).toEqual({
        gpu: 'unknown',
        ram: 'unknown',
      });
    });

    it('omits components the game does not mention', () => {
      expect(computeVerdict({ ramGb: 16 }, { minimum: { ramGb: 8 } }).components).toEqual({
        ram: 'minimum',
      });
    });
  });

  describe('RAM', () => {
    const requirements = { minimum: { ramGb: 12 }, recommended: { ramGb: 16 } };

    it('compares GB exactly, without a borderline zone', () => {
      expect(computeVerdict({ ramGb: 8 }, requirements).components.ram).toBe('below');
      expect(computeVerdict({ ramGb: 12 }, requirements).components.ram).toBe('minimum');
      expect(computeVerdict({ ramGb: 16 }, requirements).components.ram).toBe('recommended');
    });
  });

  describe('VRAM', () => {
    it("uses the tier's stated VRAM, else the weakest listed GPU's", () => {
      const fourGb = gpu('four', 999, { vramGb: 4 });
      expect(computeVerdict({ gpu: fourGb }, { minimum: { vramGb: 6 } }).components.vram).toBe(
        'below',
      );
      const listed = { minimum: { gpu: [gpu('x', 1, { vramGb: 3 }), gpu('y', 1, { vramGb: 8 })] } };
      expect(computeVerdict({ gpu: fourGb }, listed).components.vram).toBe('minimum');
    });
  });

  describe('DirectX', () => {
    it("checks the GPU's Direct3D support", () => {
      const dx11 = gpu('dx11', 999, { directX: 11 });
      expect(computeVerdict({ gpu: dx11 }, { minimum: { directX: 12 } }).components.directX).toBe(
        'below',
      );
      expect(computeVerdict({ gpu: dx11 }, { minimum: { directX: 11 } }).components.directX).toBe(
        'minimum',
      );
    });
  });

  describe('storage', () => {
    const ssdRequired = { minimum: { storage: { gb: 70, ssd: true } } };

    it('needs enough free space', () => {
      expect(
        computeVerdict({ freeStorageGb: 50, storageType: 'ssd' }, ssdRequired).components.storage,
      ).toBe('below');
    });

    it('fails an HDD when an SSD is required', () => {
      expect(
        computeVerdict({ freeStorageGb: 500, storageType: 'hdd' }, ssdRequired).components.storage,
      ).toBe('below');
      expect(
        computeVerdict({ freeStorageGb: 500, storageType: 'ssd' }, ssdRequired).components.storage,
      ).toBe('minimum');
    });

    it('is unknown when the disk type matters but was not given', () => {
      expect(computeVerdict({ freeStorageGb: 500 }, ssdRequired).components.storage).toBe(
        'unknown',
      );
    });
  });

  describe('overall', () => {
    it('is the worst component', () => {
      const requirements = {
        minimum: { gpu: [gtx1060], ramGb: 8 },
        recommended: { gpu: [rtx2060], ramGb: 16 },
      };
      expect(computeVerdict({ gpu: rtx2060, ramGb: 8 }, requirements).overall).toBe('minimum');
      expect(computeVerdict({ gpu: rtx2060, ramGb: 4 }, requirements).overall).toBe('below');
      expect(computeVerdict({ ramGb: 32 }, requirements).overall).toBe('unknown');
    });

    it('is unknown when the game publishes no requirements', () => {
      expect(computeVerdict({ ramGb: 32 }, {}).overall).toBe('unknown');
    });
  });
});
