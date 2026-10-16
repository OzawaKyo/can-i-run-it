import type { SavedConfig } from '../config/user-config-store';

/** Catalog ids are lowercase slugs. */
const ID = /^[a-z0-9-]{1,100}$/;

/**
 * A PC as the `pc` query parameter of a shared game link: "cpu,gpu,ram,free space,ssd|hdd",
 * empty where unknown. Hardware ids and sizes only: nothing that identifies the person.
 */
export function encodeSharedPc(pc: SavedConfig): string {
  return [pc.cpuId, pc.gpuId, pc.ramGb, pc.freeStorageGb, pc.storageType]
    .map((field) => field ?? '')
    .join(',');
}

/** Reads a `pc` parameter; anything malformed is dropped. Undefined when nothing is left. */
export function decodeSharedPc(value: string | undefined): SavedConfig | undefined {
  const [cpuId, gpuId, ram, free, storageType] = (value ?? '').split(',');
  const pc: SavedConfig = {};
  if (cpuId && ID.test(cpuId)) pc.cpuId = cpuId;
  if (gpuId && ID.test(gpuId)) pc.gpuId = gpuId;
  const ramGb = amount(ram, 4096);
  const freeStorageGb = amount(free, 1_000_000);
  if (ramGb !== undefined) pc.ramGb = ramGb;
  if (freeStorageGb !== undefined) pc.freeStorageGb = freeStorageGb;
  if (storageType === 'ssd' || storageType === 'hdd') pc.storageType = storageType;
  return Object.keys(pc).length > 0 ? pc : undefined;
}

function amount(text: string | undefined, max: number): number | undefined {
  if (!text || !/^\d+(?:\.\d+)?$/.test(text)) return undefined;
  const value = Number(text);
  return value > 0 && value <= max ? value : undefined;
}
