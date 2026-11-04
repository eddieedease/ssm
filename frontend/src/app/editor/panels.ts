import { Component, computed, inject, input, OnInit, output, signal } from '@angular/core';
import { Api, Asset, errorMessage, SavedTheme } from '../core/api';
import { Icon } from '../core/icon';
import { BlockDefinition, BLOCKS, definition } from '../engine/blocks';
import { Block, Theme, ThemeTokens } from '../engine/model';
import { FONT_STACKS, PRESET_THEMES } from '../engine/themes';
import { EditorStore } from './editor.store';
import { FieldEditor } from './field';

// ---- Components -------------------------------------------------------------

@Component({
  selector: 'ssm-palette',
  imports: [Icon],
  template: `
    <p class="mb-3 text-xs text-zinc-500">Drag onto the page, or click to add.</p>
    @for (group of groups; track group.name) {
      <h3 class="ui-heading">{{ group.name }}</h3>
      <div class="mb-4 grid grid-cols-2 gap-1.5">
        @for (block of group.blocks; track block.type) {
          <button class="flex cursor-grab touch-none flex-col items-center gap-1 rounded-md border border-zinc-200 bg-white px-1 py-2.5 text-xs select-none hover:border-indigo-400 hover:bg-indigo-50"
            [attr.data-block]="block.type" (pointerdown)="start($event, block)" (keydown.enter)="store.addBlock(block.type)">
            <ssm-icon [name]="block.icon" />
            {{ block.label }}
          </button>
        }
      </div>
    }
  `,
})
export class Palette {
  protected readonly store = inject(EditorStore);
  protected readonly groups = (['Sections', 'Layout', 'Content'] as const).map((name) => ({
    name, blocks: BLOCKS.filter((b) => b.group === name && !b.internal),
  }));

  protected start(event: PointerEvent, block: BlockDefinition) {
    this.store.beginDrag({ kind: 'new', type: block.type }, event, block.label, () => this.store.addBlock(block.type));
  }
}

// ---- Layers -----------------------------------------------------------------

@Component({
  selector: 'ssm-layer',
  imports: [Icon],
  template: `
    <button class="flex w-full cursor-pointer touch-none items-center gap-1.5 rounded px-1.5 py-1 text-left text-sm select-none hover:bg-zinc-100"
      [class.bg-indigo-100]="store.selectedId() === block().id" [style.padding-left.px]="6 + depth() * 14"
      (pointerdown)="start($event)" (keydown.enter)="store.selectedId.set(block().id)">
      <ssm-icon [name]="def().icon" [size]="15" />
      <span class="truncate">{{ def().label }}</span>
    </button>
    @for (child of block().children ?? []; track child.id) {
      <ssm-layer [block]="child" [depth]="depth() + 1" />
    }
  `,
})
export class Layer {
  protected readonly store = inject(EditorStore);
  readonly block = input.required<Block>();
  readonly depth = input(0);
  protected readonly def = computed(() => definition(this.block().type));

  protected start(event: PointerEvent) {
    const select = () => this.store.selectedId.set(this.block().id);
    if (this.def().internal) {
      select();
      return;
    }
    this.store.beginDrag({ kind: 'move', id: this.block().id }, event, this.def().label, select);
  }
}

@Component({
  selector: 'ssm-layers',
  imports: [Layer],
  template: `
    @for (block of store.blocks(); track block.id) {
      <ssm-layer [block]="block" />
    } @empty {
      <p class="text-sm text-zinc-500">This page is empty.</p>
    }
  `,
})
export class Layers {
  protected readonly store = inject(EditorStore);
}

// ---- Pages ------------------------------------------------------------------

@Component({
  selector: 'ssm-pages',
  imports: [Icon],
  template: `
    <button class="ui-btn mb-3 w-full" (click)="store.addPage()"><ssm-icon name="plus" [size]="15" /> Add page</button>
    @for (page of store.site()!.pages; track page.id; let i = $index; let last = $last) {
      <div class="mb-1.5 rounded-md border bg-white" [class.border-indigo-500]="page.id === store.pageId()" [class.border-zinc-200]="page.id !== store.pageId()">
        <div class="flex items-center">
          <button class="min-w-0 flex-1 cursor-pointer truncate px-2.5 py-2 text-left text-sm font-medium" (click)="store.openPage(page.id)">{{ page.title }}</button>
          <button class="ui-icon-btn" title="Move up" [attr.aria-label]="'Move ' + page.title + ' up'" [disabled]="i === 0" (click)="store.movePage(page.id, -1)"><ssm-icon name="up" [size]="15" /></button>
          <button class="ui-icon-btn" title="Move down" [attr.aria-label]="'Move ' + page.title + ' down'" [disabled]="last" (click)="store.movePage(page.id, 1)"><ssm-icon name="down" [size]="15" /></button>
        </div>
        @if (page.id === store.pageId()) {
          <div class="border-t border-zinc-200 p-2.5">
            <label class="ui-label">Title
              <input class="ui-input mt-1" [value]="page.title" (input)="store.updatePage(page.id, { title: $any($event.target).value })">
            </label>
            <label class="ui-label mt-2">Address
              <input class="ui-input mt-1" [value]="page.slug" (change)="store.updateSlug(page.id, $any($event.target).value)">
            </label>
            <label class="ui-label mt-2">Description
              <textarea class="ui-input mt-1" rows="2" [value]="page.description" (input)="store.updatePage(page.id, { description: $any($event.target).value })"></textarea>
            </label>
            @if (i === 0) {
              <p class="mt-2 text-xs text-zinc-500">The first page is the home page (index.html).</p>
            }
            <div class="mt-2 flex gap-1.5">
              <button class="ui-btn flex-1" (click)="store.duplicatePage(page.id)">Duplicate</button>
              <button class="ui-btn ui-btn-danger flex-1" [disabled]="store.site()!.pages.length === 1" (click)="remove(page.id, page.title)">Delete</button>
            </div>
          </div>
        }
      </div>
    }
  `,
})
export class Pages {
  protected readonly store = inject(EditorStore);

  protected remove(id: string, title: string) {
    if (confirm(`Delete the page "${title}"?`)) this.store.deletePage(id);
  }
}

// ---- Files ------------------------------------------------------------------

@Component({
  selector: 'ssm-assets',
  imports: [Icon],
  template: `
    <label class="mb-3 flex cursor-pointer flex-col items-center gap-1 rounded-lg border-2 border-dashed px-3 py-5 text-center text-sm hover:border-indigo-400"
      [class.border-indigo-500]="dragOver()" [class.border-zinc-300]="!dragOver()"
      (dragover)="$event.preventDefault(); dragOver.set(true)" (dragleave)="dragOver.set(false)" (drop)="onDrop($event)">
      <span class="font-medium">{{ uploading() ? 'Uploading…' : 'Upload files' }}</span>
      <span class="text-xs text-zinc-500">Click or drop images, video, PDFs or fonts</span>
      <input class="sr-only" type="file" multiple data-testid="asset-input" (change)="onPick($event)">
    </label>

    <div class="grid gap-2" [class.grid-cols-2]="!picking()" [class.grid-cols-3]="picking()">
      @for (asset of store.assets(); track asset.id) {
        <div class="group relative min-w-0 overflow-hidden rounded-md border border-zinc-200 bg-white">
          <button class="block w-full" [class.cursor-pointer]="picking()" [attr.aria-label]="picking() ? 'Choose ' + asset.originalName : null" (click)="chosen.emit(asset.path)">
            @if (asset.mime.startsWith('image/')) {
              <img class="h-20 w-full bg-zinc-100 object-contain" [src]="store.assetBase() + asset.path" [alt]="asset.originalName">
            } @else {
              <span class="flex h-20 items-center justify-center bg-zinc-100 text-xs font-medium text-zinc-500 uppercase">{{ extension(asset) }}</span>
            }
          </button>
          <p class="truncate px-1.5 py-1 text-xs" [title]="asset.path">{{ asset.filename }}</p>
          @if (!picking()) {
            <button class="absolute top-1 right-1 cursor-pointer rounded bg-white/90 p-1 text-zinc-700 hover:text-red-700" [attr.aria-label]="'Delete ' + asset.filename" (click)="remove(asset)">
              <ssm-icon name="trash" [size]="14" />
            </button>
          }
        </div>
      } @empty {
        <p class="col-span-full text-sm text-zinc-500">No files yet. Everything here is included in the export under assets/.</p>
      }
    </div>
  `,
})
export class Assets {
  protected readonly store = inject(EditorStore);
  readonly picking = input(false);
  readonly chosen = output<string>();

  protected readonly dragOver = signal(false);
  protected readonly uploading = signal(false);

  protected extension(asset: Asset) {
    return asset.filename.split('.').pop();
  }

  protected onPick(event: Event) {
    const inputEl = event.target as HTMLInputElement;
    if (inputEl.files) void this.send(inputEl.files).then(() => (inputEl.value = ''));
  }

  protected onDrop(event: DragEvent) {
    event.preventDefault();
    this.dragOver.set(false);
    if (event.dataTransfer?.files.length) void this.send(event.dataTransfer.files);
  }

  private async send(files: FileList) {
    this.uploading.set(true);
    await this.store.upload(files);
    this.uploading.set(false);
  }

  protected remove(asset: Asset) {
    const warning = this.store.isAssetUsed(asset)
      ? `"${asset.filename}" is used on your site. Delete it anyway?`
      : `Delete "${asset.filename}"?`;
    if (confirm(warning)) void this.store.deleteAsset(asset);
  }
}

// ---- Theme ------------------------------------------------------------------

@Component({
  selector: 'ssm-theme-panel',
  imports: [Icon],
  template: `
    <h3 class="ui-heading">Themes</h3>
    <div class="mb-4 grid grid-cols-2 gap-1.5">
      @for (theme of presets; track theme.name) {
        <button class="cursor-pointer rounded-md border border-zinc-200 p-2 text-left text-xs font-medium hover:border-indigo-400"
          [style.background]="theme.tokens.background" [style.color]="theme.tokens.text" (click)="apply(theme)">
          {{ theme.name }}
          <span class="mt-1 block h-1.5 w-8 rounded-full" [style.background]="theme.tokens.primary"></span>
        </button>
      }
    </div>

    @if (saved().length) {
      <h3 class="ui-heading">My themes</h3>
      <ul class="mb-4">
        @for (item of saved(); track item.id) {
          <li class="flex items-center">
            <button class="min-w-0 flex-1 cursor-pointer truncate rounded px-1 py-1 text-left text-sm hover:bg-zinc-100" (click)="apply(item.theme)">{{ item.name }}</button>
            <button class="ui-icon-btn" [attr.aria-label]="'Delete ' + item.name" (click)="remove(item)"><ssm-icon name="trash" [size]="15" /></button>
          </li>
        }
      </ul>
    }

    <h3 class="ui-heading">Colors</h3>
    <div class="mb-4 grid grid-cols-2 gap-x-2 gap-y-1.5">
      @for (color of colors; track color.key) {
        <label class="flex items-center gap-1.5 text-xs">
          <input class="h-7 w-8 shrink-0 cursor-pointer rounded border border-zinc-300" type="color"
            [value]="tokens()[color.key]" (input)="store.updateToken(color.key, $any($event.target).value)">
          {{ color.label }}
        </label>
      }
    </div>

    <h3 class="ui-heading">Type and shape</h3>
    <label class="ui-label">Body font
      <select class="ui-input mt-1" (change)="store.updateToken('fontBody', $any($event.target).value)">
        @for (font of fonts; track font.value) { <option [value]="font.value" [selected]="font.value === tokens().fontBody">{{ font.label }}</option> }
      </select>
    </label>
    <label class="ui-label mt-2">Heading font
      <select class="ui-input mt-1" (change)="store.updateToken('fontHeading', $any($event.target).value)">
        @for (font of fonts; track font.value) { <option [value]="font.value" [selected]="font.value === tokens().fontHeading">{{ font.label }}</option> }
      </select>
    </label>
    <div class="mt-2 mb-4 grid grid-cols-3 gap-2">
      @for (n of numbers; track n.key) {
        <label class="ui-label">{{ n.label }}
          <input class="ui-input mt-1" type="number" min="0" [value]="tokens()[n.key]" (input)="setNumber(n.key, $event)">
        </label>
      }
    </div>

    <h3 class="ui-heading">Custom CSS</h3>
    <textarea class="ui-input font-mono text-xs" rows="12" spellcheck="false" aria-label="Custom CSS" data-testid="custom-css"
      placeholder=".ssm-button { box-shadow: 0 4px 0 #0002; }"
      [value]="store.site()!.theme.css" (input)="store.updateThemeCss($any($event.target).value)"></textarea>
    <p class="mt-1 mb-4 text-xs text-zinc-500">Added after the theme. Files are at assets/name.png, and &#64;import works too.</p>

    <form class="flex gap-1.5" (submit)="save($event)">
      <input class="ui-input" name="name" required placeholder="Theme name" aria-label="Theme name">
      <button class="ui-btn shrink-0">Save theme</button>
    </form>
  `,
})
export class ThemePanel implements OnInit {
  private readonly api = inject(Api);
  protected readonly store = inject(EditorStore);

  protected readonly presets = PRESET_THEMES;
  protected readonly fonts = FONT_STACKS;
  protected readonly saved = signal<SavedTheme[]>([]);
  protected readonly tokens = computed(() => this.store.site()!.theme.tokens);

  protected readonly colors: { key: keyof ThemeTokens & string; label: string }[] = [
    { key: 'primary', label: 'Accent' }, { key: 'onPrimary', label: 'On accent' },
    { key: 'background', label: 'Background' }, { key: 'surface', label: 'Surface' },
    { key: 'text', label: 'Text' }, { key: 'muted', label: 'Muted' }, { key: 'border', label: 'Border' },
  ];
  protected readonly numbers: { key: 'radius' | 'baseSize' | 'containerWidth'; label: string }[] = [
    { key: 'radius', label: 'Radius' }, { key: 'baseSize', label: 'Text size' }, { key: 'containerWidth', label: 'Width' },
  ];

  async ngOnInit() {
    try {
      this.saved.set(await this.api.themes());
    } catch (e) {
      this.store.notice.set(errorMessage(e));
    }
  }

  protected apply(theme: Theme) {
    this.store.applyTheme(theme);
  }

  protected setNumber(key: 'radius' | 'baseSize' | 'containerWidth', event: Event) {
    const value = Number((event.target as HTMLInputElement).value);
    if (!Number.isNaN(value)) this.store.updateToken(key, value);
  }

  protected async save(event: Event) {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const name = String(new FormData(form).get('name')).trim();
    try {
      const theme = await this.api.saveTheme(name, { ...this.store.site()!.theme, name });
      this.saved.update((list) => [...list, theme]);
      form.reset();
    } catch (e) {
      this.store.notice.set(errorMessage(e));
    }
  }

  protected async remove(item: SavedTheme) {
    try {
      await this.api.deleteTheme(item.id);
      this.saved.update((list) => list.filter((t) => t.id !== item.id));
    } catch (e) {
      this.store.notice.set(errorMessage(e));
    }
  }
}

// ---- Site settings ----------------------------------------------------------

@Component({
  selector: 'ssm-settings',
  imports: [FieldEditor],
  template: `
    @let s = store.site()!.settings;
    <fieldset class="mb-4">
      <legend class="ui-label">Export as</legend>
      <label class="mb-1.5 flex cursor-pointer items-start gap-2 rounded-md border border-zinc-200 p-2 has-checked:border-indigo-500">
        <input class="mt-1" type="radio" name="mode" [checked]="s.mode === 'spa'" (change)="store.updateSettings({ mode: 'spa' })">
        <span class="text-sm"><span class="block font-medium">Single page app</span><span class="text-xs text-zinc-600">One index.html. Pages switch instantly.</span></span>
      </label>
      <label class="flex cursor-pointer items-start gap-2 rounded-md border border-zinc-200 p-2 has-checked:border-indigo-500">
        <input class="mt-1" type="radio" name="mode" [checked]="s.mode === 'multi'" (change)="store.updateSettings({ mode: 'multi' })">
        <span class="text-sm"><span class="block font-medium">Separate pages</span><span class="text-xs text-zinc-600">One .html file per page.</span></span>
      </label>
    </fieldset>
    <label class="ui-label">Site title
      <input class="ui-input mt-1" [value]="s.title" (input)="store.updateSettings({ title: $any($event.target).value })">
    </label>
    <label class="ui-label mt-3">Description
      <textarea class="ui-input mt-1" rows="3" [value]="s.description" (input)="store.updateSettings({ description: $any($event.target).value })"></textarea>
    </label>
    <label class="ui-label mt-3">Language code
      <input class="ui-input mt-1" [value]="s.lang" (input)="store.updateSettings({ lang: $any($event.target).value })">
    </label>
    <ssm-field class="mt-3 block" [field]="favicon" [value]="s.favicon" (changed)="store.updateSettings({ favicon: $event })" />
  `,
})
export class Settings {
  protected readonly store = inject(EditorStore);
  protected readonly favicon = { key: 'favicon', label: 'Favicon', type: 'image' as const };
}
