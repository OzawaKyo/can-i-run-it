/** ProtonDB's player rating of a Windows game run through Proton (Steam's compatibility layer). */
export type ProtonTier = 'platinum' | 'gold' | 'silver' | 'bronze' | 'borked';

/** AreWeAntiCheatYet's status of the game's anti-cheat on Linux. */
export type AntiCheatStatus = 'supported' | 'running' | 'planned' | 'broken' | 'denied';

/** What is known about a game on Linux, as stored in `data/games`. */
export interface LinuxSupport {
  /** A Linux build exists (Steam or the official store). */
  native?: true;
  protonTier?: ProtonTier;
  antiCheat?: AntiCheatStatus;
  /** AreWeAntiCheatYet page, when it lists the game. */
  antiCheatSlug?: string;
}

/**
 * native: a Linux version exists · works / issues / broken: through Proton, by player reports ·
 * blocked: the anti-cheat refuses Linux (online play at least) · unknown: no data.
 */
export type LinuxStatus = 'native' | 'works' | 'issues' | 'broken' | 'blocked' | 'unknown';

/** Sums up whether a game runs on Linux; an anti-cheat that keeps Linux out overrides everything. */
export function linuxStatus(linux: LinuxSupport | undefined): LinuxStatus {
  if (!linux) return 'unknown';
  // "planned": the developer has announced Linux support, but it is not there yet.
  if (linux.antiCheat && ['denied', 'broken', 'planned'].includes(linux.antiCheat))
    return 'blocked';
  if (linux.native) return 'native';
  switch (linux.protonTier) {
    case 'platinum':
    case 'gold':
      return 'works';
    case 'silver':
    case 'bronze':
      return 'issues';
    case 'borked':
      return 'broken';
  }
  return linux.antiCheat === 'supported' || linux.antiCheat === 'running' ? 'works' : 'unknown';
}
