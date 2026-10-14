/** An image URL from Steam's store data, kept only if it is served over https by Steam's CDN. */
export function steamImage(url: unknown): string | undefined {
  if (typeof url !== 'string') return undefined;
  try {
    const { protocol, hostname } = new URL(url);
    return protocol === 'https:' && /(^|\.)steamstatic\.com$/.test(hostname) ? url : undefined;
  } catch {
    return undefined;
  }
}
