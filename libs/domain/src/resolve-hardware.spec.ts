import { describe, expect, it } from 'vitest';
import type { HardwareModel } from './hardware';
import { resolveHardware } from './resolve-hardware';

const gpu = (id: string, name: string, vramGb?: number): HardwareModel => ({
  id,
  kind: 'gpu',
  name,
  vramGb,
});

const cpu = (id: string, name: string): HardwareModel => ({ id, kind: 'cpu', name });

const catalog: HardwareModel[] = [
  gpu('gtx-1060-3gb', 'NVIDIA GeForce GTX 1060 3GB', 3),
  gpu('gtx-1060-6gb', 'NVIDIA GeForce GTX 1060 6GB', 6),
  gpu('rtx-2060', 'NVIDIA GeForce RTX 2060', 6),
  gpu('rtx-2060-super', 'NVIDIA GeForce RTX 2060 SUPER', 8),
  gpu('rx-570', 'AMD Radeon RX 570', 4),
  gpu('rx-5700-xt', 'AMD Radeon RX 5700 XT', 8),
  gpu('hd-4870', 'ATI Radeon HD 4870', 1),
  gpu('8600-gt', 'NVIDIA GeForce 8600 GT', 0.25),
  gpu('8600-gts', 'NVIDIA GeForce 8600 GTS', 0.25),
  gpu('9600-gt', 'NVIDIA GeForce 9600 GT', 0.5),
  gpu('hd-2600-xt', 'ATI Radeon HD 2600 XT', 0.25),
  cpu('i7-6700', 'Intel Core i7-6700'),
  cpu('i7-6700k', 'Intel Core i7-6700K'),
  cpu('i7-8700k', 'Intel Core i7-8700K'),
  cpu('i5-750', 'Intel Core i5-750'),
  cpu('ryzen-5-1600', 'AMD Ryzen 5 1600'),
  cpu('ryzen-5-1600x', 'AMD Ryzen 5 1600X'),
  cpu('i5-2500', 'Intel Core i5-2500'),
  cpu('i5-2500k', 'Intel Core i5-2500K'),
  cpu('q6600', 'Intel Core 2 Quad Q6600'),
  cpu('i3-n305', 'Intel Core i3-N305'),
  cpu('ryzen-5-3600', 'AMD Ryzen 5 3600'),
  cpu('i5-8400', 'Intel Core i5-8400'),
  gpu('r9-270x-2gb', 'AMD Radeon R9 270X 2GB', 2),
  gpu('gtx-760', 'NVIDIA GeForce GTX 760', 2),
  { id: 'nvidia-geforce-8500-gt', kind: 'gpu', name: 'GeForce 8500 GT' },
  { id: 'intel-hd-graphics', kind: 'gpu', name: 'HD Graphics' },
  { id: 'amd-radeon-hd-7870-ghz-edition', kind: 'gpu', name: 'Radeon HD 7870 GHz Edition' },
  { id: 'nvidia-geforce-9800-gt', kind: 'gpu', name: 'GeForce 9800 GT' },
  { id: 'amd-radeon-hd-3870', kind: 'gpu', name: 'Radeon HD 3870' },
  { id: 'nvidia-geforce-gts-450', kind: 'gpu', name: 'GeForce GTS 450' },
  { id: 'amd-radeon-hd-7850', kind: 'gpu', name: 'Radeon HD 7850' },
  { id: 'amd-radeon-hd-7870', kind: 'gpu', name: 'Radeon HD 7870' },
  { id: 'amd-radeon-hd-7950', kind: 'gpu', name: 'Radeon HD 7950' },
  { id: 'nvidia-geforce-9800m-gs', kind: 'gpu', name: 'GeForce 9800M GS', laptop: true },
  { id: 'intel-hd-graphics-4000', kind: 'gpu', name: 'HD Graphics 4000' },
];

const ids = (raw: string, vramGb?: number) =>
  resolveHardware(raw, catalog, { vramGb }).map((match) => match.model.id);

describe('resolveHardware', () => {
  it('matches regardless of case and brand words', () => {
    expect(ids('NVIDIA GEFORCE GTX 1060', 6)).toEqual(['gtx-1060-6gb']);
  });

  it('returns every memory variant when no VRAM is given', () => {
    expect(ids('GeForce GTX 1060')).toEqual(['gtx-1060-3gb', 'gtx-1060-6gb']);
  });

  it('prefers the most specific model ("SUPER", "X", "K")', () => {
    expect(ids('GeForce RTX 2060 SUPER')).toEqual(['rtx-2060-super']);
    expect(ids('RTX 2060')).toEqual(['rtx-2060']);
    expect(ids('Ryzen 5 1600X')).toEqual(['ryzen-5-1600x']);
    expect(ids('Core i7-6700')).toEqual(['i7-6700']);
  });

  it('never matches the start of a longer model number', () => {
    expect(ids('Radeon RX 5700 XT')).toEqual(['rx-5700-xt']);
  });

  it('ignores spacing, hyphens and parenthesised notes', () => {
    expect(ids('Intel Core i7 8700K')).toEqual(['i7-8700k']);
    expect(ids('INTEL CORE I7-8700K')).toEqual(['i7-8700k']);
    expect(ids('AMD HD 4870 (DX 10, 10.1, 11)')).toEqual(['hd-4870']);
  });

  it('finds a model inside surrounding prose', () => {
    expect(ids('4 hardware CPU threads - Intel Core i5 750')).toEqual(['i5-750']);
  });

  it('returns nothing for a generic description', () => {
    expect(
      ids(
        'Video card must be 1 GB and should be a DirectX 11-compatible with support for Shader Model 5.0',
      ),
    ).toEqual([]);
  });

  it('expands tight slashes that share a prefix ("8600/9600GT", "HD2600/3600")', () => {
    const matches = resolveHardware('NVIDIA GeForce 8600/9600GT', catalog);
    expect(matches.map((match) => [match.model.id, match.confidence])).toEqual([
      ['8600-gt', 'partial'],
      ['8600-gts', 'partial'],
      ['9600-gt', 'exact'],
    ]);
    expect(ids('ATI/AMD Radeon HD2600/3600')).toEqual(['hd-2600-xt']);
  });

  it('ignores clock speeds written after the model', () => {
    expect(ids('Intel Core i5-2500 @3.3 GHz')).toEqual(['i5-2500']);
    expect(ids('Intel Core 2 Quad CPU Q6600 @ 2.40GHz (4 CPUs)')).toEqual(['q6600']);
    expect(ids('Intel Core i5-2500 3.3 GHz')).toEqual(['i5-2500']);
  });

  it('reads "R5 1600X" as Ryzen 5', () => {
    expect(ids('AMD R5 1600X')).toEqual(['ryzen-5-1600x']);
  });

  it('ignores the R5/R7/R9 tier of a Radeon, whose three-digit numbers are unique', () => {
    expect(ids('AMD Radeon R7 270X')).toEqual(['r9-270x-2gb']);
  });

  it('accepts a GeForce number without its GTX prefix, as a partial match', () => {
    const matches = resolveHardware('NVIDIA GeForce 760', catalog);
    expect(matches.map((match) => [match.model.id, match.confidence])).toEqual([
      ['gtx-760', 'partial'],
    ]);
  });

  it('never treats a bare family ("Core i3") as a model with variants', () => {
    expect(ids('Intel Core i3 2.5 Ghz')).toEqual([]);
  });

  it('reads processor names as Windows reports them', () => {
    expect(ids('AMD Ryzen 5 3600 6-Core Processor')).toEqual(['ryzen-5-3600']);
    expect(ids('Intel(R) Core(TM) i5-8400 CPU @ 2.80GHz')).toEqual(['i5-8400']);
  });

  it('only matches models of the vendor the name gives', () => {
    expect(ids('ATI Radeon 8500')).toEqual([]);
    expect(ids('NVIDIA GeForce 8500 GT')).toEqual(['nvidia-geforce-8500-gt']);
  });

  it('does not take a bare family name for the model that happens to carry it', () => {
    expect(ids('Intel HD Graphics')).toEqual([]);
    expect(ids('Intel HD Graphics 4000')).toEqual(['intel-hd-graphics-4000']);
  });

  it('keeps model numbers followed by "GHz Edition"', () => {
    expect(ids('Radeon HD 7870 GHz Edition')).toEqual(['amd-radeon-hd-7870-ghz-edition']);
  });

  it('leaves laptop chips out of a desktop family name', () => {
    expect(ids('Nvidia GeForce 9800')).toEqual(['nvidia-geforce-9800-gt']);
  });

  it('reads common abbreviations: a Radeon HD without "HD", a GeForce series after its number', () => {
    expect(ids('ATI Radeon 3870')).toEqual(['amd-radeon-hd-3870']);
    expect(ids('Nvidia 450 GTS')).toEqual(['nvidia-geforce-gts-450']);
  });

  it('reads a "x00" series as every card of that series, as partial matches', () => {
    const matches = resolveHardware('AMD Radeon HD 7800', catalog);
    expect(matches.map((match) => [match.model.id, match.confidence]).sort()).toEqual([
      ['amd-radeon-hd-7850', 'partial'],
      ['amd-radeon-hd-7870', 'partial'],
      ['amd-radeon-hd-7870-ghz-edition', 'partial'],
    ]);
  });
});
