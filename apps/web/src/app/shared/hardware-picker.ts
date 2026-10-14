import { Component, computed, input, linkedSignal, output, signal } from '@angular/core';
import { searchByName, type HardwareModel } from '@can-i-run-it/domain';
import { TranslocoPipe } from '@jsverse/transloco';

let nextId = 0;

/** A searchable combobox over the hardware catalog. Emits the chosen model's id. */
@Component({
  selector: 'app-hardware-picker',
  imports: [TranslocoPipe],
  templateUrl: './hardware-picker.html',
  styleUrl: './hardware-picker.scss',
})
export class HardwarePicker {
  readonly label = input.required<string>();
  readonly placeholder = input('');
  readonly models = input.required<readonly HardwareModel[]>();
  readonly selected = input<HardwareModel | undefined>();
  readonly picked = output<string>();

  protected readonly listId = `hardware-picker-${nextId++}`;
  protected readonly query = linkedSignal(() => this.selected()?.name ?? '');
  protected readonly open = signal(false);
  protected readonly active = signal(0);
  protected readonly results = computed(() =>
    this.open() ? searchByName(this.models(), this.query(), 8) : [],
  );

  protected onInput(value: string): void {
    this.query.set(value);
    this.open.set(true);
    this.active.set(0);
  }

  protected onKeydown(event: KeyboardEvent): void {
    const count = this.results().length;
    if (event.key === 'ArrowDown') {
      this.open.set(true);
      this.active.update((index) => (count ? (index + 1) % count : 0));
    } else if (event.key === 'ArrowUp') {
      this.active.update((index) => (count ? (index - 1 + count) % count : 0));
    } else if (event.key === 'Enter' && this.open() && count) {
      this.choose(this.results()[this.active()]);
    } else if (event.key === 'Escape') {
      this.close();
      return;
    } else {
      return;
    }
    event.preventDefault();
  }

  protected choose(model: HardwareModel): void {
    this.query.set(model.name);
    this.open.set(false);
    this.picked.emit(model.id);
  }

  /** Closing on blur waits a tick, so a click on an option still lands. */
  protected close(): void {
    setTimeout(() => {
      this.open.set(false);
      this.query.set(this.selected()?.name ?? this.query());
    }, 150);
  }
}
