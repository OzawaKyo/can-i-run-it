import { load, type CheerioAPI } from 'cheerio';
import type { AnyNode, Element } from 'domhandler';

export interface WikiTable {
  /** Headings the table sits under, outermost first. */
  section: string[];
  /** One label per column; multi-row headers joined with " / ". */
  columns: string[];
  /** Cell text, with rowspans and colspans expanded so every row has one cell per column. */
  rows: string[][];
}

/** Reads every `wikitable` of a Wikipedia page (Parsoid HTML from the REST API). */
export function readWikiTables(html: string): WikiTable[] {
  const $ = load(html);
  $(
    'sup.reference, style, script, .sortkey, [style*="display:none"], [style*="display: none"]',
  ).remove();
  $('br').replaceWith(' ');

  return $('table.wikitable')
    .toArray()
    .map((table) => readTable($, table));
}

function readTable($: CheerioAPI, table: Element): WikiTable {
  const grid = toGrid($, table);
  const headerCount = grid.findIndex((row) => row.some((cell) => !cell.header));
  const headerRows = grid.slice(0, headerCount === -1 ? grid.length : headerCount);
  const bodyRows = grid.slice(headerRows.length);
  const width = Math.max(0, ...grid.map((row) => row.length));

  const columns = Array.from({ length: width }, (_, column) => {
    const parts: string[] = [];
    for (const row of headerRows) {
      const text = row[column]?.text ?? '';
      if (text && parts[parts.length - 1] !== text) parts.push(text);
    }
    return parts.join(' / ');
  });

  return {
    section: sectionOf($, table),
    columns,
    rows: bodyRows.map((row) =>
      Array.from({ length: width }, (_, column) => row[column]?.text ?? ''),
    ),
  };
}

interface GridCell {
  text: string;
  header: boolean;
}

/** Lays the table out on a grid, copying each spanned cell into every slot it covers. */
function toGrid($: CheerioAPI, table: Element): GridCell[][] {
  const grid: GridCell[][] = [];
  $(table)
    .find('tr')
    .filter((_, tr) => $(tr).closest('table').get(0) === table)
    .each((rowIndex, tr) => {
      grid[rowIndex] ??= [];
      let column = 0;
      $(tr)
        .children('th, td')
        .each((_, cell) => {
          while (grid[rowIndex][column]) column++;
          const rowspan = spanOf(cell, 'rowspan');
          const colspan = spanOf(cell, 'colspan');
          const value: GridCell = {
            text: cleanText($(cell).text()),
            header: cell.tagName === 'th',
          };
          for (let r = 0; r < rowspan; r++) {
            grid[rowIndex + r] ??= [];
            for (let c = 0; c < colspan; c++) grid[rowIndex + r][column + c] = value;
          }
          column += colspan;
        });
    });
  return grid;
}

function spanOf(cell: Element, attribute: 'rowspan' | 'colspan'): number {
  const value = Number.parseInt(cell.attribs[attribute] ?? '1', 10);
  return Number.isFinite(value) && value > 0 ? Math.min(value, 1000) : 1;
}

/** Text of the nearest heading of each enclosing `<section>`, outermost first. */
function sectionOf($: CheerioAPI, table: AnyNode): string[] {
  return $(table)
    .parents('section')
    .toArray()
    .reverse()
    .map((section) => cleanText($(section).children('h1, h2, h3, h4, h5, h6').first().text()))
    .filter(Boolean);
}

function cleanText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}
