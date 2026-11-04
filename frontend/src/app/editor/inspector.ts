import { Component, computed, inject } from '@angular/core';
import { Icon } from '../core/icon';
import { definition, Field } from '../engine/blocks';
import { BlockStyle } from '../engine/model';
import { EditorStore } from './editor.store';
import { FieldEditor } from './field';

const STYLE_FIELDS: Field[] = [
  { key: 'paddingTop', label: 'Padding top', type: 'number', min: 0 },
  { key: 'paddingBottom', label: 'Padding bottom', type: 'number', min: 0 },
  { key: 'paddingX', label: 'Padding sides', type: 'number', min: 0 },
  { key: 'marginTop', label: 'Margin top', type: 'number' },
  { key: 'marginBottom', label: 'Margin bottom', type: 'number' },
  { key: 'radius', label: 'Corner radius', type: 'number', min: 0 },
  { key: 'maxWidth', label: 'Max width', type: 'number', min: 0 },
];

const ADVANCED_FIELDS: Field[] = [
  { key: 'backgroundImage', label: 'Background image', type: 'image' },
  { key: 'className', label: 'CSS class', type: 'text', hint: 'Target this block from the theme\'s custom CSS.' },
  { key: 'anchor', label: 'Anchor ID', type: 'text', hint: 'Link here with #anchor-id.' },
];

@Component({
  selector: 'ssm-inspector',
  imports: [FieldEditor, Icon],
  host: { class: 'block h-full overflow-y-auto bg-white p-3' },
  template: `
    @if (block(); as b) {
      <h2 class="mb-3 text-sm font-semibold">{{ def()!.label }}</h2>

      @for (field of def()!.fields; track field.key) {
        <ssm-field class="mb-3 block" [field]="field" [value]="b.props[field.key]"
          (changed)="store.updateProp(b.id, field.key, $event)" />
      }

      <h3 class="ui-heading mt-5">Style</h3>
      <div class="mb-3">
        <p class="ui-label">Text align</p>
        <div class="grid grid-cols-3 gap-1">
          @for (option of aligns; track option) {
            <button class="ui-btn px-1 capitalize" [class.border-indigo-500]="b.style?.textAlign === option"
              [attr.aria-pressed]="b.style?.textAlign === option"
              (click)="setStyle('textAlign', b.style?.textAlign === option ? '' : option)">{{ option }}</button>
          }
        </div>
      </div>
      <div class="mb-3 grid grid-cols-2 gap-2">
        @for (key of colors; track key.key) {
          <div>
            <p class="ui-label">{{ key.label }}</p>
            <div class="flex items-center gap-1">
              <input class="h-8 w-10 shrink-0 cursor-pointer rounded border border-zinc-300" type="color"
                [attr.aria-label]="key.label" [value]="b.style?.[key.key] || '#ffffff'" (input)="setStyle(key.key, $any($event.target).value)">
              <button class="ui-icon-btn" title="Clear" [attr.aria-label]="'Clear ' + key.label" (click)="setStyle(key.key, '')"><ssm-icon name="x" [size]="14" /></button>
            </div>
          </div>
        }
      </div>
      <div class="grid grid-cols-2 gap-2">
        @for (field of styleFields; track field.key) {
          <ssm-field [field]="field" [value]="styleValue(field.key)" (changed)="setStyle(field.key, $event)" />
        }
      </div>
      <div class="mt-3">
        @for (field of advancedFields; track field.key) {
          <ssm-field class="mb-3 block" [field]="field" [value]="styleValue(field.key)" (changed)="setStyle(field.key, $event)" />
        }
      </div>
    }
  `,
})
export class Inspector {
  protected readonly store = inject(EditorStore);

  protected readonly styleFields = STYLE_FIELDS;
  protected readonly advancedFields = ADVANCED_FIELDS;
  protected readonly aligns = ['left', 'center', 'right'];
  protected readonly colors: { key: 'color' | 'background'; label: string }[] = [
    { key: 'color', label: 'Text color' },
    { key: 'background', label: 'Background' },
  ];

  protected readonly block = this.store.selected;
  protected readonly def = computed(() => {
    const block = this.block();
    return block ? definition(block.type) : null;
  });

  protected styleValue(key: string) {
    return this.block()?.style?.[key as keyof BlockStyle];
  }

  protected setStyle(key: string, value: unknown) {
    this.store.updateStyle(this.block()!.id, key as keyof BlockStyle, value);
  }
}
