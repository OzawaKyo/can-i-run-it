/** Every number in a cell: "5,783 (6,463)" → [5783, 6463]. */
export function readNumbers(text: string): number[] {
  return [...text.matchAll(/\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?/g)].map((match) =>
    toNumber(match[0]),
  );
}

export function toNumber(text: string): number {
  return Number(text.replace(/,/g, ''));
}

export function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/\+/g, 'plus')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** A cell by column index, or '' when the table lacks that column. */
export function cell(row: string[], column: number): string {
  return column === -1 ? '' : (row[column] ?? '');
}
