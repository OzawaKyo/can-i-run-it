import type {
  GameRequirements,
  GpuRequirement,
  RequirementTier,
  StorageRequirement,
} from '@can-i-run-it/domain';

/**
 * Parses Steam's `pc_requirements` field (free-form HTML) into structured tiers.
 * Values that cannot be read reliably are left undefined, never guessed.
 */
export function parseSteamRequirements(pcRequirements: unknown): GameRequirements {
  if (!isRecord(pcRequirements)) return {};
  const minimum = pcRequirements['minimum'];
  const recommended = pcRequirements['recommended'];
  if (typeof minimum === 'string' && !/<li>/i.test(minimum)) {
    const paragraphs = readParagraphTiers(minimum);
    return {
      minimum: paragraphs.get('minimum'),
      recommended: parseTier(recommended) ?? paragraphs.get('recommended'),
    };
  }
  return {
    minimum: parseTier(minimum),
    recommended: parseTier(recommended),
  };
}

/**
 * Old store pages put both tiers in `minimum` as `<p><strong>Minimum:</strong> free text</p>`.
 * Only the RAM can be read reliably from such text; processor and graphics are left empty.
 */
function readParagraphTiers(html: string): Map<string, RequirementTier> {
  const tiers = new Map<string, RequirementTier>();
  for (const [, paragraph] of html.matchAll(/<p>(.*?)<\/p>/gis)) {
    const match = paragraph.match(/<strong>\s*(minimum|recommended)\s*:?\s*<\/strong>(.*)/is);
    if (!match) continue;
    const text = stripTags(match[2]);
    tiers.set(match[1].toLowerCase(), {
      cpu: [],
      gpu: [],
      ramGb: parseSizeGb(
        text.match(/\d+(?:\.\d+)?\s*(?:GB|MB)\s*(?:of\s+)?(?:RAM|memory)\b/i)?.[0],
      ),
      raw: { text },
    });
  }
  return tiers;
}

function parseTier(html: unknown): RequirementTier | undefined {
  if (typeof html !== 'string') return undefined;
  const fields = readLabelledFields(html);
  const graphics = readGraphics(fields.get('graphics'));
  return {
    cpu: splitAlternatives(fields.get('processor')),
    gpu: graphics.gpus,
    ramGb: parseSizeGb(fields.get('memory')),
    vramGb:
      parseSizeGb(fields.get('video memory')) ??
      parseNotesVram(fields.get('additional notes')) ??
      graphics.looseVramGb,
    directX: parseDirectX(fields.get('directx')),
    storage: parseStorage(fields.get('storage'), fields.get('additional notes')),
    raw: Object.fromEntries(fields),
  };
}

/** "or higher", "or better"… mean "at least", not an alternative. */
const OR_BETTER =
  /\s+or\s+(?:higher|better|more|above|newer|greater|later|equivalent|similar|comparable|faster)\b/gi;

/**
 * Splits "A or B", "A / B" and "A, B" into alternatives, ignoring separators inside
 * parentheses ("HD 4870 (DX 10, 10.1, 11)"). Tight slashes ("8600/9600GT") are kept:
 * they share a brand prefix that only name resolution can expand.
 */
function splitAlternatives(input: string | undefined): string[] {
  if (!input) return [];
  const text = input.replace(OR_BETTER, '');
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '(') depth++;
    else if (char === ')') depth = Math.max(0, depth - 1);
    if (depth > 0) continue;
    const separator = text.slice(i).match(/^(?:\s+or\s+|\s+\/\s+|,\s*)/i);
    if (!separator) continue;
    parts.push(text.slice(start, i));
    i += separator[0].length - 1;
    start = i + 1;
  }
  parts.push(text.slice(start));
  return parts.map((part) => part.trim()).filter(Boolean);
}

/**
 * Graphics alternatives. A fragment that only states memory ("4 GB dedicated VRAM", split
 * off by a comma) belongs to the GPU before it, or to the tier when it stands alone.
 */
function readGraphics(text: string | undefined): { gpus: GpuRequirement[]; looseVramGb?: number } {
  const gpus: GpuRequirement[] = [];
  let looseVramGb: number | undefined;
  for (const gpu of splitAlternatives(text).map(parseGpu)) {
    const memoryOnly =
      gpu.name
        .replace(/\b(?:dedicated|video|graphics|with|of)\b|\b(?:vram|memory|ram)\b/gi, '')
        .trim() === '';
    if (!memoryOnly) {
      gpus.push(gpu);
      continue;
    }
    const previous = gpus[gpus.length - 1];
    if (previous && previous.vramGb === undefined && gpu.vramGb !== undefined)
      previous.vramGb = gpu.vramGb;
    else if (!previous) looseVramGb = gpu.vramGb;
  }
  return { gpus, looseVramGb };
}

/** Splits "GeForce GTX 1060 6GB" into the model name and its VRAM. */
function parseGpu(text: string): GpuRequirement {
  const vram = text.match(/\s*\b(\d+(?:\.\d+)?)\s*GB\b/i);
  if (!vram || vram.index === undefined) return { name: text };
  const name = (text.slice(0, vram.index) + text.slice(vram.index + vram[0].length)).trim();
  return { name, vramGb: Number(vram[1]) };
}

/** Labels games use for the same line, mapped to one name. */
const LABEL_ALIASES: Record<string, string> = {
  'video card': 'graphics',
  'graphics card': 'graphics',
  video: 'graphics',
  gpu: 'graphics',
  cpu: 'processor',
  ram: 'memory',
  'system memory': 'memory',
  'hard drive': 'storage',
  'hard disk space': 'storage',
  'hard disk': 'storage',
  'disk space': 'storage',
  'free disk space': 'storage',
  hdd: 'storage',
};

/**
 * Reads `<li><strong>Label:</strong> value</li>` bullets into a label → text map. Labels are
 * lowercased and aliased; a value written inside the bold label ("<strong>Memory: 4GB</strong>")
 * is moved back to the value.
 */
function readLabelledFields(html: string): Map<string, string> {
  const fields = new Map<string, string>();
  for (const [, item] of html.matchAll(/<li>(.*?)<\/li>/gs)) {
    const match = item.match(/<strong>(.*?)<\/strong>(.*)/s);
    if (!match) continue;
    const bold = stripTags(match[1]);
    const colon = bold.indexOf(':');
    const label = (colon === -1 ? bold : bold.slice(0, colon)).replace(/[*\s]+$/, '').toLowerCase();
    const value = `${colon === -1 ? '' : bold.slice(colon + 1)} ${stripTags(match[2])}`.trim();
    const key = LABEL_ALIASES[label] ?? label;
    if (!fields.has(key)) fields.set(key, value);
  }
  return fields;
}

/** Matches "VRAM 6 GB", "VRAM: 6GB" or "6 GB VRAM" in free-form notes. */
function parseNotesVram(notes: string | undefined): number | undefined {
  const match = notes?.match(
    /VRAM:?\s*(\d+(?:\.\d+)?)\s*GB|(\d+(?:\.\d+)?)\s*GB\s+(?:of\s+)?VRAM/i,
  );
  return match ? Number(match[1] ?? match[2]) : undefined;
}

function parseDirectX(text: string | undefined): number | undefined {
  const match = text?.match(/(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : undefined;
}

function parseStorage(
  text: string | undefined,
  notes: string | undefined,
): StorageRequirement | undefined {
  const gb = parseSizeGb(text?.replace(/\bSSD\s+(?=GB|MB)/i, ''));
  if (gb === undefined) return undefined;
  const ssd = /\bSSD\b/i.test(text ?? '') || /\bSSD\s+required\b/i.test(notes ?? '');
  return { gb, ssd };
}

function parseSizeGb(text: string | undefined): number | undefined {
  const match = text?.match(/(\d+(?:\.\d+)?)\s*(GB|MB)/i);
  if (!match) return undefined;
  const value = Number(match[1]);
  return match[2].toUpperCase() === 'MB' ? value / 1024 : value;
}

function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, ' '))
    .replace(/[®™©]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  reg: '®',
  trade: '™',
  copy: '©',
};

function decodeEntities(text: string): string {
  return text.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (entity, code: string) => {
    if (code[0] !== '#') return NAMED_ENTITIES[code.toLowerCase()] ?? entity;
    const hex = code[1] === 'x' || code[1] === 'X';
    return String.fromCodePoint(parseInt(code.slice(hex ? 2 : 1), hex ? 16 : 10));
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
