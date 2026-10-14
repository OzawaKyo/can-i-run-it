import { describe, expect, it } from 'vitest';
import { steamImage } from './steam-image';

describe('steamImage', () => {
  it('keeps https images from Steam’s CDN', () => {
    const url =
      'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/292030/abc/header.jpg?t=1';
    expect(steamImage(url)).toBe(url);
  });

  it('rejects anything else', () => {
    expect(steamImage('http://shared.akamai.steamstatic.com/header.jpg')).toBeUndefined();
    expect(steamImage('https://steamstatic.com.evil.example/header.jpg')).toBeUndefined();
    expect(steamImage('javascript:alert(1)')).toBeUndefined();
    expect(steamImage(undefined)).toBeUndefined();
  });
});
