import { httpResource } from '@angular/common/http';
import { computed, Injectable } from '@angular/core';
import type { HardwareModel } from '@can-i-run-it/domain';

/** The CPU and GPU catalog built by the data pipeline (`data/hardware`). */
@Injectable({ providedIn: 'root' })
export class HardwareCatalog {
  private readonly cpuResource = httpResource<HardwareModel[]>(() => 'data/hardware/cpus.json', {
    defaultValue: [],
  });
  private readonly gpuResource = httpResource<HardwareModel[]>(() => 'data/hardware/gpus.json', {
    defaultValue: [],
  });

  readonly cpus = this.cpuResource.value.asReadonly();
  readonly gpus = this.gpuResource.value.asReadonly();
  readonly loading = computed(() => this.cpuResource.isLoading() || this.gpuResource.isLoading());
  readonly failed = computed(() => !!this.cpuResource.error() || !!this.gpuResource.error());

  readonly byId = computed(
    () => new Map([...this.cpus(), ...this.gpus()].map((model) => [model.id, model])),
  );
}
