import { gpuNameFromRenderer } from './detect-gpu';

describe('gpuNameFromRenderer', () => {
  it('reads the device out of a Chrome/Edge ANGLE string', () => {
    expect(
      gpuNameFromRenderer(
        'ANGLE (NVIDIA, NVIDIA GeForce RTX 3070 (0x00002484) Direct3D11 vs_5_0 ps_5_0, D3D11)',
      ),
    ).toBe('NVIDIA GeForce RTX 3070');
    expect(
      gpuNameFromRenderer(
        'ANGLE (Intel, Intel(R) UHD Graphics 630 (0x00003E92) Direct3D11 vs_5_0 ps_5_0, D3D11)',
      ),
    ).toBe('Intel(R) UHD Graphics 630');
    expect(
      gpuNameFromRenderer('ANGLE (AMD, AMD Radeon RX 6600 Direct3D11 vs_5_0 ps_5_0, D3D11)'),
    ).toBe('AMD Radeon RX 6600');
  });

  it('drops the "or similar" Firefox adds when it masks the exact model', () => {
    expect(gpuNameFromRenderer('NVIDIA GeForce GTX 980, or similar')).toBe(
      'NVIDIA GeForce GTX 980',
    );
  });

  it('drops the bus suffixes of Linux drivers', () => {
    expect(gpuNameFromRenderer('GeForce GTX 1060 6GB/PCIe/SSE2')).toBe('GeForce GTX 1060 6GB');
  });

  it('ignores software renderers', () => {
    expect(
      gpuNameFromRenderer(
        'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)',
      ),
    ).toBeUndefined();
    expect(gpuNameFromRenderer('llvmpipe (LLVM 15.0.7, 256 bits)')).toBeUndefined();
    expect(gpuNameFromRenderer('')).toBeUndefined();
  });
});
