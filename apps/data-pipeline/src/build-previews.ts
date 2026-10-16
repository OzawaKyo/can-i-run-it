import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { GameRecord } from '@can-i-run-it/domain';
import { previewHtml, previewPaths } from './site/preview-html';

/** Run after `web:build`: one HTML page per game in the built site, for link previews. */
const SITE_DIR = 'dist/apps/web/browser';

async function main() {
  const indexHtml = await readFile(join(SITE_DIR, 'index.html'), 'utf8');
  const files = (await readdir('data/games')).filter((file) => file !== 'index.json');
  for (const file of files) {
    const game = JSON.parse(await readFile(join('data/games', file), 'utf8')) as GameRecord;
    const html = previewHtml(indexHtml, game);
    for (const path of previewPaths(game)) {
      await mkdir(dirname(join(SITE_DIR, path)), { recursive: true });
      await writeFile(join(SITE_DIR, path), html);
    }
  }
  console.log(`Link previews written for ${files.length} games`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
