import type { GameRequirements } from '@can-i-run-it/domain';
import { createPoliteFetch, HttpError, MissingContactError } from '../http/polite-fetch';
import { parsePcgwRequirements, steamAppIds } from './parse-pcgw-requirements';

const API = 'https://www.pcgamingwiki.com/w/api.php';

/** PCGamingWiki allows 60 requests a minute and asks callers to cache; pages change rarely. */
const get = createPoliteFetch({
  cacheDir: '.cache/pipeline',
  minIntervalMs: 1100,
  maxAgeMs: 30 * 24 * 3600 * 1000,
  requireContact: true,
});

/**
 * The PCGamingWiki requirements of a Steam game, found by searching its name and kept only
 * if the page's infobox names the same Steam app id. Undefined when no page matches, or when
 * PCGamingWiki can't be reached (the game then keeps its Steam data alone).
 */
export async function fetchPcgwRequirements(
  appid: number,
  name: string,
): Promise<GameRequirements | undefined> {
  try {
    const query = name.replace(/[™®©]/g, '').trim();
    const search = JSON.parse(
      await get(
        `${API}?action=opensearch&search=${encodeURIComponent(query)}&limit=3&redirects=resolve&format=json`,
        `pcgamingwiki/search-${appid}.json`,
      ),
    ) as [string, string[]];
    for (const title of search[1] ?? []) {
      const page = JSON.parse(
        await get(
          `${API}?action=parse&page=${encodeURIComponent(title)}&prop=wikitext&format=json&formatversion=2&redirects=1`,
          `pcgamingwiki/page-${title.replace(/[^\w.-]+/g, '_')}.json`,
        ),
      ) as { parse?: { wikitext?: string } };
      const wikitext = page.parse?.wikitext;
      if (wikitext && steamAppIds(wikitext).includes(appid)) return parsePcgwRequirements(wikitext);
    }
    return undefined;
  } catch (error) {
    if (error instanceof MissingContactError || error instanceof HttpError) return undefined;
    throw error;
  }
}

/**
 * The wikitext of a PCGamingWiki page by title (redirects followed), or undefined when the
 * page doesn't exist or PCGamingWiki can't be reached.
 */
export async function fetchPcgwPage(title: string): Promise<string | undefined> {
  try {
    const page = JSON.parse(
      await get(
        `${API}?action=parse&page=${encodeURIComponent(title)}&prop=wikitext&format=json&formatversion=2&redirects=1`,
        `pcgamingwiki/page-${title.replace(/[^\w.-]+/g, '_')}.json`,
      ),
    ) as { parse?: { wikitext?: string } };
    return page.parse?.wikitext;
  } catch (error) {
    if (error instanceof MissingContactError || error instanceof HttpError) return undefined;
    throw error;
  }
}
