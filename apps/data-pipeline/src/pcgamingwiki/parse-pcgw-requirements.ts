import type { GameRequirements, RequirementTier } from '@can-i-run-it/domain';
import { parseDirectX, parseGpu, parseSizeGb } from '../steam/parse-steam-requirements';

/**
 * Reads the Windows `{{System requirements}}` block of a PCGamingWiki page. Only the
 * minimum and recommended tiers are read; the extra "alt" tiers have no Steam equivalent.
 */
export function parsePcgwRequirements(wikitext: string): GameRequirements {
  const block = systemRequirementBlocks(wikitext).find((fields) =>
    /windows/i.test(fields.get('osfamily') ?? ''),
  );
  if (!block) return {};
  const requirements: GameRequirements = {};
  const minimum = readTier(block, 'min');
  const recommended = readTier(block, 'rec');
  if (minimum) requirements.minimum = minimum;
  if (recommended) requirements.recommended = recommended;
  return requirements;
}

/** The game's own Steam app ids (`|steam appid = 292030`), not the DLC listed under `steam appid side`. */
export function steamAppIds(wikitext: string): number[] {
  const line = wikitext.match(/^\|\s*steam appid\s*=([^\n]*)$/im)?.[1] ?? '';
  return [...line.matchAll(/\d+/g)].map((match) => Number(match[0]));
}

function readTier(fields: Map<string, string>, prefix: 'min' | 'rec'): RequirementTier | undefined {
  const numbered = (name: string) =>
    [...fields.entries()]
      .filter(([key]) => new RegExp(`^${prefix}${name}\\d*$`).test(key))
      .sort(([a], [b]) => a.localeCompare(b, 'en', { numeric: true }))
      .map(([, value]) => value)
      .filter(Boolean);

  const cpu = numbered('cpu');
  const gpu = numbered('gpu');
  const ram = fields.get(`${prefix}ram`) ?? '';
  const vram = fields.get(`${prefix}vram`) ?? '';
  const storage = fields.get(`${prefix}hd`) ?? '';
  const directX = parseDirectX(fields.get(`${prefix}dx`));
  if (!cpu.length && !gpu.length && !ram && !storage) return undefined;

  const storageGb = parseSizeGb(storage);
  const raw: Record<string, string> = {};
  if (cpu.length) raw['processor'] = cpu.join(' / ');
  if (gpu.length) raw['graphics'] = gpu.join(' / ');
  if (ram) raw['memory'] = ram;
  if (storage) raw['storage'] = storage;

  return withoutUndefined({
    cpu,
    gpu: gpu.map(parseGpu),
    ramGb: parseSizeGb(ram),
    vramGb: parseSizeGb(vram),
    directX,
    storage: storageGb === undefined ? undefined : { gb: storageGb, ssd: /\bssd\b/i.test(storage) },
    raw,
  });
}

/** Each `{{System requirements …}}` block as a lowercased field → cleaned value map. */
function systemRequirementBlocks(wikitext: string): Map<string, string>[] {
  const blocks: Map<string, string>[] = [];
  for (const [, body] of wikitext.matchAll(/\{\{System requirements\s*\n(.*?)\n\}\}/gis)) {
    const fields = new Map<string, string>();
    for (const [, key, value] of body.matchAll(/^\|\s*([a-z0-9]+)\s*=(.*)$/gim)) {
      fields.set(key.toLowerCase(), cleanWikitext(value));
    }
    blocks.push(fields);
  }
  return blocks;
}

/** Drops templates ({{note|…}}), references and markup; keeps link labels ([[a|b]] → b). */
function cleanWikitext(text: string): string {
  let cleaned = text;
  // Templates can nest: strip the innermost ones until none remain.
  for (let previous = ''; previous !== cleaned;) {
    previous = cleaned;
    cleaned = cleaned.replace(/\{\{[^{}]*\}\}/g, '');
  }
  return cleaned
    .replace(/<ref[^>]*\/>|<ref[^>]*>.*?<\/ref>/gis, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1')
    .replace(/'{2,}/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function withoutUndefined<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, field]) => field !== undefined)) as T;
}
