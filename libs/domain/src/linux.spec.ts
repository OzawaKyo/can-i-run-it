import { describe, expect, it } from 'vitest';
import { linuxStatus } from './linux';

describe('linuxStatus', () => {
  it('says a game built for Linux is native', () => {
    expect(linuxStatus({ native: true, protonTier: 'silver' })).toBe('native');
  });

  it('reads ProtonDB tiers: gold and up works, silver and bronze with issues, borked not at all', () => {
    expect(linuxStatus({ protonTier: 'platinum' })).toBe('works');
    expect(linuxStatus({ protonTier: 'gold' })).toBe('works');
    expect(linuxStatus({ protonTier: 'silver' })).toBe('issues');
    expect(linuxStatus({ protonTier: 'bronze' })).toBe('issues');
    expect(linuxStatus({ protonTier: 'borked' })).toBe('broken');
  });

  it('puts an anti-cheat that refuses Linux above any player report', () => {
    expect(linuxStatus({ protonTier: 'gold', antiCheat: 'denied' })).toBe('blocked');
    expect(linuxStatus({ native: true, antiCheat: 'broken' })).toBe('blocked');
    expect(linuxStatus({ antiCheat: 'planned' })).toBe('blocked');
  });

  it('trusts an anti-cheat that works on Linux when players have not rated the game', () => {
    expect(linuxStatus({ antiCheat: 'supported' })).toBe('works');
    expect(linuxStatus({ antiCheat: 'running' })).toBe('works');
    expect(linuxStatus({ antiCheat: 'running', protonTier: 'bronze' })).toBe('issues');
  });

  it('knows nothing without data', () => {
    expect(linuxStatus(undefined)).toBe('unknown');
    expect(linuxStatus({})).toBe('unknown');
  });
});
