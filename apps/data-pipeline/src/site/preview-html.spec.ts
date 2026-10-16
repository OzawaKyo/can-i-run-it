import { describe, expect, it } from 'vitest';
import { previewHtml, previewPaths } from './preview-html';

const index = `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8">
    <title>Can I Run It?</title>
    <meta name="description" content="Generic.">
    <meta property="og:title" content="Can I Run It?">
    <base href="/">
  </head>
  <body><app-root></app-root></body>
</html>`;

describe('previewHtml', () => {
  const html = previewHtml(index, {
    name: 'Tom & Jerry "Deluxe"',
    headerImage: 'https://shared.akamai.steamstatic.com/header.jpg?t=1',
  });

  it('gives the page the game in its title and description', () => {
    expect(html).toContain('<title>Tom &amp; Jerry &quot;Deluxe&quot; — Can I Run It?</title>');
    expect(html).toContain(
      '<meta name="description" content="Ton PC peut-il faire tourner Tom &amp; Jerry &quot;Deluxe&quot; ?',
    );
    expect(html).not.toContain('Generic.');
  });

  it('adds the Open Graph tags chat apps read, with the banner as a large image', () => {
    expect(html).toContain(
      '<meta property="og:title" content="Tom &amp; Jerry &quot;Deluxe&quot;">',
    );
    expect(html).toContain(
      '<meta property="og:image" content="https://shared.akamai.steamstatic.com/header.jpg?t=1">',
    );
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image">');
    expect(html.match(/og:title/g)).toHaveLength(1);
  });

  it('keeps the app itself untouched', () => {
    expect(html).toContain('<base href="/">');
    expect(html).toContain('<body><app-root></app-root></body>');
  });

  it('leaves the image tags out when the game has no banner', () => {
    expect(previewHtml(index, { name: 'X' })).not.toContain('og:image');
  });
});

describe('previewPaths', () => {
  it('covers each address a game page is reached by', () => {
    expect(previewPaths({ id: '730', appid: 730, slug: 'counter-strike-2' })).toEqual([
      'game/730/counter-strike-2.html',
      'game/730.html',
    ]);
    expect(previewPaths({ id: 'valorant', slug: 'valorant' })).toEqual(['game/valorant.html']);
  });
});
