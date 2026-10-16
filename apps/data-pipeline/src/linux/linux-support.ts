import type { AntiCheatStatus, LinuxSupport, ProtonTier } from '@can-i-run-it/domain';

const TIERS: readonly ProtonTier[] = ['platinum', 'gold', 'silver', 'bronze', 'borked'];

/** The tier of a ProtonDB summary (`/api/v1/reports/summaries/<appid>.json`); "pending" is none. */
export function protonTier(body: string): ProtonTier | undefined {
  try {
    const tier = (JSON.parse(body) as { tier?: unknown }).tier;
    return TIERS.find((known) => known === tier);
  } catch {
    return undefined;
  }
}

/**
 * True when a store still selling the game lists Linux: PCGamingWiki's availability rows end
 * with the systems ("Windows, OS X, Linux"), then "|unavailable" once the store stopped.
 */
export function pcgwHasLinuxBuild(wikitext: string): boolean {
  return [...wikitext.matchAll(/\{\{Availability\/row\|([^}]*)\}\}/g)].some(([, row]) => {
    const fields = row.split('|').map((field) => field.trim());
    return fields.at(-1) !== 'unavailable' && /\bLinux\b/.test(fields[5] ?? '');
  });
}

/** One entry of AreWeAntiCheatYet's `games.json`. */
export interface AwacyGame {
  name: string;
  slug: string;
  status: string;
  storeIds?: { steam?: string };
}

const STATUSES: Record<string, AntiCheatStatus> = {
  Supported: 'supported',
  Running: 'running',
  Planned: 'planned',
  Broken: 'broken',
  Denied: 'denied',
};

/** Finds a game in AreWeAntiCheatYet's list, by Steam app id first, else by name. */
export function antiCheatLookup(games: readonly AwacyGame[]) {
  const bySteam = new Map<number, AwacyGame>();
  const byName = new Map<string, AwacyGame>();
  for (const game of games) {
    if (!STATUSES[game.status]) continue;
    if (game.storeIds?.steam) bySteam.set(Number(game.storeIds.steam), game);
    byName.set(nameKey(game.name), game);
  }
  return (game: {
    appid?: number;
    name: string;
  }): Pick<LinuxSupport, 'antiCheat' | 'antiCheatSlug'> | undefined => {
    const found =
      (game.appid !== undefined ? bySteam.get(game.appid) : undefined) ??
      byName.get(nameKey(game.name));
    return found && { antiCheat: STATUSES[found.status], antiCheatSlug: found.slug };
  };
}

function nameKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}
