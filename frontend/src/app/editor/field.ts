import { Component, computed, inject, input, output } from '@angular/core';
import { Icon } from '../core/icon';
import { Field } from '../engine/blocks';
import { EditorStore } from './editor.store';

const CUSTOM = '__custom';

/** One inspector control, chosen by the field's type. */
@Component({
  selector: 'ssm-field',
  imports: [Icon],
  template: `
    @let f = field();
    @switch (f.type) {
      @case ('toggle') {
        <label class="flex cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" [checked]="!!value()" (change)="changed.emit($any($event.target).checked)">
          {{ f.label }}
        </label>
      }
      @case ('list') {
        <p class="ui-label">{{ f.label }}</p>
        @for (item of items(); track $index; let i = $index) {
          <div class="mb-2 rounded-md border border-zinc-200 p-2">
            @for (sub of f.itemFields; track sub.key) {
              <ssm-field class="mb-2 block" [field]="sub" [value]="item[sub.key]" (changed)="setItem(i, sub.key, $event)" />
            }
            <div class="flex justify-end">
              <button class="ui-icon-btn" title="Move up" aria-label="Move item up" [disabled]="i === 0" (click)="moveItem(i, -1)"><ssm-icon name="up" [size]="15" /></button>
              <button class="ui-icon-btn" title="Move down" aria-label="Move item down" [disabled]="i === items().length - 1" (click)="moveItem(i, 1)"><ssm-icon name="down" [size]="15" /></button>
              <button class="ui-icon-btn" title="Remove" aria-label="Remove item" (click)="removeItem(i)"><ssm-icon name="trash" [size]="15" /></button>
            </div>
          </div>
        }
        <button class="ui-btn w-full" (click)="addItem()"><ssm-icon name="plus" [size]="15" /> Add</button>
      }
      @default {
        <label class="ui-label">{{ f.label }}
          @switch (f.type) {
            @case ('textarea') {
              <textarea class="ui-input mt-1" rows="4" [value]="value() ?? ''" (input)="emitText($event)"></textarea>
            }
            @case ('code') {
              <textarea class="ui-input mt-1 font-mono text-xs" rows="10" spellcheck="false" [value]="value() ?? ''" (input)="emitText($event)"></textarea>
            }
            @case ('number') {
              <input class="ui-input mt-1" type="number" [min]="f.min ?? null" [max]="f.max ?? null" [value]="value() ?? ''" (input)="emitNumber($event)">
            }
            @case ('select') {
              <select class="ui-input mt-1" (change)="emitSelect($event)">
                @for (option of f.options; track option.value) {
                  <option [value]="option.value" [selected]="option.value === value()">{{ option.label }}</option>
                }
              </select>
            }
            @case ('link') {
              <select class="ui-input mt-1" aria-label="Link destination" (change)="emitLinkChoice($event)">
                <option [value]="custom" [selected]="!isPageLink()">Web address</option>
                @for (page of store.site()!.pages; track page.id) {
                  <option [value]="'page:' + page.slug" [selected]="value() === 'page:' + page.slug">Page: {{ page.title }}</option>
                }
              </select>
              @if (!isPageLink()) {
                <input class="ui-input mt-1" placeholder="https://… or #section" [value]="value() ?? ''" (input)="emitText($event)">
              }
            }
            @case ('image') {
              @if (isLocalImage()) {
                <img class="mt-1 h-24 w-full rounded-md bg-zinc-100 object-contain" [src]="store.assetBase() + value()" alt="">
              }
              <input class="ui-input mt-1" placeholder="assets/… or https://…" [value]="value() ?? ''" (input)="emitText($event)">
              <button type="button" class="ui-btn mt-1 w-full" (click)="pick()">Choose from files</button>
            }
            @default {
              <input class="ui-input mt-1" [value]="value() ?? ''" (input)="emitText($event)">
            }
          }
        </label>
      }
    }
    @if (f.hint) {
      <p class="mt-1 text-xs text-zinc-500">{{ f.hint }}</p>
    }
  `,
})
export class FieldEditor {
  protected readonly store = inject(EditorStore);

  readonly field = input.required<Field>();
  readonly value = input<any>();
  readonly changed = output<any>();

  protected readonly custom = CUSTOM;
  protected readonly items = computed<any[]>(() => this.value() ?? []);
  protected readonly isPageLink = computed(() => String(this.value() ?? '').startsWith('page:'));
  protected readonly isLocalImage = computed(() => /^assets\/.+\.(png|jpe?g|gif|webp|avif|svg|ico)$/i.test(this.value() ?? ''));

  protected emitText(event: Event) {
    this.changed.emit((event.target as HTMLInputElement).value);
  }

  protected emitNumber(event: Event) {
    const raw = (event.target as HTMLInputElement).value;
    this.changed.emit(raw === '' ? '' : Number(raw));
  }

  protected emitSelect(event: Event) {
    const raw = (event.target as HTMLSelectElement).value;
    const option = this.field().options?.find((o) => String(o.value) === raw);
    this.changed.emit(option?.value ?? raw);
  }

  protected emitLinkChoice(event: Event) {
    const raw = (event.target as HTMLSelectElement).value;
    this.changed.emit(raw === CUSTOM ? '' : raw);
  }

  protected async pick() {
    const path = await this.store.pickFile();
    if (path) this.changed.emit(path);
  }

  protected setItem(index: number, key: string, value: unknown) {
    this.changed.emit(this.items().map((item, i) => (i === index ? { ...item, [key]: value } : item)));
  }

  protected addItem() {
    this.changed.emit([...this.items(), { ...this.field().itemDefault }]);
  }

  protected removeItem(index: number) {
    this.changed.emit(this.items().filter((_, i) => i !== index));
  }

  protected moveItem(index: number, step: number) {
    const list = [...this.items()];
    [list[index], list[index + step]] = [list[index + step], list[index]];
    this.changed.emit(list);
  }
}
