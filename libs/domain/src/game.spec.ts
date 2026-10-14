import { describe, expect, it } from 'vitest';
import { hydrateRequirements, type StoredTier } from './game';
import type { HardwareModel } from './hardware';

const gtx1060: HardwareModel = {
  id: 'gtx-1060',
  kind: 'gpu',
  name: 'GeForce GTX 1060',
  score: 100,
};
const models = new Map([[gtx1060.id, gtx1060]]);

const tier = (overrides: Partial<StoredTier>): StoredTier => ({
  cpu: { raw: [], ids: [] },
  gpu: { raw: [], ids: [] },
  raw: {},
  ...overrides,
});

describe('hydrateRequirements', () => {
  it('replaces resolved ids with catalog models and copies plain quantities', () => {
    const resolved = hydrateRequirements(
      { minimum: tier({ gpu: { raw: ['GTX 1060'], ids: ['gtx-1060'] }, ramGb: 8, directX: 11 }) },
      models,
    );
    expect(resolved.minimum).toEqual({ gpu: [gtx1060], ramGb: 8, directX: 11 });
  });

  it('marks a named but unrecognised part as unresolved', () => {
    const resolved = hydrateRequirements(
      { minimum: tier({ cpu: { raw: ['Dual core 2.8 GHz'], ids: [] } }) },
      models,
    );
    expect(resolved.minimum?.cpu).toBe('unresolved');
  });

  it('treats ids missing from the catalog as unresolved', () => {
    const resolved = hydrateRequirements(
      { minimum: tier({ gpu: { raw: ['X'], ids: ['gone'] } }) },
      models,
    );
    expect(resolved.minimum?.gpu).toBe('unresolved');
  });

  it('leaves out parts the game does not mention', () => {
    const resolved = hydrateRequirements({ minimum: tier({ ramGb: 4 }) }, models);
    expect(resolved.minimum).toEqual({ ramGb: 4 });
  });

  it('marks CPU and GPU unresolved in an unstructured tier', () => {
    const resolved = hydrateRequirements(
      { minimum: tier({ ramGb: 0.125, raw: { text: '500 mhz processor, 128mb ram' } }) },
      models,
    );
    expect(resolved.minimum).toEqual({ cpu: 'unresolved', gpu: 'unresolved', ramGb: 0.125 });
  });

  it('uses an estimated score when the requirement only gave a clock speed', () => {
    const resolved = hydrateRequirements(
      { minimum: tier({ cpu: { raw: ['2.4 GHz Dual Core'], ids: [], estimatedScore: 35 } }) },
      models,
    );
    expect(resolved.minimum?.cpu).toEqual([
      { id: 'estimate', kind: 'cpu', name: '2.4 GHz Dual Core', score: 35 },
    ]);
  });

  it('leaves the GPU out when the requirement was only a DirectX level or memory size', () => {
    const resolved = hydrateRequirements(
      {
        minimum: tier({
          gpu: { raw: ['DirectX 11 capable card'], ids: [], capabilityOnly: true },
          directX: 11,
        }),
      },
      models,
    );
    expect(resolved.minimum).toEqual({ directX: 11 });
  });
});
