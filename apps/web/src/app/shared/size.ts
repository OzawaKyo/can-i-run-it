/** A size as an i18n key and value: below 1 GB, sizes read better in MB ("128 MB"). */
export interface Size {
  key: 'units.gb' | 'units.mb';
  value: number;
}

export function size(gb: number): Size {
  return gb < 1
    ? { key: 'units.mb', value: Math.round(gb * 1024) }
    : { key: 'units.gb', value: Math.round(gb * 10) / 10 };
}
