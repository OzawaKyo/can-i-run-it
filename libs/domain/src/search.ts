/**
 * Finds items whose name contains every word of the query. Spacing and punctuation are
 * ignored ("rx580" finds "Radeon RX 580"); names starting with the query come first, then
 * natural order ("GTX 1060" before "GTX 1660", "Portal" before "Portal 2").
 */
export function searchByName<T extends { name: string }>(
  items: readonly T[],
  query: string,
  limit = 20,
): T[] {
  const words = query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  if (words.length === 0) return [];

  const matches: { item: T; position: number }[] = [];
  for (const item of items) {
    const name = compact(item.name);
    if (words.every((word) => name.includes(word)))
      matches.push({ item, position: name.indexOf(words[0]) });
  }
  return matches
    .sort(
      (a, b) =>
        a.position - b.position || a.item.name.localeCompare(b.item.name, 'en', { numeric: true }),
    )
    .slice(0, limit)
    .map((match) => match.item);
}

function compact(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '');
}
