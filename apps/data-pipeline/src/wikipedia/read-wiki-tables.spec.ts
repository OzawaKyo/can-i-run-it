import { describe, expect, it } from 'vitest';
import { readWikiTables } from './read-wiki-tables';

const page = `
<section><h2 id="Desktop">Desktop GPUs</h2>
<section><h3 id="GeForce_10_series">GeForce 10 series</h3>
<table class="wikitable">
  <tr><th rowspan="2">Model</th><th colspan="2">Memory</th><th rowspan="2">Processing power (GFLOPS)</th></tr>
  <tr><th>Size (GB)</th><th>Bus width (bit)</th></tr>
  <tr><th>GeForce GTX 1060<sup class="reference">[12]</sup></th><td>3<br>6</td><td rowspan="2">192</td><td>3,855</td></tr>
  <tr><th>GeForce GTX 1070</th><td>8</td><td><span style="display:none">6463</span>6,463</td></tr>
</table>
</section></section>`;

describe('readWikiTables', () => {
  const [table] = readWikiTables(page);

  it('joins multi-row headers into one label per column', () => {
    expect(table.columns).toEqual([
      'Model',
      'Memory / Size (GB)',
      'Memory / Bus width (bit)',
      'Processing power (GFLOPS)',
    ]);
  });

  it('expands rowspans, drops footnotes and hidden sort keys', () => {
    expect(table.rows).toEqual([
      ['GeForce GTX 1060', '3 6', '192', '3,855'],
      ['GeForce GTX 1070', '8', '192', '6,463'],
    ]);
  });

  it('records the headings the table sits under', () => {
    expect(table.section).toEqual(['Desktop GPUs', 'GeForce 10 series']);
  });
});
