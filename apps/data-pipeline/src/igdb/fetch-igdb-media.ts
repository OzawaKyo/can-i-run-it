import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { igdbMedia, pickIgdbGame, type IgdbGame } from './igdb-media';

const CACHE_DIR = '.cache/pipeline/igdb';
const MAX_AGE_MS = 30 * 24 * 3600 * 1000;
/** IGDB allows 4 requests a second. */
const MIN_INTERVAL_MS = 300;

let token: string | undefined;
let lastRequest = 0;

/**
 * Images and official site of a game from IGDB (Twitch), cached for 30 days. Needs
 * IGDB_CLIENT_ID and IGDB_CLIENT_SECRET; without them, or if IGDB fails, the game simply
 * gets no image.
 */
export async function fetchIgdbMedia(
  name: string,
  cacheKey: string,
): Promise<{ headerImage?: string; capsuleImage?: string; officialUrl?: string }> {
  const results = await cachedSearch(name, cacheKey).catch((error: unknown) => {
    console.warn(
      `IGDB lookup failed for ${name}: ${error instanceof Error ? error.message : error}`,
    );
    return [];
  });
  const game = pickIgdbGame(results, name);
  return game ? igdbMedia(game) : {};
}

async function cachedSearch(name: string, cacheKey: string): Promise<IgdbGame[]> {
  const path = join(CACHE_DIR, `${cacheKey}.json`);
  try {
    if (Date.now() - (await stat(path)).mtimeMs < MAX_AGE_MS)
      return JSON.parse(await readFile(path, 'utf8'));
  } catch {
    // Not cached yet.
  }
  const clientId = process.env['IGDB_CLIENT_ID'];
  const clientSecret = process.env['IGDB_CLIENT_SECRET'];
  if (!clientId || !clientSecret) return [];

  token ??= await fetchToken(clientId, clientSecret);
  const wait = lastRequest + MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  lastRequest = Date.now();

  const query = `search "${name.replace(/"/g, '')}"; fields name,artworks.image_id,screenshots.image_id,websites.url,websites.type,websites.category; where platforms = (6); limit 5;`;
  const response = await fetch('https://api.igdb.com/v4/games', {
    method: 'POST',
    headers: {
      'Client-ID': clientId,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'text/plain',
    },
    body: query,
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const results = (await response.json()) as IgdbGame[];
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(results));
  return results;
}

/** Twitch app access token (client credentials), valid for weeks: fetched once per run. */
async function fetchToken(clientId: string, clientSecret: string): Promise<string> {
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'client_credentials',
  });
  const response = await fetch(`https://id.twitch.tv/oauth2/token?${params}`, { method: 'POST' });
  if (!response.ok) throw new Error(`Twitch token: HTTP ${response.status}`);
  return ((await response.json()) as { access_token: string }).access_token;
}
