export type HardwareKind = 'cpu' | 'gpu';

/** A CPU or GPU model from the hardware catalog. */
export interface HardwareModel {
  id: string;
  kind: HardwareKind;
  name: string;
  /** Relative gaming performance; higher is faster. Comparable only within the same kind. */
  score?: number;
  vramGb?: number;
  /** Highest Direct3D version supported (GPU only). */
  directX?: number;
  laptop?: boolean;
}

export interface HardwareMatch {
  model: HardwareModel;
  /** `exact`: every distinctive part of the model name was found. `partial`: the raw name was less specific than the model. */
  confidence: 'exact' | 'partial';
}
