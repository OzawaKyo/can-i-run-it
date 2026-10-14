import { describe, expect, it } from 'vitest';
import { igdbMedia, pickIgdbGame, type IgdbGame } from './igdb-media';

const valorant: IgdbGame = {
  id: 1,
  name: 'Valorant',
  artworks: [{ image_id: 'ar1abc' }],
  screenshots: [{ image_id: 'sc9xyz' }],
  websites: [
    { url: 'https://twitter.com/playvalorant', type: 5 },
    { url: 'https://playvalorant.com/', type: 1 },
  ],
};

describe('pickIgdbGame', () => {
  it('prefers the exact name over the first search hit', () => {
    const results = [{ id: 2, name: 'Valorant: Champions Tour' }, valorant];
    expect(pickIgdbGame(results, 'VALORANT')).toBe(valorant);
  });

  it('falls back to the first hit, or nothing', () => {
    expect(pickIgdbGame([valorant], 'Valorant Remastered')).toBe(valorant);
    expect(pickIgdbGame([], 'Valorant')).toBeUndefined();
  });
});

describe('igdbMedia', () => {
  it('builds a landscape banner and capsule from the artwork, and finds the official site', () => {
    expect(igdbMedia(valorant)).toEqual({
      headerImage: 'https://images.igdb.com/igdb/image/upload/t_screenshot_big/ar1abc.jpg',
      capsuleImage: 'https://images.igdb.com/igdb/image/upload/t_screenshot_med/ar1abc.jpg',
      officialUrl: 'https://playvalorant.com/',
    });
  });

  it('uses a screenshot when there is no artwork, and the legacy website category', () => {
    expect(
      igdbMedia({
        id: 3,
        name: 'X',
        screenshots: [{ image_id: 'sc1' }],
        websites: [{ url: 'https://x.example/', category: 1 }],
      }),
    ).toEqual({
      headerImage: 'https://images.igdb.com/igdb/image/upload/t_screenshot_big/sc1.jpg',
      capsuleImage: 'https://images.igdb.com/igdb/image/upload/t_screenshot_med/sc1.jpg',
      officialUrl: 'https://x.example/',
    });
  });

  it('drops image ids and URLs that are not safe to put in a page', () => {
    expect(
      igdbMedia({
        id: 4,
        name: 'Y',
        artworks: [{ image_id: '../evil' }],
        websites: [{ url: 'javascript:alert(1)', type: 1 }],
      }),
    ).toEqual({});
  });
});
