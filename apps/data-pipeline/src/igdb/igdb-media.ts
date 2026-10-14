/** The fields we ask IGDB for (see fetch-igdb-media.ts). */
export interface IgdbGame {
  id: number;
  name: string;
  artworks?: { image_id: string }[];
  screenshots?: { image_id: string }[];
  /** `type` (current API) or `category` (older responses): 1 is the official site. */
  websites?: { url: string; type?: number; category?: number }[];
}

const OFFICIAL_WEBSITE = 1;
const IMAGE_BASE = 'https://images.igdb.com/igdb/image/upload';

/** The search hit whose name matches exactly (ignoring case), else the first one. */
export function pickIgdbGame(results: IgdbGame[], name: string): IgdbGame | undefined {
  return results.find((game) => game.name.toLowerCase() === name.toLowerCase()) ?? results[0];
}

/**
 * A landscape banner and capsule (artwork, else a screenshot; covers are portrait) and the
 * official site. Image ids and URLs are checked, as they end up in the site's pages.
 */
export function igdbMedia(game: IgdbGame): {
  headerImage?: string;
  capsuleImage?: string;
  officialUrl?: string;
} {
  const media: { headerImage?: string; capsuleImage?: string; officialUrl?: string } = {};
  const imageId = [...(game.artworks ?? []), ...(game.screenshots ?? [])]
    .map((image) => image.image_id)
    .find((id) => /^[a-z0-9]+$/i.test(id));
  if (imageId) {
    media.headerImage = `${IMAGE_BASE}/t_screenshot_big/${imageId}.jpg`;
    media.capsuleImage = `${IMAGE_BASE}/t_screenshot_med/${imageId}.jpg`;
  }
  const official = game.websites?.find(
    (site) => (site.type ?? site.category) === OFFICIAL_WEBSITE && /^https?:\/\//i.test(site.url),
  );
  if (official) media.officialUrl = official.url;
  return media;
}
