import { describe, expect, it } from 'vitest';
import { searchByName } from './search';

const items = [
  { name: 'GeForce GTX 1060 3GB' },
  { name: 'GeForce GTX 1060 6GB' },
  { name: 'GeForce GTX 1660' },
  { name: 'Radeon RX 580 8GB' },
  { name: 'The Witcher 3: Wild Hunt' },
  { name: 'Counter-Strike 2' },
];
const names = (query: string, limit?: number) =>
  searchByName(items, query, limit).map((item) => item.name);

describe('searchByName', () => {
  it('matches every word of the query, ignoring case and punctuation', () => {
    expect(names('gtx 1060')).toEqual(['GeForce GTX 1060 3GB', 'GeForce GTX 1060 6GB']);
    expect(names('witcher')).toEqual(['The Witcher 3: Wild Hunt']);
    expect(names('counter strike')).toEqual(['Counter-Strike 2']);
  });

  it('matches numbers typed without spaces or prefixes', () => {
    expect(names('rx580')).toEqual(['Radeon RX 580 8GB']);
    expect(names('1660')).toEqual(['GeForce GTX 1660']);
  });

  it('ranks names that start with the query first', () => {
    expect(names('geforce 1')).toEqual([
      'GeForce GTX 1060 3GB',
      'GeForce GTX 1060 6GB',
      'GeForce GTX 1660',
    ]);
    expect(
      searchByName([{ name: 'Portal 2' }, { name: 'Portal' }], 'portal').map((item) => item.name),
    ).toEqual(['Portal', 'Portal 2']);
  });

  it('limits results and returns nothing for an empty query', () => {
    expect(names('geforce', 2)).toHaveLength(2);
    expect(names('  ')).toEqual([]);
  });
});
