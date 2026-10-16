import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export interface PoliteFetchOptions {
  /** Where responses are cached; a cached response is reused without any request. */
  cacheDir: string;
  /** Minimum delay between two requests to the network. */
  minIntervalMs: number;
  /** Cached responses older than this are fetched again. */
  maxAgeMs: number;
  /** Wikimedia requires a contact in the User-Agent; other APIs don't. */
  requireContact: boolean;
  /** When the request fails, fall back to an expired cached response if there is one. */
  staleOnError?: boolean;
}

export class MissingContactError extends Error {
  constructor(readonly url: string) {
    super(`PIPELINE_CONTACT must be set to fetch ${url} (e.g. a repository URL or an email).`);
  }
}

export class HttpError extends Error {
  constructor(
    readonly url: string,
    readonly status: number,
  ) {
    super(`GET ${url} → HTTP ${status}`);
  }
}

/**
 * A rate-limited, caching GET for public APIs (Wikipedia, Steam). The User-Agent carries a
 * contact read from PIPELINE_CONTACT, as the Wikimedia policy requires; it is only needed
 * when something is actually fetched.
 */
export function createPoliteFetch({
  cacheDir,
  minIntervalMs,
  maxAgeMs,
  requireContact,
  staleOnError = false,
}: PoliteFetchOptions) {
  let lastRequest = 0;

  return async function get(url: string, cacheKey: string): Promise<string> {
    try {
      return await fetchCached(url, cacheKey);
    } catch (error) {
      if (!staleOnError) throw error;
      const stale = await readFile(join(cacheDir, cacheKey), 'utf8').catch(() => undefined);
      if (stale === undefined) throw error;
      return stale;
    }
  };

  async function fetchCached(url: string, cacheKey: string): Promise<string> {
    const cachePath = join(cacheDir, cacheKey);
    try {
      if (Date.now() - (await stat(cachePath)).mtimeMs < maxAgeMs)
        return await readFile(cachePath, 'utf8');
    } catch {
      // Not cached yet.
    }

    const contact = process.env['PIPELINE_CONTACT'];
    if (requireContact && !contact) throw new MissingContactError(url);
    const headers = {
      'User-Agent': `can-i-run-it-data-pipeline/0.1${contact ? ` (${contact})` : ''}`,
    };

    for (let attempt = 0; ; attempt++) {
      const wait = lastRequest + minIntervalMs * 2 ** attempt - Date.now();
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
      lastRequest = Date.now();

      const response = await fetch(url, { headers });
      if ((response.status === 429 || response.status >= 500) && attempt < 4) continue;
      if (!response.ok) throw new HttpError(url, response.status);

      const body = await response.text();
      await mkdir(dirname(cachePath), { recursive: true });
      await writeFile(cachePath, body);
      return body;
    }
  }
}
