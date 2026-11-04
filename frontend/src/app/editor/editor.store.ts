import { HttpErrorResponse } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Api, Asset, errorMessage, Project } from '../core/api';
import { columnBlock, createBlock, definition } from '../engine/blocks';
import { Block, BlockStyle, Page, Site, SiteSettings, slugify, Theme, ThemeTokens, uid } from '../engine/model';
import { exportFiles } from '../engine/render';
import { findBlock, locate, pathTo, setPath, withNewIds } from '../engine/tree';

export type DragPayload = { kind: 'new'; type: string } | { kind: 'move'; id: string };
export interface DropTarget { parentId: string | null; index: number; }
export type Device = 'desktop' | 'tablet' | 'phone';
export type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error' | 'conflict';

const HISTORY_LIMIT = 100;
const COALESCE_MS = 800;
const SAVE_DELAY_MS = 1000;

/** State for one open project: the site document, history, selection and saving. */
@Injectable()
export class EditorStore {
  private readonly api = inject(Api);

  readonly projectId = signal(0);
  readonly name = signal('');
  readonly assetBase = signal('');
  readonly site = signal<Site | null>(null);
  readonly assets = signal<Asset[]>([]);
  private revision = 0;

  readonly pageId = signal('');
  readonly selectedId = signal<string | null>(null);
  readonly device = signal<Device>('desktop');
  readonly previewing = signal(false);

  readonly saveStatus = signal<SaveStatus>('saved');
  readonly notice = signal('');

  /** Open file picker; resolved with the chosen path, or null on cancel. */
  readonly picker = signal<{ resolve: (path: string | null) => void } | null>(null);

  /** Set by the canvas, used by anything that can start a drag. */
  beginDrag: (payload: DragPayload, event: PointerEvent, label: string, onClick?: () => void) => void = () => {};

  readonly page = computed(() => this.site()?.pages.find((p) => p.id === this.pageId()) ?? null);
  readonly blocks = computed(() => this.page()?.blocks ?? []);
  readonly selected = computed(() => {
    const id = this.selectedId();
    return id ? findBlock(this.blocks(), id) : null;
  });

  private readonly past = signal<Site[]>([]);
  private readonly future = signal<Site[]>([]);
  readonly canUndo = computed(() => this.past().length > 0);
  readonly canRedo = computed(() => this.future().length > 0);
  private lastKey = '';
  private lastEditAt = 0;

  private saveTimer?: ReturnType<typeof setTimeout>;
  private saving: Promise<void> | null = null;
  private dirty = false;

  async open(id: number) {
    const [project, assets] = await Promise.all([this.api.project(id), this.api.assets(id)]);
    this.adopt(project);
    this.assets.set(assets);
  }

  private adopt(project: Project) {
    this.projectId.set(project.id);
    this.name.set(project.name);
    this.assetBase.set(project.assetBase);
    this.revision = project.revision;
    this.site.set(project.site);
    this.pageId.set(project.site.pages[0].id);
  }

  // ---- History --------------------------------------------------------------

  /** Applies a change to a copy. Same `key` in quick succession is one undo step. */
  private change(apply: (draft: Site) => void, key = '') {
    const current = this.site();
    if (!current) return;
    const now = Date.now();
    if (!key || key !== this.lastKey || now - this.lastEditAt > COALESCE_MS) {
      this.past.update((list) => [...list.slice(-(HISTORY_LIMIT - 1)), current]);
    }
    this.lastKey = key;
    this.lastEditAt = now;
    this.future.set([]);
    const draft = structuredClone(current);
    apply(draft);
    this.site.set(draft);
    this.touch();
  }

  undo() {
    const previous = this.past().at(-1);
    if (!previous) return;
    this.future.update((list) => [...list, this.site()!]);
    this.past.update((list) => list.slice(0, -1));
    this.restore(previous);
  }

  redo() {
    const next = this.future().at(-1);
    if (!next) return;
    this.past.update((list) => [...list, this.site()!]);
    this.future.update((list) => list.slice(0, -1));
    this.restore(next);
  }

  private restore(site: Site) {
    this.lastKey = '';
    this.site.set(site);
    if (!site.pages.some((p) => p.id === this.pageId())) this.pageId.set(site.pages[0].id);
    this.touch();
  }

  // ---- Blocks ---------------------------------------------------------------

  private draftBlocks(draft: Site): Block[] {
    return draft.pages.find((p) => p.id === this.pageId())!.blocks;
  }

  private listFor(blocks: Block[], parentId: string | null): Block[] {
    if (parentId === null) return blocks;
    return findBlock(blocks, parentId)!.children!;
  }

  private place(blocks: Block[], block: Block, target: DropTarget) {
    const atRoot = target.parentId === null;
    const item = atRoot && !definition(block.type).root ? createBlock('section', {}, [block]) : block;
    this.listFor(blocks, target.parentId).splice(target.index, 0, item);
  }

  drop(payload: DragPayload, target: DropTarget) {
    if (payload.kind === 'new') {
      const block = createBlock(payload.type);
      this.change((draft) => this.place(this.draftBlocks(draft), block, target));
      this.selectedId.set(block.id);
      return;
    }
    this.change((draft) => {
      const blocks = this.draftBlocks(draft);
      const from = locate(blocks, payload.id);
      if (!from) return;
      const destination = this.listFor(blocks, target.parentId);
      const index = destination === from.list && from.index < target.index ? target.index - 1 : target.index;
      const [block] = from.list.splice(from.index, 1);
      this.place(blocks, block, { ...target, index });
    });
    this.selectedId.set(payload.id);
  }

  /** Palette click: inserts next to the current selection, or at the page end. */
  addBlock(type: string) {
    const blocks = this.blocks();
    const path = this.selectedId() ? pathTo(blocks, this.selectedId()!) : [];
    const rootEnd: DropTarget = { parentId: null, index: blocks.length };
    let target = rootEnd;

    if (path.length && definition(type).root === 'only') {
      target = { parentId: null, index: blocks.indexOf(path[0]) + 1 };
    } else if (path.length) {
      const selected = path.at(-1)!;
      if (definition(selected.type).container) {
        target = { parentId: selected.id, index: selected.children!.length };
      } else {
        const parent = path.at(-2);
        if (parent && definition(parent.type).container) {
          target = { parentId: parent.id, index: parent.children!.indexOf(selected) + 1 };
        } else if (!parent) {
          target = { parentId: null, index: blocks.indexOf(selected) + 1 };
        }
      }
    }
    this.drop({ kind: 'new', type }, target);
  }

  removeBlock(id: string) {
    this.change((draft) => {
      const found = locate(this.draftBlocks(draft), id);
      found?.list.splice(found.index, 1);
    });
    if (this.selectedId() === id) this.selectedId.set(null);
  }

  duplicateBlock(id: string) {
    const original = findBlock(this.blocks(), id);
    if (!original || definition(original.type).internal) return;
    const copy = withNewIds(original);
    this.change((draft) => {
      const found = locate(this.draftBlocks(draft), id)!;
      found.list.splice(found.index + 1, 0, copy);
    });
    this.selectedId.set(copy.id);
  }

  nudgeBlock(id: string, step: -1 | 1) {
    this.change((draft) => {
      const found = locate(this.draftBlocks(draft), id);
      if (!found) return;
      const next = found.index + step;
      if (next < 0 || next >= found.list.length) return;
      [found.list[found.index], found.list[next]] = [found.list[next], found.list[found.index]];
    });
  }

  updateProp(id: string, path: string, value: unknown) {
    this.change((draft) => {
      const block = findBlock(this.draftBlocks(draft), id);
      if (!block) return;
      setPath(block.props, path, value);
      if (block.type === 'columns' && path === 'count') this.syncColumns(block);
    }, `prop:${id}:${path}`);
  }

  /** Removing a column keeps its content by moving it into the last remaining one. */
  private syncColumns(block: Block) {
    const count = Math.min(6, Math.max(1, Number(block.props['count']) || 1));
    const columns = block.children!;
    while (columns.length < count) columns.push(columnBlock());
    while (columns.length > count) {
      const removed = columns.pop()!;
      columns.at(-1)!.children!.push(...removed.children!);
    }
  }

  updateStyle(id: string, key: keyof BlockStyle, value: unknown) {
    this.change((draft) => {
      const block = findBlock(this.draftBlocks(draft), id);
      if (!block) return;
      block.style = { ...block.style, [key]: value === '' ? undefined : value };
    }, `style:${id}:${key}`);
  }

  // ---- Pages ----------------------------------------------------------------

  private uniqueSlug(site: Site, wanted: string, ignoreId?: string): string {
    const base = slugify(wanted) || 'page';
    const taken = new Set(site.pages.filter((p) => p.id !== ignoreId).map((p) => p.slug));
    let slug = base;
    for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`;
    return slug;
  }

  addPage() {
    const site = this.site()!;
    const title = `Page ${site.pages.length + 1}`;
    const page: Page = { id: uid(), title, slug: this.uniqueSlug(site, title), description: '', blocks: [] };
    this.change((draft) => draft.pages.push(page));
    this.openPage(page.id);
  }

  duplicatePage(id: string) {
    const site = this.site()!;
    const source = site.pages.find((p) => p.id === id)!;
    const title = `${source.title} copy`;
    const page: Page = { ...source, id: uid(), title, slug: this.uniqueSlug(site, title), blocks: source.blocks.map(withNewIds) };
    this.change((draft) => draft.pages.splice(site.pages.indexOf(source) + 1, 0, page));
    this.openPage(page.id);
  }

  deletePage(id: string) {
    const site = this.site()!;
    if (site.pages.length === 1) return;
    this.change((draft) => {
      draft.pages = draft.pages.filter((p) => p.id !== id);
    });
    if (this.pageId() === id) this.openPage(this.site()!.pages[0].id);
  }

  movePage(id: string, step: -1 | 1) {
    this.change((draft) => {
      const index = draft.pages.findIndex((p) => p.id === id);
      const next = index + step;
      if (next < 0 || next >= draft.pages.length) return;
      [draft.pages[index], draft.pages[next]] = [draft.pages[next], draft.pages[index]];
    });
  }

  openPage(id: string) {
    this.pageId.set(id);
    this.selectedId.set(null);
  }

  updatePage(id: string, patch: Partial<Pick<Page, 'title' | 'description'>>) {
    this.change((draft) => Object.assign(draft.pages.find((p) => p.id === id)!, patch), `page:${id}`);
  }

  /** Changes a page's address and repoints every link that used the old one. */
  updateSlug(id: string, wanted: string) {
    this.change((draft) => {
      const page = draft.pages.find((p) => p.id === id)!;
      const slug = this.uniqueSlug(draft, wanted, id);
      const json = JSON.stringify(draft.pages).split(`"page:${page.slug}"`).join(`"page:${slug}"`);
      draft.pages = JSON.parse(json);
      draft.pages.find((p) => p.id === id)!.slug = slug;
    });
  }

  // ---- Site -----------------------------------------------------------------

  updateSettings(patch: Partial<SiteSettings>) {
    this.change((draft) => Object.assign(draft.settings, patch), 'settings');
  }

  updateToken<K extends keyof ThemeTokens>(key: K, value: ThemeTokens[K]) {
    this.change((draft) => { draft.theme.tokens[key] = value; }, `token:${key}`);
  }

  updateThemeCss(css: string) {
    this.change((draft) => { draft.theme.css = css; }, 'theme-css');
  }

  applyTheme(theme: Theme) {
    this.change((draft) => { draft.theme = structuredClone(theme); });
  }

  rename(name: string) {
    this.name.set(name);
    this.touch();
  }

  // ---- Files ----------------------------------------------------------------

  pickFile(): Promise<string | null> {
    return new Promise((resolve) => this.picker.set({ resolve }));
  }

  closePicker(path: string | null) {
    this.picker()?.resolve(path);
    this.picker.set(null);
  }

  async upload(files: FileList | File[]): Promise<Asset[]> {
    const added: Asset[] = [];
    for (const file of Array.from(files)) {
      try {
        const asset = await this.api.uploadAsset(this.projectId(), file);
        added.push(asset);
        this.assets.update((list) => [asset, ...list]);
      } catch (e) {
        this.notice.set(`${file.name}: ${errorMessage(e)}`);
      }
    }
    return added;
  }

  async deleteAsset(asset: Asset) {
    try {
      await this.api.deleteAsset(asset.id);
      this.assets.update((list) => list.filter((a) => a.id !== asset.id));
    } catch (e) {
      this.notice.set(errorMessage(e));
    }
  }

  isAssetUsed(asset: Asset): boolean {
    return JSON.stringify(this.site()).includes(asset.path);
  }

  // ---- Saving ---------------------------------------------------------------

  private touch() {
    this.dirty = true;
    if (this.saveStatus() === 'conflict') return;
    this.saveStatus.set('unsaved');
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => void this.save(), SAVE_DELAY_MS);
  }

  /** Saves now and waits, including for a save already under way. */
  async save(): Promise<void> {
    clearTimeout(this.saveTimer);
    if (this.saving) await this.saving;
    if (!this.dirty || this.saveStatus() === 'conflict') return;
    this.saving = this.write();
    await this.saving;
    this.saving = null;
  }

  private async write() {
    this.dirty = false;
    this.saveStatus.set('saving');
    try {
      const result = await this.api.saveProject(this.projectId(), this.name(), this.revision, this.site()!);
      this.revision = result.revision;
      this.saveStatus.set(this.dirty ? 'unsaved' : 'saved');
    } catch (e) {
      this.dirty = true;
      const conflict = e instanceof HttpErrorResponse && e.status === 409;
      this.saveStatus.set(conflict ? 'conflict' : 'error');
      this.notice.set(errorMessage(e));
    }
  }

  get hasUnsavedChanges() {
    return this.dirty;
  }

  async exportZip() {
    await this.save();
    const blob = await this.api.exportProject(this.projectId(), exportFiles(this.site()!));
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${slugify(this.name()) || 'site'}.zip`;
    link.click();
    URL.revokeObjectURL(url);
  }
}
