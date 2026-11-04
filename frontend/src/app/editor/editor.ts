import { Component, computed, HostListener, inject, input, OnDestroy, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { errorMessage } from '../core/api';
import { Icon } from '../core/icon';
import { Canvas } from './canvas';
import { Device, EditorStore } from './editor.store';
import { Inspector } from './inspector';
import { Assets, Layers, Pages, Palette, Settings, ThemePanel } from './panels';

type Panel = 'add' | 'layers' | 'pages' | 'files' | 'theme' | 'settings';

const STATUS_TEXT = {
  saved: 'Saved', saving: 'Saving…', unsaved: 'Unsaved changes',
  error: 'Not saved', conflict: 'Changed elsewhere',
};

@Component({
  selector: 'ssm-editor',
  imports: [RouterLink, Icon, Canvas, Inspector, Palette, Layers, Pages, Assets, ThemePanel, Settings],
  providers: [EditorStore],
  host: { class: 'flex h-screen flex-col overflow-hidden' },
  template: `
    @if (store.site()) {
      <header class="flex h-12 shrink-0 items-center gap-1.5 border-b border-zinc-200 bg-white px-2">
        <a class="ui-icon-btn" routerLink="/" title="All sites" aria-label="All sites"><ssm-icon name="back" /></a>
        <input class="min-w-0 w-44 rounded px-1.5 py-1 text-sm font-semibold outline-none hover:bg-zinc-100 focus:bg-zinc-100"
          aria-label="Site name" [value]="store.name()" (change)="store.rename($any($event.target).value)">
        <select class="ui-input w-36!" aria-label="Page" (change)="store.openPage($any($event.target).value)">
          @for (page of store.site()!.pages; track page.id) {
            <option [value]="page.id" [selected]="page.id === store.pageId()">{{ page.title }}</option>
          }
        </select>

        <div class="mx-auto flex items-center">
          @for (d of devices; track d.id) {
            <button class="ui-icon-btn" [class.bg-zinc-200]="store.device() === d.id" [title]="d.label" [attr.aria-label]="d.label"
              [attr.aria-pressed]="store.device() === d.id" (click)="store.device.set(d.id)"><ssm-icon [name]="d.icon" /></button>
          }
        </div>

        <span class="mr-1 text-xs whitespace-nowrap text-zinc-500" role="status" data-testid="save-status">{{ statusText() }}</span>
        <button class="ui-icon-btn" title="Undo (Ctrl+Z)" aria-label="Undo" [disabled]="!store.canUndo()" (click)="store.undo()"><ssm-icon name="undo" /></button>
        <button class="ui-icon-btn" title="Redo (Ctrl+Shift+Z)" aria-label="Redo" [disabled]="!store.canRedo()" (click)="store.redo()"><ssm-icon name="redo" /></button>
        <button class="ui-btn" [class.border-indigo-500]="store.previewing()" [attr.aria-pressed]="store.previewing()" (click)="togglePreview()">
          <ssm-icon name="eye" [size]="16" /> {{ store.previewing() ? 'Back to editing' : 'Preview' }}
        </button>
        <button class="ui-btn ui-btn-primary" [disabled]="exporting()" (click)="exportSite()">
          <ssm-icon name="download" [size]="16" /> {{ exporting() ? 'Exporting…' : 'Export ZIP' }}
        </button>
      </header>

      @if (store.notice()) {
        <div class="flex items-center gap-3 bg-amber-100 px-3 py-1.5 text-sm text-amber-900" role="alert">
          <span class="flex-1">{{ store.notice() }}</span>
          @if (store.saveStatus() === 'conflict') {
            <button class="ui-btn" (click)="reload()">Reload</button>
          }
          <button class="ui-icon-btn" aria-label="Dismiss" (click)="store.notice.set('')"><ssm-icon name="x" [size]="16" /></button>
        </div>
      }

      <div class="flex min-h-0 flex-1">
        @if (!store.previewing()) {
          <nav class="flex w-14 shrink-0 flex-col items-center gap-1 border-r border-zinc-200 bg-white py-2" aria-label="Editor panels">
            @for (item of panels; track item.id) {
              <button class="flex w-12 cursor-pointer flex-col items-center gap-0.5 rounded-md py-1.5 text-[10px] hover:bg-zinc-100"
                [class.bg-indigo-100]="panel() === item.id" [class.text-indigo-800]="panel() === item.id"
                [attr.aria-pressed]="panel() === item.id" (click)="panel.set(item.id)">
                <ssm-icon [name]="item.icon" /> {{ item.label }}
              </button>
            }
          </nav>
          <aside class="w-64 shrink-0 overflow-y-auto border-r border-zinc-200 bg-zinc-50 p-3">
            @switch (panel()) {
              @case ('add') { <ssm-palette /> }
              @case ('layers') { <ssm-layers /> }
              @case ('pages') { <ssm-pages /> }
              @case ('files') { <ssm-assets /> }
              @case ('theme') { <ssm-theme-panel /> }
              @case ('settings') { <ssm-settings /> }
            }
          </aside>
        }
        <ssm-canvas class="flex-1" />
        @if (store.selected() && !store.previewing()) {
          <ssm-inspector class="w-72 shrink-0 border-l border-zinc-200" />
        }
      </div>

      @if (store.picker()) {
        <div class="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" (keydown.escape)="store.closePicker(null)">
          <div class="flex max-h-[80vh] w-full max-w-xl flex-col rounded-xl bg-white shadow-xl" role="dialog" aria-label="Choose a file">
            <div class="flex items-center justify-between border-b border-zinc-200 px-4 py-2.5">
              <h2 class="font-semibold">Choose a file</h2>
              <button class="ui-icon-btn" aria-label="Close" (click)="store.closePicker(null)"><ssm-icon name="x" /></button>
            </div>
            <div class="overflow-y-auto p-4">
              <ssm-assets [picking]="true" (chosen)="store.closePicker($event)" />
            </div>
          </div>
        </div>
      }
    } @else {
      <main class="grid flex-1 place-items-center text-sm text-zinc-600">
        @if (loadError()) {
          <div class="text-center">
            <p class="mb-3" role="alert">{{ loadError() }}</p>
            <a class="ui-btn" routerLink="/">Back to your sites</a>
          </div>
        } @else {
          Loading…
        }
      </main>
    }
  `,
})
export class Editor implements OnInit, OnDestroy {
  protected readonly store = inject(EditorStore);
  readonly id = input.required<string>();

  protected readonly panel = signal<Panel>('add');
  protected readonly exporting = signal(false);
  protected readonly loadError = signal('');
  protected readonly statusText = computed(() => STATUS_TEXT[this.store.saveStatus()]);

  protected readonly panels: { id: Panel; label: string; icon: string }[] = [
    { id: 'add', label: 'Add', icon: 'plus' },
    { id: 'layers', label: 'Layers', icon: 'layers' },
    { id: 'pages', label: 'Pages', icon: 'pages' },
    { id: 'files', label: 'Files', icon: 'folder' },
    { id: 'theme', label: 'Theme', icon: 'palette' },
    { id: 'settings', label: 'Site', icon: 'settings' },
  ];
  protected readonly devices: { id: Device; label: string; icon: string }[] = [
    { id: 'desktop', label: 'Desktop width', icon: 'desktop' },
    { id: 'tablet', label: 'Tablet width', icon: 'tablet' },
    { id: 'phone', label: 'Phone width', icon: 'phone' },
  ];

  async ngOnInit() {
    try {
      await this.store.open(Number(this.id()));
    } catch (e) {
      this.loadError.set(errorMessage(e));
    }
  }

  ngOnDestroy() {
    void this.store.save();
  }

  @HostListener('window:beforeunload', ['$event'])
  protected warnBeforeLeaving(event: BeforeUnloadEvent) {
    if (this.store.hasUnsavedChanges) event.preventDefault();
  }

  @HostListener('window:keydown', ['$event'])
  protected onKey(event: KeyboardEvent) {
    const target = event.target;
    if (target instanceof Element && target.matches('input, textarea, select, [contenteditable]')) return;
    const mod = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();
    const id = this.store.selectedId();

    if (mod && key === 'z') {
      event.preventDefault();
      if (event.shiftKey) this.store.redo();
      else this.store.undo();
    } else if (mod && key === 'y') {
      event.preventDefault();
      this.store.redo();
    } else if (mod && key === 'd' && id) {
      event.preventDefault();
      this.store.duplicateBlock(id);
    } else if ((key === 'delete' || key === 'backspace') && id) {
      event.preventDefault();
      this.store.removeBlock(id);
    } else if (key === 'escape') {
      this.store.selectedId.set(null);
    }
  }

  protected togglePreview() {
    this.store.previewing.update((on) => !on);
  }

  protected async exportSite() {
    this.exporting.set(true);
    try {
      await this.store.exportZip();
    } catch (e) {
      this.store.notice.set(errorMessage(e));
    } finally {
      this.exporting.set(false);
    }
  }

  protected reload() {
    location.reload();
  }
}
