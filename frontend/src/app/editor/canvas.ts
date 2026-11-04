import { Component, computed, effect, ElementRef, inject, OnDestroy, OnInit, signal, viewChild } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Asset } from '../core/api';
import { Icon } from '../core/icon';
import { definition } from '../engine/blocks';
import { Block } from '../engine/model';
import { canvasDocument, canvasHtml, previewDocument } from '../engine/render';
import { themeCss } from '../engine/themes';
import { findBlock, getPath, pathTo } from '../engine/tree';
import { DragPayload, DropTarget, EditorStore } from './editor.store';

interface Box { left: number; top: number; width: number; height: number; }
interface InlineEdit extends Box { id: string; path: string; rich: boolean; html: string; css: Record<string, string>; }

const EDGE_PX = 12;
const MAX_EMBED_BYTES = 8 * 1024 * 1024;
const AUTOSCROLL_PX = 48;
const WIDTHS = { desktop: '100%', tablet: '768px', phone: '390px' };
const COPIED_STYLES = ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'color', 'textAlign', 'letterSpacing',
  'textTransform', 'backgroundColor', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'borderRadius'] as const;

function sameBox(a: Box | null, b: Box | null) {
  return a === b || (!!a && !!b && a.left === b.left && a.top === b.top && a.width === b.width && a.height === b.height);
}

function toBox(r: DOMRect): Box {
  return { left: r.left, top: r.top, width: r.width, height: r.height };
}

/**
 * The page lives in a sandboxed iframe that cannot run scripts, so custom HTML
 * can never touch the platform. All interaction goes through a transparent
 * overlay on top of it, which hit-tests the iframe's document.
 */
@Component({
  selector: 'ssm-canvas',
  imports: [Icon],
  host: { class: 'block h-full min-w-0 select-none' },
  template: `
    <div class="flex h-full justify-center bg-zinc-200 p-3">
      <div class="relative h-full max-w-full overflow-hidden bg-white shadow-sm" [style.width]="width()">
        @if (store.previewing()) {
          @if (preview(); as doc) {
            <iframe class="size-full border-0" title="Site preview" sandbox="allow-scripts allow-forms" [srcdoc]="doc"></iframe>
          }
        } @else {
          <iframe #frame class="size-full border-0" title="Page canvas" sandbox="allow-same-origin" (load)="onLoad()"></iframe>

          <div #overlay class="absolute inset-0 overflow-hidden" [class.cursor-grabbing]="ghost()"
            data-testid="canvas-overlay" (pointermove)="onHover($event)" (pointerleave)="hover.set(null)"
            (pointerdown)="onPointerDown($event)" (dblclick)="onDoubleClick($event)" (wheel)="onWheel($event)">
            @if (hover(); as box) {
              <div class="pointer-events-none absolute border border-indigo-400" [style]="boxStyle(box)"></div>
            }
            @if (selection(); as box) {
              <div class="pointer-events-none absolute border-2 border-indigo-600" [style]="boxStyle(box)"></div>
              <div class="absolute z-10 flex items-center rounded-md bg-indigo-600 text-white shadow"
                [style.left.px]="box.left" [style.top.px]="box.top >= 32 ? box.top - 32 : box.top + 2"
                (pointerdown)="$event.stopPropagation()" (dblclick)="$event.stopPropagation()">
                <span class="px-2 text-xs font-medium">{{ selectedLabel() }}</span>
                @if (parentId(); as parent) {
                  <button class="tool" title="Select parent" aria-label="Select parent" (click)="store.selectedId.set(parent)"><ssm-icon name="parent" [size]="14" /></button>
                }
                @if (!selectedInternal()) {
                  <button class="tool" title="Move up" aria-label="Move up" (click)="store.nudgeBlock(store.selectedId()!, -1)"><ssm-icon name="up" [size]="14" /></button>
                  <button class="tool" title="Move down" aria-label="Move down" (click)="store.nudgeBlock(store.selectedId()!, 1)"><ssm-icon name="down" [size]="14" /></button>
                  <button class="tool" title="Duplicate" aria-label="Duplicate" (click)="store.duplicateBlock(store.selectedId()!)"><ssm-icon name="copy" [size]="14" /></button>
                  <button class="tool" title="Delete" aria-label="Delete" (click)="store.removeBlock(store.selectedId()!)"><ssm-icon name="trash" [size]="14" /></button>
                }
              </div>
            }
            @if (indicator(); as box) {
              <div class="pointer-events-none absolute rounded-sm bg-indigo-600/70" data-testid="drop-indicator" [style]="boxStyle(box)"></div>
            }
            @if (inline(); as edit) {
              <div #inlineEditor class="absolute z-20 select-text outline-2 outline-indigo-600 [&_p]:mb-4 [&_p:last-child]:mb-0"
                [attr.contenteditable]="edit.rich ? 'true' : 'plaintext-only'" role="textbox" aria-label="Edit text"
                [style]="inlineStyle(edit)" (blur)="commitInline()" (keydown)="onInlineKey($event)"
                (pointerdown)="$event.stopPropagation()" (dblclick)="$event.stopPropagation()"></div>
            }
          </div>
        }
      </div>
    </div>

    @if (ghost(); as g) {
      <div class="pointer-events-none fixed z-50 rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white shadow-lg"
        [style.left.px]="g.x + 10" [style.top.px]="g.y + 10">{{ g.label }}</div>
    }
  `,
  styles: `.tool { display: inline-flex; padding: 6px; cursor: pointer; } .tool:hover { background: rgb(255 255 255 / 0.2); }`,
})
export class Canvas implements OnInit, OnDestroy {
  protected readonly store = inject(EditorStore);
  private readonly sanitizer = inject(DomSanitizer);

  private readonly frame = viewChild<ElementRef<HTMLIFrameElement>>('frame');
  private readonly overlay = viewChild<ElementRef<HTMLElement>>('overlay');
  private readonly inlineEditor = viewChild<ElementRef<HTMLElement>>('inlineEditor');

  private readonly ready = signal(false);
  protected readonly hover = signal<Box | null>(null);
  protected readonly selection = signal<Box | null>(null);
  protected readonly indicator = signal<Box | null>(null);
  protected readonly ghost = signal<{ x: number; y: number; label: string } | null>(null);
  protected readonly inline = signal<InlineEdit | null>(null);

  private dropTarget: DropTarget | null = null;
  private lastCss = '';
  private lastHtml = '';
  private editingEl: Element | null = null;
  private raf = 0;

  protected readonly width = computed(() => WIDTHS[this.store.device()]);
  private readonly baseUrl = computed(() => new URL(this.store.assetBase(), document.baseURI).href);
  protected readonly preview = signal<SafeHtml | null>(null);
  private readonly embedded = new Map<string, string>();
  private previewRun = 0;

  protected readonly selectedLabel = computed(() => {
    const block = this.store.selected();
    return block ? definition(block.type).label : '';
  });
  protected readonly selectedInternal = computed(() => {
    const block = this.store.selected();
    return !!block && !!definition(block.type).internal;
  });
  protected readonly parentId = computed(() => {
    const id = this.store.selectedId();
    return id ? pathTo(this.store.blocks(), id).at(-2)?.id ?? null : null;
  });

  constructor() {
    effect(() => {
      const site = this.store.site();
      const page = this.store.page();
      const assets = this.store.assets();
      if (!this.store.previewing()) {
        this.preview.set(null);
      } else if (site && page) {
        void this.buildPreview(previewDocument(site, this.baseUrl(), page.slug), assets);
      }
    });

    // Load the empty shell whenever the iframe is (re)created.
    effect(() => {
      const iframe = this.frame()?.nativeElement;
      if (!iframe) return;
      this.ready.set(false);
      iframe.srcdoc = canvasDocument(this.baseUrl());
    });

    // Patch the document in place, so editing never loses the scroll position.
    effect(() => {
      const site = this.store.site();
      const page = this.store.page();
      const doc = this.doc;
      if (!this.ready() || !site || !page || !doc) return;
      const css = themeCss(site.theme);
      if (css !== this.lastCss) {
        doc.getElementById('ssm-theme')!.textContent = css;
        this.lastCss = css;
      }
      const html = canvasHtml(site, page);
      if (html !== this.lastHtml) {
        doc.getElementById('ssm-root')!.innerHTML = html;
        this.lastHtml = html;
      }
    });

    effect(() => {
      const el = this.inlineEditor()?.nativeElement;
      const edit = this.inline();
      if (!el || !edit) return;
      el.innerHTML = edit.html;
      el.focus();
      const range = document.createRange();
      range.selectNodeContents(el);
      const selection = getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    });
  }

  ngOnInit() {
    this.store.beginDrag = (payload, event, label, onClick) => this.beginDrag(payload, event, label, onClick);
    const tick = () => {
      this.trackSelection();
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  ngOnDestroy() {
    cancelAnimationFrame(this.raf);
  }

  private get doc(): Document | null {
    return this.frame()?.nativeElement.contentDocument ?? null;
  }

  private el(id: string): Element | null {
    return this.doc?.querySelector(`[data-ssm-id="${id}"]`) ?? null;
  }

  /**
   * The preview runs scripts, so its frame has an opaque origin, and browsers may
   * refuse such frames access to local addresses. Embedding the files keeps the
   * preview complete without loosening the sandbox.
   */
  private async buildPreview(html: string, assets: Asset[]) {
    const run = ++this.previewRun;
    for (const asset of assets) {
      const embeddable = /^(image|font)\//.test(asset.mime) && asset.size <= MAX_EMBED_BYTES;
      if (!embeddable || !html.includes(asset.path)) continue;
      const data = this.embedded.get(asset.path) ?? await this.toDataUrl(asset);
      this.embedded.set(asset.path, data);
      html = html.split(asset.path).join(data);
    }
    if (run === this.previewRun) this.preview.set(this.sanitizer.bypassSecurityTrustHtml(html));
  }

  private async toDataUrl(asset: Asset): Promise<string> {
    const blob = await (await fetch(this.store.assetBase() + asset.path)).blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }

  protected onLoad() {
    if (!this.doc?.getElementById('ssm-root')) return;
    this.lastCss = '';
    this.lastHtml = '';
    this.ready.set(true);
  }

  /** Follows scrolling, image loads and reflows; only writes when something moved. */
  private trackSelection() {
    const id = this.store.selectedId();
    const el = id && !this.store.previewing() ? this.el(id) : null;
    const box = el ? toBox(el.getBoundingClientRect()) : null;
    if (!sameBox(box, this.selection())) this.selection.set(box);
  }

  private blockIdAt(x: number, y: number): string | null {
    return this.doc?.elementFromPoint(x, y)?.closest('[data-ssm-id]')?.getAttribute('data-ssm-id') ?? null;
  }

  private local(event: PointerEvent | MouseEvent) {
    const rect = this.overlay()!.nativeElement.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top, width: rect.width, height: rect.height };
  }

  protected onHover(event: PointerEvent) {
    if (this.ghost()) return;
    const { x, y } = this.local(event);
    const id = this.blockIdAt(x, y);
    const el = id && id !== this.store.selectedId() ? this.el(id) : null;
    const box = el ? toBox(el.getBoundingClientRect()) : null;
    if (!sameBox(box, this.hover())) this.hover.set(box);
  }

  protected onPointerDown(event: PointerEvent) {
    if (event.button !== 0) return;
    const { x, y } = this.local(event);
    const id = this.blockIdAt(x, y);
    this.store.selectedId.set(id);
    if (!id) return;
    const block = findBlock(this.store.blocks(), id);
    if (block && !definition(block.type).internal) {
      this.beginDrag({ kind: 'move', id }, event, definition(block.type).label);
    }
  }

  protected onWheel(event: WheelEvent) {
    event.preventDefault();
    this.frame()?.nativeElement.contentWindow?.scrollBy(event.deltaX, event.deltaY);
    this.hover.set(null);
  }

  protected boxStyle(box: Box) {
    return { left: `${box.left}px`, top: `${box.top}px`, width: `${box.width}px`, height: `${box.height}px` };
  }

  // ---- Drag and drop --------------------------------------------------------

  private beginDrag(payload: DragPayload, start: PointerEvent, label: string, onClick?: () => void) {
    start.preventDefault();
    let active = false;

    const move = (event: PointerEvent) => {
      if (!active && Math.hypot(event.clientX - start.clientX, event.clientY - start.clientY) < 5) return;
      active = true;
      this.hover.set(null);
      this.ghost.set({ x: event.clientX, y: event.clientY, label });
      this.updateDrop(payload, event);
    };
    const finish = (event: Event) => {
      removeEventListener('pointermove', move);
      removeEventListener('pointerup', finish);
      removeEventListener('pointercancel', finish);
      const target = this.dropTarget;
      this.ghost.set(null);
      this.indicator.set(null);
      this.dropTarget = null;
      if (active && target && event.type === 'pointerup') this.store.drop(payload, target);
      if (!active) onClick?.();
    };
    addEventListener('pointermove', move);
    addEventListener('pointerup', finish);
    addEventListener('pointercancel', finish);
  }

  private updateDrop(payload: DragPayload, event: PointerEvent) {
    if (!this.overlay()) return;
    const { x, y, width, height } = this.local(event);
    if (x < 0 || y < 0 || x > width || y > height) {
      this.dropTarget = null;
      this.indicator.set(null);
      return;
    }
    if (y < AUTOSCROLL_PX) this.frame()!.nativeElement.contentWindow?.scrollBy(0, -12);
    if (y > height - AUTOSCROLL_PX) this.frame()!.nativeElement.contentWindow?.scrollBy(0, 12);
    const drop = this.computeDrop(payload, x, y);
    this.dropTarget = drop.target;
    this.indicator.set(drop.box);
  }

  private computeDrop(payload: DragPayload, x: number, y: number): { target: DropTarget; box: Box } {
    const blocks = this.store.blocks();
    const type = payload.kind === 'new' ? payload.type : findBlock(blocks, payload.id)!.type;
    const pageLevelOnly = definition(type).root === 'only';
    let id = this.blockIdAt(x, y);

    // A block can't land inside itself: aim at whatever holds it instead.
    if (id && payload.kind === 'move') {
      const path = pathTo(blocks, id);
      const own = path.findIndex((b) => b.id === payload.id);
      if (own >= 0) id = path[own - 1]?.id ?? null;
    }
    if (!id) return this.dropInto(null, blocks, y);

    const path = pathTo(blocks, id);
    const hit = path.at(-1)!;
    if (pageLevelOnly) return this.dropBeside(null, blocks, path[0], y);

    if (definition(hit.type).container) {
      const rect = this.el(hit.id)!.getBoundingClientRect();
      const onEdge = y < rect.top + EDGE_PX || y > rect.bottom - EDGE_PX;
      if (path.length === 1 && onEdge) return this.dropBeside(null, blocks, hit, y);
      return this.dropInto(hit, hit.children!, y);
    }
    for (let i = path.length - 2; i >= 0; i--) {
      if (definition(path[i].type).container) return this.dropBeside(path[i], path[i].children!, path[i + 1], y);
    }
    return this.dropBeside(null, blocks, path[0], y);
  }

  private dropBeside(parent: Block | null, list: Block[], sibling: Block, y: number) {
    const rect = this.el(sibling.id)!.getBoundingClientRect();
    const index = list.indexOf(sibling) + (y > rect.top + rect.height / 2 ? 1 : 0);
    return this.dropResult(parent, list, index);
  }

  private dropInto(parent: Block | null, list: Block[], y: number) {
    let index = list.length;
    for (let i = 0; i < list.length; i++) {
      const rect = this.el(list[i].id)?.getBoundingClientRect();
      if (rect && y < rect.top + rect.height / 2) {
        index = i;
        break;
      }
    }
    return this.dropResult(parent, list, index);
  }

  private dropResult(parent: Block | null, list: Block[], index: number): { target: DropTarget; box: Box } {
    const target = { parentId: parent?.id ?? null, index };
    if (!list.length) {
      const area = parent ? this.el(parent.id)!.getBoundingClientRect() : this.doc!.getElementById('ssm-root')!.getBoundingClientRect();
      return { target, box: { left: area.left, top: area.top, width: area.width, height: Math.max(area.height, 8) } };
    }
    const after = list[index] ? this.el(list[index].id)!.getBoundingClientRect() : null;
    const before = list[index - 1] ? this.el(list[index - 1].id)!.getBoundingClientRect() : null;
    const edge = (after ?? before)!;
    const top = after ? after.top : before!.bottom;
    return { target, box: { left: edge.left, top: Math.max(top - 2, 0), width: edge.width, height: 4 } };
  }

  // ---- Inline text editing --------------------------------------------------

  protected onDoubleClick(event: MouseEvent) {
    const { x, y } = this.local(event);
    const el = this.doc?.elementFromPoint(x, y)?.closest('[data-ssm-edit]');
    const id = el?.closest('[data-ssm-id]')?.getAttribute('data-ssm-id');
    if (!el || !id) return;
    const block = findBlock(this.store.blocks(), id)!;
    const path = el.getAttribute('data-ssm-edit')!;
    const rich = el.hasAttribute('data-ssm-rich');
    const computedStyle = el.ownerDocument.defaultView!.getComputedStyle(el);
    const css: Record<string, string> = {};
    for (const key of COPIED_STYLES) css[key] = computedStyle[key];
    const value = String(getPath(block.props, path) ?? '');
    const box = toBox(el.getBoundingClientRect());

    el.setAttribute('data-ssm-editing', '');
    this.editingEl = el;
    this.inline.set({ ...box, id, path, rich, css, html: rich ? value : value.replace(/&/g, '&amp;').replace(/</g, '&lt;') });
  }

  protected inlineStyle(edit: InlineEdit) {
    return {
      ...edit.css,
      left: `${edit.left}px`, top: `${edit.top}px`, width: `${edit.width}px`, minHeight: `${edit.height}px`,
    };
  }

  protected onInlineKey(event: KeyboardEvent) {
    event.stopPropagation();
    const edit = this.inline();
    if (event.key === 'Escape') this.closeInline();
    if (event.key === 'Enter' && edit && !edit.rich) {
      event.preventDefault();
      this.commitInline();
    }
  }

  protected commitInline() {
    const edit = this.inline();
    const el = this.inlineEditor()?.nativeElement;
    if (!edit || !el) return;
    const value = edit.rich ? el.innerHTML : el.innerText.trim();
    const block = findBlock(this.store.blocks(), edit.id);
    this.closeInline();
    if (block && value !== String(getPath(block.props, edit.path) ?? '')) {
      this.store.updateProp(edit.id, edit.path, value);
    }
  }

  private closeInline() {
    this.editingEl?.removeAttribute('data-ssm-editing');
    this.editingEl = null;
    this.inline.set(null);
  }
}
