import type { GameRecord } from '@can-i-run-it/domain';

/**
 * The app's index.html with a game's title, description and banner, for link previews:
 * Discord, WhatsApp and the like read these tags without running the app. The page is
 * otherwise the same app, which then renders the game as usual.
 */
export function previewHtml(
  indexHtml: string,
  game: Pick<GameRecord, 'name' | 'headerImage'>,
): string {
  const name = escape(game.name);
  const description = `Ton PC peut-il faire tourner ${name} ? Configurations minimale et recommandée, verdict, FPS estimés et compatibilité Linux.`;
  const tags = [
    `<meta name="description" content="${description}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="Can I Run It?">`,
    `<meta property="og:title" content="${name}">`,
    `<meta property="og:description" content="${description}">`,
    ...(game.headerImage
      ? [
          `<meta property="og:image" content="${escape(game.headerImage)}">`,
          `<meta name="twitter:card" content="summary_large_image">`,
        ]
      : []),
  ];
  return indexHtml
    .replace(/\s*<meta (?:property="og:|name="twitter:)[^>]*>/g, '')
    .replace(/<title>[^<]*<\/title>/, `<title>${name} — Can I Run It?</title>`)
    .replace(/<meta name="description"[^>]*>/, tags.join('\n    '));
}

/** Where the preview goes so that each route of the game serves it (`/game/730/slug`, `/game/730`). */
export function previewPaths(game: Pick<GameRecord, 'id' | 'appid' | 'slug'>): string[] {
  return game.appid !== undefined
    ? [`game/${game.id}/${game.slug}.html`, `game/${game.id}.html`]
    : [`game/${game.id}.html`];
}

function escape(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
