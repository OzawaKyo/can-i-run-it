import type { HardwareModel } from '@can-i-run-it/domain';
import type { WikiTable } from '../wikipedia/read-wiki-tables';
import { cell, readNumbers, slug } from './cells';
import type { RejectedRow } from './extract-gpus';

export type CpuVendor = 'intel' | 'amd';

/** A CPU as read from Wikipedia, before scoring. */
export interface CpuSpec extends HardwareModel {
  kind: 'cpu';
  vendor: CpuVendor;
  microarchitecture?: string;
  /** Performance cores (all cores on non-hybrid chips). */
  cores: number;
  threads: number;
  efficiencyCores?: number;
  baseGhz: number;
  turboGhz: number;
  laptop: boolean;
}

/**
 * Reads one Wikipedia CPU table. The microarchitecture comes from the section headings
 * ("Haswell-DT", "Pinnacle Ridge (…, Zen+ based)"), since rows rarely state it.
 */
export function extractCpus(
  table: WikiTable,
  vendor: CpuVendor,
  options: { laptop?: boolean } = {},
): { cpus: CpuSpec[]; rejected: RejectedRow[] } {
  const columns = findColumns(table.columns);
  const section = table.section.join(' > ');
  const coresFromHeading =
    CORE_COUNT_WORDS[
      section.match(/\b(single|dual|tri|quad|hexa|six|octa|eight)-core\b/i)?.[1].toLowerCase() ?? ''
    ];
  // Older tables (Phenom) have no core column: the heading or the name ("X4") says it.
  const hasCoreCount = columns.cores !== -1 || coresFromHeading !== undefined || columns.clockOnly;
  if (columns.model === -1 || !hasCoreCount || (columns.base === -1 && columns.turbo === -1)) {
    return { cpus: [], rejected: [] };
  }

  const microarchitecture = readMicroarchitecture(section);
  const cpus: CpuSpec[] = [];
  const rejected: RejectedRow[] = [];

  for (const row of table.rows) {
    const name = modelName(cell(row, columns.branding), row[columns.model] ?? '');
    if (!name || /^(?:model|sku|branding)/i.test(name)) continue;

    const fromColumn = readNumbers(cell(row, columns.cores));
    const fromName = Number(name.match(/\bX(\d)\b/)?.[1]) || undefined;
    const [cores, threads = cores] = fromColumn.length
      ? fromColumn
      : [fromName ?? coresFromHeading];
    const base = toGhz(readNumbers(cell(row, columns.base))[0]);
    const turbo = toGhz(Math.max(...readNumbers(cell(row, columns.turbo)))) ?? base;
    if (!cores) {
      rejected.push({ model: name, reason: 'no core count' });
      continue;
    }
    if (base === undefined || turbo === undefined) {
      rejected.push({ model: name, reason: 'no clock rate' });
      continue;
    }

    const efficiencyCores = readNumbers(cell(row, columns.efficiencyCores))[0];
    cpus.push({
      id: `${vendor}-${slug(name)}`,
      kind: 'cpu',
      vendor,
      name,
      microarchitecture,
      cores,
      threads,
      ...(efficiencyCores ? { efficiencyCores } : {}),
      baseGhz: base,
      turboGhz: Math.max(turbo, base),
      laptop:
        options.laptop === true ||
        /mobile|laptop|notebook/i.test(section) ||
        MOBILE_SUFFIX.test(name) ||
        isMobileApu(vendor, section, name),
    });
  }
  return { cpus, rejected };
}

const CORE_COUNT_WORDS: Record<string, number> = {
  single: 1,
  dual: 2,
  tri: 3,
  quad: 4,
  hexa: 6,
  six: 6,
  octa: 8,
  eight: 8,
};

/** Intel and AMD mobile suffixes ("4800H", "8250U", "4710HQ", "430UM"); a bare "G" is a desktop APU. */
const MOBILE_SUFFIX = /\d(?:H|HS|HX|HK|HQ|U|Y|M|MQ|QM|XM|P|UM|LM|UE|LE)$/;

function isMobileApu(vendor: CpuVendor, section: string, name: string): boolean {
  return (
    vendor === 'amd' &&
    /renoir|cezanne|rembrandt|phoenix|hawk point|strix|picasso|raven ridge/i.test(section) &&
    MOBILE_SUFFIX.test(name)
  );
}

interface Columns {
  branding: number;
  model: number;
  cores: number;
  efficiencyCores: number;
  base: number;
  turbo: number;
  /** Tables listing only a model and its clock, where the core count comes from the model name. */
  clockOnly: boolean;
}

function findColumns(labels: string[]): Columns {
  const lower = labels.map((label) => label.toLowerCase());
  const find = (test: (label: string) => boolean) => lower.findIndex(test);
  const isEfficiency = (label: string) => /e-core|efficiency|\/ e$|\/ lp-e$|lp-e/.test(label);

  let branding = find((label) =>
    /^(?:processor )?(?:branding|family)$|^processor branding/.test(label),
  );
  let model = find((label) => /^model(?: number| no\.?)?$|^sku$/.test(label));
  const split = find((label) => label === 'branding and model');
  if (split !== -1 && lower[split + 1] === 'branding and model') {
    branding = split;
    model = split + 1;
  }

  const clock = (label: string) =>
    /clock|frequency|speed/.test(label) &&
    !/gpu|graphics|memory|fsb|hyper ?transport|bus/.test(label) &&
    !isEfficiency(label);
  const base = find((label) => clock(label) && /base/.test(label));
  return {
    branding,
    model,
    cores: find((label) => /cores/.test(label) && !isEfficiency(label) && !/total|gpu/.test(label)),
    efficiencyCores: find((label) => /cores/.test(label) && /e-core|efficiency|\/ e$/.test(label)),
    base: base !== -1 ? base : find((label) => clock(label) && !/turbo|boost/.test(label)),
    turbo: find((label) => clock(label) && /turbo|boost|pb2|pbo|max/.test(label)),
    clockOnly: lower.some((label) => /^model(?: number| no\.?)?$/.test(label)),
  };
}

/** "Core i7" + "4790K" → "Core i7-4790K"; "Ryzen 5" + "2600" → "Ryzen 5 2600"; no branding → the model as is. */
function modelName(branding: string, model: string): string {
  if (!branding || model.startsWith(branding)) return model.trim();
  return /^Core i\d$/i.test(branding)
    ? `${branding}-${model}`.trim()
    : `${branding} ${model}`.trim();
}

/** Clocks are in GHz, but some tables use MHz. */
function toGhz(value: number | undefined): number | undefined {
  if (value === undefined || !Number.isFinite(value)) return undefined;
  return value > 100 ? value / 1000 : value;
}

const MICROARCHITECTURES: [RegExp, string][] = [
  [/\bzen\s*5/i, 'Zen 5'],
  [/\bzen\s*4/i, 'Zen 4'],
  [/\bzen\s*3/i, 'Zen 3'],
  [/\bzen\s*2/i, 'Zen 2'],
  [/\bzen\s*\+/i, 'Zen+'],
  [/\bzen\b|dal[ií]|pollock/i, 'Zen'],
  [/kabini|temash|kyoto|beema|mullins|jaguar|puma/i, 'Jaguar'],
  [/ontario|zacate|desna|hondo|bobcat/i, 'Bobcat'],
  [/vishera|piledriver|richland|trinity/i, 'Piledriver'],
  [/zambezi|bulldozer/i, 'Bulldozer'],
  [/steamroller|kaveri|godavari/i, 'Steamroller'],
  [/excavator|carrizo|bristol ridge/i, 'Excavator'],
  [/deneb|thuban|zosma|heka|callisto|propus|regor|agena|toliman|kuma|rana|llano|\bk10\b/i, 'K10'],
  [/panther lake/i, 'Cougar Cove'],
  [/arrow lake|lunar lake/i, 'Lion Cove'],
  [/meteor lake/i, 'Redwood Cove'],
  [/raptor lake/i, 'Raptor Cove'],
  [/alder lake-n|twin lake|amston lake/i, 'Gracemont'],
  [/alder lake/i, 'Golden Cove'],
  [/rocket lake/i, 'Cypress Cove'],
  [/tiger lake/i, 'Willow Cove'],
  [/ice lake/i, 'Sunny Cove'],
  [/comet lake|coffee lake|kaby lake|skylake|whiskey lake|amber lake|cascade lake/i, 'Skylake'],
  // Generation-numbered headings, for tables that don't name the codename.
  [/core series 3/i, 'Cougar Cove'],
  [/core series 2/i, 'Lion Cove'],
  [/core series 1/i, 'Redwood Cove'],
  [/1[34]th generation/i, 'Raptor Cove'],
  [/12th generation/i, 'Golden Cove'],
  [/11th generation.*mobile/i, 'Willow Cove'],
  [/11th generation/i, 'Cypress Cove'],
  [/(?:[6-9]|10)th generation/i, 'Skylake'],
  [/broadwell/i, 'Broadwell'],
  [/haswell|devil'?s canyon/i, 'Haswell'],
  [/ivy bridge/i, 'Ivy Bridge'],
  [/sandy bridge/i, 'Sandy Bridge'],
  [/lynnfield|bloomfield|clarkdale|gulftown|clarksfield|arrandale|nehalem|westmere/i, 'Nehalem'],
  [/yorkfield|wolfdale|penryn/i, 'Penryn'],
  [/conroe|kentsfield|allendale|merom/i, 'Core'],
];

function readMicroarchitecture(section: string): string | undefined {
  return MICROARCHITECTURES.find(([pattern]) => pattern.test(section))?.[1];
}
