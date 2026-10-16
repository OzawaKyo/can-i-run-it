import { decodeSharedPc, encodeSharedPc } from './share';

describe('shared PC', () => {
  it('round-trips a full configuration through a short, readable value', () => {
    const pc = {
      cpuId: 'intel-core-i5-1135g7',
      gpuId: 'intel-iris-xe-graphics',
      ramGb: 16,
      freeStorageGb: 204,
      storageType: 'ssd' as const,
    };
    expect(encodeSharedPc(pc)).toBe('intel-core-i5-1135g7,intel-iris-xe-graphics,16,204,ssd');
    expect(decodeSharedPc(encodeSharedPc(pc))).toEqual(pc);
  });

  it('leaves out what was not filled in', () => {
    expect(encodeSharedPc({ gpuId: 'amd-radeon-rx-6600', ramGb: 8 })).toBe(
      ',amd-radeon-rx-6600,8,,',
    );
    expect(decodeSharedPc(',amd-radeon-rx-6600,8,,')).toEqual({
      gpuId: 'amd-radeon-rx-6600',
      ramGb: 8,
    });
  });

  it('rejects anything a link could carry that is not a configuration', () => {
    expect(decodeSharedPc(undefined)).toBeUndefined();
    expect(decodeSharedPc('')).toBeUndefined();
    expect(decodeSharedPc(',,,,')).toBeUndefined();
    expect(decodeSharedPc('<script>,x,1,1,ssd')).toEqual({
      gpuId: 'x',
      ramGb: 1,
      freeStorageGb: 1,
      storageType: 'ssd',
    });
    expect(decodeSharedPc('a,b,-4,1e9,floppy')).toEqual({ cpuId: 'a', gpuId: 'b' });
  });
});
