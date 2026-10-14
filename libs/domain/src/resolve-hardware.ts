import type { HardwareMatch, HardwareModel } from './hardware';

export interface ResolveHints {
  /** VRAM stated next to the GPU name; picks between memory variants of the same model. */
  vramGb?: number;
}

/**
 * Finds the catalog models a raw requirement name refers to. Returns every equally good
 * candidate (e.g. both memory variants when no VRAM is given); empty when unresolved.
 */
export function resolveHardware(
  raw: string,
  catalog: readonly HardwareModel[],
  hints: ResolveHints = {},
): HardwareMatch[] {
  return expandTightSlashes(raw).flatMap((name) => resolveOne(name, catalog, hints));
}

function resolveOne(
  raw: string,
  catalog: readonly HardwareModel[],
  hints: ResolveHints,
): HardwareMatch[] {
  const rawKey = matchKey(raw);
  // A name that gives its vendor only matches that vendor's models ("Radeon 8500" ≠ "GeForce 8500 GT"),
  // and bare family names ("HD Graphics") never stand for one model.
  const vendor = vendorOf(raw);
  catalog = catalog.filter(
    (model) =>
      !GENERIC_FAMILY.test(model.name) &&
      (!vendor || !modelVendor(model) || modelVendor(model) === vendor),
  );
  let best: HardwareModel[] = [];
  let bestLength = 0;
  for (const model of catalog) {
    const key = matchKey(model.name);
    if (!key || !containsModelKey(rawKey, key)) continue;
    if (key.length > bestLength) {
      best = [model];
      bestLength = key.length;
    } else if (key.length === bestLength) {
      best.push(model);
    }
  }
  if (best.length > 0)
    return pickVram(best, hints).map((model) => ({ model, confidence: 'exact' }));

  // "GeForce 8600" names a family ("8600 GT", "8600 GTS"): accept the variants, flagged as partial.
  // A family ("GeForce 9800") means desktop cards unless the name says laptop.
  const laptopName = /\b(?:laptop|mobile|mobility|notebook)\b|\d+m\b/i.test(raw);
  const variants = catalog.filter(
    (model) => isVariantOf(matchKey(model.name), rawKey) && (laptopName || !model.laptop),
  );
  if (variants.length > 0)
    return pickVram(variants, hints).map((model) => ({ model, confidence: 'partial' }));

  // "GeForce 760" without its series prefix: try the GeForce series that used that number.
  if (/^\d{3,4}(?:ti|super)?$/.test(rawKey)) {
    const prefixed = catalog.filter((model) =>
      GEFORCE_SERIES.some((series) => matchKey(model.name) === series + rawKey),
    );
    if (prefixed.length > 0)
      return pickVram(prefixed, hints).map((model) => ({ model, confidence: 'partial' }));
  }

  // A whole series, every card whose number fills in the zeros: "Radeon HD 7800" (78xx),
  // "Radeon 3000 series" (3xxx), "GeForce 200 series" (any prefix + 2xx).
  const generation = rawKey.match(/^(\D*\d)000$/) ?? rawKey.match(/^(\D*\d{2})00$/);
  const hundreds = rawKey.match(/^(\d)00$/);
  const series = generation ?? hundreds;
  if (series) {
    const pattern = generation
      ? new RegExp(`^${generation[1]}\\d{${4 - generation[1].replace(/\D/g, '').length}}(?!\\d)`)
      : new RegExp(`^[a-z]*${series[1]}\\d{2}(?!\\d)`);
    const members = catalog.filter(
      (model) => pattern.test(matchKey(model.name)) && (laptopName || !model.laptop),
    );
    return pickVram(members, hints).map((model) => ({ model, confidence: 'partial' }));
  }
  return [];
}

const GEFORCE_SERIES = ['gtx', 'gts', 'gt', 'rtx'];

/** Integrated GPU families sold under one generic name across many generations. */
const GENERIC_FAMILY =
  /^(?:intel\s+)?(?:u?hd|iris(?:\s+pro)?)\s+graphics$|^(?:amd\s+)?radeon\s+graphics$/i;

type Vendor = 'nvidia' | 'amd' | 'intel';

function vendorOf(raw: string): Vendor | undefined {
  const nvidia = /nvidia|geforce|\bgtx\b|\brtx\b|quadro/i.test(raw);
  const amd = /\bati\b|\bamd\b|radeon|ryzen|athlon|phenom|\bfx-/i.test(raw);
  const intel = /intel|\bcore\s+i\d|pentium|celeron|\biris\b|\barc\b/i.test(raw);
  // Several vendors in one name ("NVIDIA or AMD equivalent"): no constraint.
  return [nvidia && 'nvidia', amd && 'amd', intel && 'intel'].filter(Boolean).length === 1
    ? (((nvidia && 'nvidia') || (amd && 'amd') || 'intel') as Vendor)
    : undefined;
}

/** Catalog ids start with the vendor ("nvidia-geforce-…"). */
function modelVendor(model: HardwareModel): Vendor | undefined {
  return model.id.match(/^(nvidia|amd|intel)-/)?.[1] as Vendor | undefined;
}

function pickVram(models: HardwareModel[], hints: ResolveHints): HardwareModel[] {
  const sameVram = models.filter((model) => model.vramGb === hints.vramGb);
  return hints.vramGb !== undefined && sameVram.length > 0 ? sameVram : models;
}

/** "8600gt" is a variant of "8600": same model number followed by a letter suffix. */
function isVariantOf(key: string, rawKey: string): boolean {
  // The raw name must end in a model number ("8600"), not a family ("i3").
  return /\d{3,}$/.test(rawKey) && key.startsWith(rawKey) && /[a-z]/.test(key[rawKey.length] ?? '');
}

/**
 * "NVIDIA GeForce 8600/9600GT" → ["NVIDIA GeForce 8600", "NVIDIA GeForce 9600GT"];
 * "ATI/AMD Radeon HD2600/3600" → ["ATI AMD Radeon HD2600", "ATI AMD Radeon HD3600"].
 * Segments without a digit ("ATI/AMD") are vendor alternatives and stay in the prefix.
 */
function expandTightSlashes(raw: string): string[] {
  const segments: string[] = [];
  let pending = '';
  for (const segment of raw.split('/')) {
    if (!/\d/.test(segment)) {
      pending += `${segment} `;
      continue;
    }
    segments.push(pending + segment);
    pending = '';
  }
  if (segments.length <= 1) return [raw];

  const first = segments[0];
  const lastToken = first.match(/(\S*?)(\d\S*)$/);
  const prefix = lastToken ? first.slice(0, lastToken.index) + lastToken[1] : '';
  return [
    first,
    ...segments.slice(1).map((segment) => (/^\d/.test(segment) ? prefix + segment : segment)),
  ];
}

/** Words that name a vendor or product line but never tell two models apart. */
const NOISE_WORDS =
  /\b(?:nvidia|geforce|amd|ati|radeon|intel|core|processor|cpu|graphics|series)\b/g;

/** Reduces a name to its distinctive part: "NVIDIA GeForce GTX 1060 6GB" → "gtx1060". */
function matchKey(name: string): string {
  return (
    name
      .replace(/\bR([3579])\s+(\d{4})/gi, 'Ryzen $1 $2')
      .toLowerCase()
      // "ATI Radeon 3870" → "Radeon HD 3870"; "Nvidia 450 GTS" → "GTS 450".
      .replace(/\b(radeon|ati)\s+(?=[2-7]\d{3}\b)/g, '$1 hd ')
      .replace(/(^|\b(?:nvidia|geforce)\s+)(\d{3})\s*(gts|gtx|gt)\b/g, '$1$3 $2')
      .replace(/\([^)]*\)/g, ' ')
      // Clock speeds ("@ 3.3 GHz", "500 MHz"), but not model numbers ("HD 7870 GHz Edition").
      .replace(/@?\s*\b\d(?:\.\d+)?\s*ghz\b|@?\s*\b\d{2,4}\s*mhz\b|@/g, ' ')
      // Windows appends the core count: "Ryzen 5 3600 6-Core Processor".
      .replace(/\b\d+-core\b/g, ' ')
      // Radeon R5/R7/R9 three-digit numbers are unique across tiers, and games mix them up.
      .replace(/\br[3-9]\s+(?=m?\d{3}[a-z]*\b)/g, ' ')
      .replace(/\b\d+(?:\.\d+)?\s*[gm]b\b/g, ' ')
      .replace(NOISE_WORDS, ' ')
      .replace(/[^a-z0-9]/g, '')
  );
}

/** True when `key` occurs in `rawKey` and is not just the start of a longer number ("rx580" in "rx5800"). */
function containsModelKey(rawKey: string, key: string): boolean {
  for (let at = rawKey.indexOf(key); at !== -1; at = rawKey.indexOf(key, at + 1)) {
    const next = rawKey[at + key.length];
    const endsInDigit = /\d/.test(key[key.length - 1]);
    if (!(endsInDigit && next !== undefined && /\d/.test(next))) return true;
  }
  return false;
}
