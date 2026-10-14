import { mkdir, writeFile } from 'node:fs/promises';
import { buildHardwareCatalog, type CatalogPage } from './hardware/build-hardware-catalog';
import { createPoliteFetch, HttpError, MissingContactError } from './http/polite-fetch';

/** Wikipedia list pages, most trusted first: a model listed twice keeps the first page's data. */
const PAGES: { title: string; kind: CatalogPage['kind']; vendor: CatalogPage['vendor'] }[] = [
  { title: 'List_of_Nvidia_graphics_processing_units', kind: 'gpu', vendor: 'nvidia' },
  { title: 'List_of_AMD_graphics_processing_units', kind: 'gpu', vendor: 'amd' },
  { title: 'List_of_Intel_graphics_processing_units', kind: 'gpu', vendor: 'intel' },
  { title: 'List_of_Intel_Core_desktop_processors', kind: 'cpu', vendor: 'intel' },
  { title: 'List_of_Intel_Core_mobile_processors', kind: 'cpu', vendor: 'intel' },
  { title: 'List_of_Intel_processors', kind: 'cpu', vendor: 'intel' },
  { title: 'List_of_AMD_Ryzen_processors', kind: 'cpu', vendor: 'amd' },
  { title: 'List_of_AMD_accelerated_processing_units', kind: 'cpu', vendor: 'amd' },
  { title: 'List_of_AMD_FX_processors', kind: 'cpu', vendor: 'amd' },
  { title: 'List_of_AMD_Phenom_processors', kind: 'cpu', vendor: 'amd' },
];

const OUT_DIR = 'data/hardware';

async function main() {
  const get = createPoliteFetch({
    cacheDir: '.cache/pipeline',
    minIntervalMs: 2000,
    maxAgeMs: 30 * 24 * 3600 * 1000,
    requireContact: true,
  });
  const pages: CatalogPage[] = [];
  for (const { title, kind, vendor } of PAGES) {
    try {
      const html = await get(
        `https://en.wikipedia.org/api/rest_v1/page/html/${title}`,
        `wikipedia/${title}.html`,
      );
      pages.push({ kind, vendor, html } as CatalogPage);
    } catch (error) {
      if (error instanceof HttpError && error.status === 404)
        console.warn(`skipped ${title}: not found`);
      else if (error instanceof MissingContactError)
        console.warn(`skipped ${title}: not cached and PIPELINE_CONTACT is not set`);
      else throw error;
    }
  }

  const catalog = buildHardwareCatalog(pages);
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(`${OUT_DIR}/gpus.json`, `${JSON.stringify(catalog.gpus, null, 1)}\n`);
  await writeFile(`${OUT_DIR}/cpus.json`, `${JSON.stringify(catalog.cpus, null, 1)}\n`);
  await mkdir('.cache/pipeline', { recursive: true });
  await writeFile(
    '.cache/pipeline/hardware-report.json',
    `${JSON.stringify(catalog.report, null, 2)}\n`,
  );

  console.log(
    `${catalog.gpus.length} GPUs, ${catalog.cpus.length} CPUs, ` +
      `${catalog.report.unscored.length} unscored, ${catalog.report.rejected.length} rejected rows ` +
      `(details: .cache/pipeline/hardware-report.json)`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
