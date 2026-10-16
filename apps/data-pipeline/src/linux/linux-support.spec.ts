import { describe, expect, it } from 'vitest';
import { antiCheatLookup, pcgwHasLinuxBuild, protonTier } from './linux-support';

describe('protonTier', () => {
  it('reads the tier of a ProtonDB summary', () => {
    expect(
      protonTier(
        '{"bestReportedTier":"platinum","confidence":"strong","tier":"gold","total":2059}',
      ),
    ).toBe('gold');
  });

  it('ignores games without enough reports, and anything unexpected', () => {
    expect(protonTier('{"tier":"pending","total":1}')).toBeUndefined();
    expect(protonTier('{"tier":"diamond"}')).toBeUndefined();
    expect(protonTier('<html>')).toBeUndefined();
  });
});

describe('pcgwHasLinuxBuild', () => {
  it('finds Linux among the systems of a store that sells the game', () => {
    expect(
      pcgwHasLinuxBuild(
        '{{Availability/row| Official | https://www.minecraft.net/ | account | | | Windows, OS X, Linux}}',
      ),
    ).toBe(true);
  });

  it('ignores stores that no longer sell it, and Windows-only games', () => {
    expect(
      pcgwHasLinuxBuild(
        '{{Availability/row| Amazon | B010KYDNDG | account | | | Windows, OS X, Linux|unavailable}}\n{{Availability/row| Official | https://x | Riot | | | Windows}}',
      ),
    ).toBe(false);
  });
});

describe('antiCheatLookup', () => {
  const find = antiCheatLookup([
    {
      name: 'Apex Legends',
      slug: 'apex-legends',
      status: 'Denied',
      storeIds: { steam: '1172470' },
    },
    { name: 'Valorant', slug: 'valorant', status: 'Denied', storeIds: {} },
    { name: 'Counter-Strike 2', slug: 'cstrike2', status: 'Supported', storeIds: {} },
    { name: 'Odd', slug: 'odd', status: 'Unheard of', storeIds: {} },
  ]);

  it('finds a game by Steam app id, then by name', () => {
    expect(find({ appid: 1172470, name: 'Apex Legends™' })).toEqual({
      antiCheat: 'denied',
      antiCheatSlug: 'apex-legends',
    });
    expect(find({ appid: 730, name: 'Counter-Strike 2' })).toEqual({
      antiCheat: 'supported',
      antiCheatSlug: 'cstrike2',
    });
    expect(find({ name: 'VALORANT' })?.antiCheat).toBe('denied');
  });

  it('returns nothing for unlisted games or unknown statuses', () => {
    expect(find({ appid: 1, name: 'Portal' })).toBeUndefined();
    expect(find({ name: 'Odd' })).toBeUndefined();
  });
});
