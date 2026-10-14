/**
 * Extracts the GPU model from a WebGL `UNMASKED_RENDERER_WEBGL` string. Browsers format it
 * differently (Chrome/Edge wrap it in "ANGLE (vendor, device (id) API…)", Firefox may append
 * "or similar", Linux drivers append "/PCIe/SSE2"); software renderers yield undefined.
 */
export function gpuNameFromRenderer(renderer: string): string | undefined {
  if (!renderer || /swiftshader|llvmpipe|softpipe|software|microsoft basic render/i.test(renderer))
    return undefined;

  let name = renderer;
  const angle = renderer.match(/^ANGLE \(([^,]*),\s*(.*)\)$/);
  if (angle) {
    name = angle[2]
      .replace(/,\s*[^,]*$/, '') // ", D3D11" backend
      .replace(/\s*\(0x[0-9a-f]+\)/i, '')
      .replace(/\s+(?:Direct3D|OpenGL|Vulkan|Metal).*$/i, '');
  }
  name = name
    .replace(/,\s*or similar$/i, '')
    .replace(/\/.*$/, '')
    .trim();
  return name || undefined;
}

/** The GPU name the browser exposes through WebGL, if any. */
export function detectGpuName(): string | undefined {
  try {
    const gl = document.createElement('canvas').getContext('webgl');
    const debug = gl?.getExtension('WEBGL_debug_renderer_info');
    const renderer =
      gl && debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl?.getParameter(gl.RENDERER);
    return typeof renderer === 'string' ? gpuNameFromRenderer(renderer) : undefined;
  } catch {
    return undefined;
  }
}
