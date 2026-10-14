import { mkdir, readFile, writeFile } from 'node:fs/promises';
import type { GameIndexEntry, GameRecord, HardwareModel } from '@can-i-run-it/domain';
import { resolveGameRequirements, type UnresolvedName } from './games/resolve-game-requirements';
import { createPoliteFetch } from './http/polite-fetch';
import { parseSteamRequirements } from './steam/parse-steam-requirements';
import { steamImage } from './steam/steam-image';

const OUT_DIR = 'data/games';
const DAY = 24 * 3600 * 1000;

/** How many popular games to include, before `extra-games.json`. */
const limit = Number(process.argv.find((arg) => arg.startsWith('--limit='))?.split('=')[1] ?? 1000);

const get = createPoliteFetch({
  cacheDir: '.cache/pipeline',
  minIntervalMs: 1600,
  maxAgeMs: 6 * DAY,
  requireContact: false,
});

async function main() {
  const catalog = {
    cpus: JSON.parse(await readFile('data/hardware/cpus.json', 'utf8')) as HardwareModel[],
    gpus: JSON.parse(await readFile('data/hardware/gpus.json', 'utf8')) as HardwareModel[],
  };
  const appids = await selectGames();

  await mkdir(OUT_DIR, { recursive: true });
  const index: GameIndexEntry[] = [];
  const unresolved = new Map<string, number>();
  let skipped = 0;

  for (const [position, appid] of appids.entries()) {
    const body = await get(
      `https://store.steampowered.com/api/appdetails?appids=${appid}&l=english`,
      `steam/appdetails-${appid}.json`,
    );
    const details = (JSON.parse(body) as Record<string, { success: boolean; data?: SteamAppData }>)[
      appid
    ];
    if (!details?.success || !details.data || details.data.type !== 'game') {
      skipped++;
      continue;
    }

    const { requirements, unresolved: missing } = resolveGameRequirements(
      parseSteamRequirements(details.data.pc_requirements),
      catalog,
    );
    countUnresolved(unresolved, missing);

    const record: GameRecord = {
      appid,
      name: details.data.name,
      slug: slug(details.data.name),
      source: 'steam',
      updatedAt: new Date().toISOString().slice(0, 10),
      headerImage: steamImage(details.data.header_image),
      requirements,
    };
    await writeFile(`${OUT_DIR}/${appid}.json`, `${JSON.stringify(record, null, 1)}\n`);
    index.push({
      appid,
      name: record.name,
      slug: record.slug,
      rank: position + 1,
      capsuleImage: steamImage(details.data.capsule_image),
    });
  }

  index.sort((a, b) => a.rank - b.rank);
  await writeFile(`${OUT_DIR}/index.json`, `${JSON.stringify(index, null, 1)}\n`);
  const report = [...unresolved.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }));
  await writeFile(
    '.cache/pipeline/games-report.json',
    `${JSON.stringify({ skipped, unresolved: report }, null, 2)}\n`,
  );
  console.log(
    `${index.length} games written, ${skipped} skipped, ${report.length} distinct unresolved names (details: .cache/pipeline/games-report.json)`,
  );
}

interface SteamAppData {
  type: string;
  name: string;
  header_image?: string;
  capsule_image?: string;
  pc_requirements: unknown;
}

/**
 * Popular games from SteamSpy (used only to pick appids, never republished): this fortnight's
 * most played first, then the most owned overall, then the manual extras.
 */
async function selectGames(): Promise<number[]> {
  const recent = JSON.parse(
    await get(
      'https://steamspy.com/api.php?request=top100in2weeks',
      'steamspy/top100in2weeks.json',
    ),
  ) as Record<string, { ccu?: number }>;
  // Object keys that look like integers come back sorted numerically, not in SteamSpy's
  // order: rank by concurrent players instead.
  const mostPlayed = Object.entries(recent)
    .sort(([, a], [, b]) => (b.ccu ?? 0) - (a.ccu ?? 0))
    .map(([appid]) => Number(appid));
  const all = JSON.parse(
    await get('https://steamspy.com/api.php?request=all&page=0', 'steamspy/all-0.json'),
  ) as Record<string, { owners?: string; ccu?: number }>;
  const mostOwned = Object.entries(all)
    .sort(
      ([, a], [, b]) =>
        ownersLowerBound(b.owners) - ownersLowerBound(a.owners) || (b.ccu ?? 0) - (a.ccu ?? 0),
    )
    .map(([appid]) => Number(appid));
  const extras = JSON.parse(
    await readFile('apps/data-pipeline/extra-games.json', 'utf8'),
  ) as number[];
  const popular = [...new Set([...mostPlayed, ...mostOwned])].slice(0, limit);
  return [...new Set([...popular, ...extras])];
}

/** SteamSpy gives owners as a range: "20,000,000 .. 50,000,000". */
function ownersLowerBound(owners: string | undefined): number {
  return Number(owners?.split('..')[0]?.replace(/[^\d]/g, '') || 0);
}

function countUnresolved(counts: Map<string, number>, names: UnresolvedName[]) {
  for (const { kind, name } of names)
    counts.set(`${kind}: ${name}`, (counts.get(`${kind}: ${name}`) ?? 0) + 1);
}

function slug(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
