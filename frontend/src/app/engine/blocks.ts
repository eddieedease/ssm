import { Block, BlockStyle, Site, uid } from './model';

export interface RenderContext {
  site: Site;
  /** Adds the data attributes the canvas uses to find blocks. */
  editing: boolean;
  /** Single-file output: page links become #hash routes. */
  spa: boolean;
}

export type FieldType = 'text' | 'textarea' | 'code' | 'number' | 'toggle' | 'select' | 'image' | 'link' | 'list';

export interface Field {
  key: string;
  label: string;
  type: FieldType;
  options?: { label: string; value: string | number }[];
  min?: number;
  max?: number;
  hint?: string;
  /** For `list` fields. */
  itemFields?: Field[];
  itemDefault?: Record<string, any>;
}

export interface BlockDefinition {
  type: string;
  label: string;
  icon: string;
  group: 'Layout' | 'Content' | 'Sections';
  /** Other blocks can be dropped inside. */
  container?: boolean;
  /** only: must sit at page level. any: may sit at page level as is. */
  root?: 'only' | 'any';
  /** Managed by its parent; not offered in the palette. */
  internal?: boolean;
  props: () => Record<string, any>;
  style?: () => BlockStyle;
  children?: () => Block[];
  fields: Field[];
  render: (block: Block, ctx: RenderContext, inner: string) => string;
}

export function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function pageHref(slug: string, ctx: RenderContext): string {
  if (ctx.spa) return `#${slug}`;
  const index = ctx.site.pages.findIndex((p) => p.slug === slug);
  return index <= 0 ? 'index.html' : `${slug}.html`;
}

function href(value: string, ctx: RenderContext): string {
  return esc(value.startsWith('page:') ? pageHref(value.slice(5), ctx) : value || '#');
}

function styleCss(s: BlockStyle = {}): string {
  const css: string[] = [];
  const px = (prop: string, value?: number) => {
    if (value !== undefined && value !== null) css.push(`${prop}:${value}px`);
  };
  px('padding-top', s.paddingTop);
  px('padding-bottom', s.paddingBottom);
  if (s.paddingX !== undefined && s.paddingX !== null) css.push(`padding-left:${s.paddingX}px;padding-right:${s.paddingX}px`);
  px('margin-top', s.marginTop);
  px('margin-bottom', s.marginBottom);
  px('border-radius', s.radius);
  if (s.maxWidth) css.push(`max-width:${s.maxWidth}px;margin-left:auto;margin-right:auto`);
  if (s.textAlign) css.push(`text-align:${s.textAlign}`);
  if (s.color) css.push(`color:${s.color}`);
  if (s.background) css.push(`background-color:${s.background}`);
  if (s.backgroundImage) css.push(`background-image:url('${s.backgroundImage.replace(/'/g, '%27')}')`);
  return css.join(';');
}

/** Attributes for a block's root element: class, inline style, anchor, canvas id. */
function root(block: Block, ctx: RenderContext, cls: string, extraCss = ''): string {
  const classes = [cls, block.style?.className].filter(Boolean).join(' ');
  const css = [extraCss, styleCss(block.style)].filter(Boolean).join(';');
  const attrs = classes ? [`class="${esc(classes)}"`] : [];
  if (css) attrs.push(`style="${esc(css)}"`);
  if (block.style?.anchor) attrs.push(`id="${esc(block.style.anchor)}"`);
  if (ctx.editing) attrs.push(`data-ssm-id="${block.id}"`);
  return attrs.join(' ');
}

/** Marks an element as editable in place on the canvas. */
function editable(ctx: RenderContext, path: string, rich = false): string {
  if (!ctx.editing) return '';
  return ` data-ssm-edit="${path}"${rich ? ' data-ssm-rich="1"' : ''}`;
}

function dropZone(inner: string, ctx: RenderContext): string {
  return inner || (ctx.editing ? '<div class="ssm-drop-hint">Drop components here</div>' : '');
}

function placeholder(label: string, ctx: RenderContext): string {
  return ctx.editing ? `<div class="ssm-placeholder">${esc(label)}</div>` : '';
}

function videoEmbed(url: string): string {
  const youtube = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/);
  if (youtube) return `<iframe src="https://www.youtube-nocookie.com/embed/${esc(youtube[1])}" title="Video" allowfullscreen loading="lazy"></iframe>`;
  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  if (vimeo) return `<iframe src="https://player.vimeo.com/video/${esc(vimeo[1])}" title="Video" allowfullscreen loading="lazy"></iframe>`;
  return `<video src="${esc(url)}" controls preload="metadata"></video>`;
}

const LEVELS = [1, 2, 3, 4].map((n) => ({ label: `Heading ${n}`, value: n }));

function column(): Block {
  return { id: uid(), type: 'column', props: {}, children: [] };
}

export const BLOCKS: BlockDefinition[] = [
  // ---- Layout ---------------------------------------------------------------
  {
    type: 'section', label: 'Section', icon: 'section', group: 'Layout', container: true, root: 'only',
    props: () => ({ fullWidth: false }),
    fields: [{ key: 'fullWidth', label: 'Content fills the full width', type: 'toggle' }],
    render: (b, ctx, inner) =>
      `<section ${root(b, ctx, 'ssm-section')}><div class="${b.props['fullWidth'] ? '' : 'ssm-container'}">${dropZone(inner, ctx)}</div></section>`,
  },
  {
    type: 'columns', label: 'Columns', icon: 'columns', group: 'Layout',
    props: () => ({ count: 2, gap: 24 }),
    children: () => [column(), column()],
    fields: [
      { key: 'count', label: 'Columns', type: 'number', min: 1, max: 6, hint: 'They stack on phones.' },
      { key: 'gap', label: 'Gap (px)', type: 'number', min: 0, max: 96 },
    ],
    render: (b, ctx, inner) =>
      `<div ${root(b, ctx, 'ssm-columns', `--ssm-cols:${Number(b.props['count']) || 2};--ssm-gap:${Number(b.props['gap']) || 0}px`)}>${inner}</div>`,
  },
  {
    type: 'column', label: 'Column', icon: 'column', group: 'Layout', container: true, internal: true,
    props: () => ({}),
    fields: [],
    render: (b, ctx, inner) => `<div ${root(b, ctx, 'ssm-column')}>${dropZone(inner, ctx)}</div>`,
  },
  {
    type: 'spacer', label: 'Spacer', icon: 'spacer', group: 'Layout',
    props: () => ({ height: 40 }),
    fields: [{ key: 'height', label: 'Height (px)', type: 'number', min: 0, max: 400 }],
    render: (b, ctx) => `<div ${root(b, ctx, 'ssm-spacer', `height:${Number(b.props['height']) || 0}px`)}></div>`,
  },
  {
    type: 'divider', label: 'Divider', icon: 'divider', group: 'Layout',
    props: () => ({}),
    fields: [],
    render: (b, ctx) => `<hr ${root(b, ctx, 'ssm-divider')}>`,
  },

  // ---- Content --------------------------------------------------------------
  {
    type: 'heading', label: 'Heading', icon: 'heading', group: 'Content',
    props: () => ({ text: 'A clear heading', level: 2 }),
    fields: [
      { key: 'text', label: 'Text', type: 'text' },
      { key: 'level', label: 'Level', type: 'select', options: LEVELS },
    ],
    render: (b, ctx) => {
      const tag = `h${Number(b.props['level']) || 2}`;
      return `<${tag} ${root(b, ctx, 'ssm-heading')}${editable(ctx, 'text')}>${esc(b.props['text'])}</${tag}>`;
    },
  },
  {
    type: 'text', label: 'Text', icon: 'text', group: 'Content',
    props: () => ({ html: '<p>Write something useful here. Double-click to edit this text right on the page.</p>' }),
    fields: [{ key: 'html', label: 'Text (HTML allowed)', type: 'textarea' }],
    render: (b, ctx) => `<div ${root(b, ctx, 'ssm-text')}${editable(ctx, 'html', true)}>${b.props['html'] ?? ''}</div>`,
  },
  {
    type: 'button', label: 'Button', icon: 'button', group: 'Content',
    props: () => ({ label: 'Click me', href: '', outline: false, newTab: false }),
    fields: [
      { key: 'label', label: 'Label', type: 'text' },
      { key: 'href', label: 'Link', type: 'link' },
      { key: 'outline', label: 'Outline style', type: 'toggle' },
      { key: 'newTab', label: 'Open in a new tab', type: 'toggle' },
    ],
    render: (b, ctx) => {
      const target = b.props['newTab'] ? ' target="_blank" rel="noopener"' : '';
      const cls = b.props['outline'] ? 'ssm-button is-outline' : 'ssm-button';
      return `<div ${root(b, ctx, 'ssm-button-wrap')}><a class="${cls}" href="${href(b.props['href'] ?? '', ctx)}"${target}${editable(ctx, 'label')}>${esc(b.props['label'])}</a></div>`;
    },
  },
  {
    type: 'image', label: 'Image', icon: 'image', group: 'Content',
    props: () => ({ src: '', alt: '', caption: '', width: 100 }),
    fields: [
      { key: 'src', label: 'Image', type: 'image' },
      { key: 'alt', label: 'Alt text', type: 'text', hint: 'Describes the image for screen readers.' },
      { key: 'caption', label: 'Caption', type: 'text' },
      { key: 'width', label: 'Width (%)', type: 'number', min: 10, max: 100 },
    ],
    render: (b, ctx) => {
      const src = b.props['src'];
      const body = src
        ? `<img src="${esc(src)}" alt="${esc(b.props['alt'])}" loading="lazy">`
        : placeholder('Choose an image in the panel on the right', ctx);
      const caption = b.props['caption'] ? `<figcaption>${esc(b.props['caption'])}</figcaption>` : '';
      return `<figure ${root(b, ctx, 'ssm-image', `width:${Number(b.props['width']) || 100}%`)}>${body}${caption}</figure>`;
    },
  },
  {
    type: 'gallery', label: 'Gallery', icon: 'gallery', group: 'Content',
    props: () => ({ columns: 3, images: [] }),
    fields: [
      { key: 'columns', label: 'Columns', type: 'number', min: 1, max: 6 },
      {
        key: 'images', label: 'Images', type: 'list', itemDefault: { src: '', alt: '' },
        itemFields: [{ key: 'src', label: 'Image', type: 'image' }, { key: 'alt', label: 'Alt text', type: 'text' }],
      },
    ],
    render: (b, ctx) => {
      const images = (b.props['images'] as any[]).filter((i) => i.src);
      const body = images.map((i) => `<img src="${esc(i.src)}" alt="${esc(i.alt)}" loading="lazy">`).join('');
      if (!body) return `<div ${root(b, ctx, '')}>${placeholder('Add images in the panel on the right', ctx)}</div>`;
      return `<div ${root(b, ctx, 'ssm-gallery', `--ssm-cols:${Number(b.props['columns']) || 3}`)}>${body}</div>`;
    },
  },
  {
    type: 'video', label: 'Video', icon: 'video', group: 'Content',
    props: () => ({ url: '' }),
    fields: [{ key: 'url', label: 'YouTube/Vimeo link or uploaded file', type: 'image' }],
    render: (b, ctx) => b.props['url']
      ? `<div ${root(b, ctx, 'ssm-video')}>${videoEmbed(b.props['url'])}</div>`
      : `<div ${root(b, ctx, '')}>${placeholder('Add a video link in the panel on the right', ctx)}</div>`,
  },
  {
    type: 'card', label: 'Card', icon: 'card', group: 'Content',
    props: () => ({ image: '', title: 'Card title', text: 'A short description of this card.', buttonLabel: '', buttonHref: '' }),
    fields: [
      { key: 'image', label: 'Image', type: 'image' },
      { key: 'title', label: 'Title', type: 'text' },
      { key: 'text', label: 'Text', type: 'textarea' },
      { key: 'buttonLabel', label: 'Button label', type: 'text' },
      { key: 'buttonHref', label: 'Button link', type: 'link' },
    ],
    render: (b, ctx) => {
      const p = b.props;
      const img = p['image'] ? `<img src="${esc(p['image'])}" alt="" loading="lazy">` : '';
      const btn = p['buttonLabel'] ? `<a class="ssm-button" href="${href(p['buttonHref'] ?? '', ctx)}">${esc(p['buttonLabel'])}</a>` : '';
      return `<article ${root(b, ctx, 'ssm-card')}>${img}<div class="ssm-card-body"><h3${editable(ctx, 'title')}>${esc(p['title'])}</h3><p${editable(ctx, 'text')}>${esc(p['text'])}</p>${btn}</div></article>`;
    },
  },
  {
    type: 'accordion', label: 'Accordion', icon: 'accordion', group: 'Content',
    props: () => ({ items: [{ title: 'A common question', body: 'A short, helpful answer.' }, { title: 'Another question', body: 'Another helpful answer.' }] }),
    fields: [{
      key: 'items', label: 'Items', type: 'list', itemDefault: { title: 'New question', body: 'Answer' },
      itemFields: [{ key: 'title', label: 'Title', type: 'text' }, { key: 'body', label: 'Text', type: 'textarea' }],
    }],
    render: (b, ctx) => {
      const items = (b.props['items'] as any[]).map((i) => `<details><summary>${esc(i.title)}</summary><div>${esc(i.body)}</div></details>`);
      return `<div ${root(b, ctx, 'ssm-accordion')}>${items.join('')}</div>`;
    },
  },
  {
    type: 'form', label: 'Contact form', icon: 'form', group: 'Content',
    props: () => ({ action: '', submit: 'Send message' }),
    fields: [
      { key: 'action', label: 'Send to', type: 'text', hint: 'A static site has no server, so use mailto:you@example.com or a form service URL.' },
      { key: 'submit', label: 'Button label', type: 'text' },
    ],
    render: (b, ctx) => {
      const action = esc(b.props['action']);
      const encoding = String(b.props['action']).startsWith('mailto:') ? ' enctype="text/plain"' : '';
      return `<form ${root(b, ctx, 'ssm-form')} action="${action}" method="post"${encoding}>
<label>Name<input name="name" autocomplete="name" required></label>
<label>Email<input name="email" type="email" autocomplete="email" required></label>
<label>Message<textarea name="message" rows="5" required></textarea></label>
<button class="ssm-button" type="submit">${esc(b.props['submit'])}</button></form>`;
    },
  },
  {
    type: 'html', label: 'Custom HTML', icon: 'code', group: 'Content', root: 'any',
    props: () => ({ code: '<div>Your own HTML</div>' }),
    fields: [{ key: 'code', label: 'HTML', type: 'code', hint: 'Scripts run in Preview and in the export, not on the canvas.' }],
    render: (b, ctx) => `<div ${root(b, ctx, 'ssm-html')}>${b.props['code'] ?? ''}</div>`,
  },

  // ---- Sections -------------------------------------------------------------
  {
    type: 'navbar', label: 'Navigation', icon: 'navbar', group: 'Sections', root: 'only',
    props: () => ({ brand: 'My site', logo: '', sticky: true }),
    fields: [
      { key: 'brand', label: 'Name', type: 'text' },
      { key: 'logo', label: 'Logo', type: 'image' },
      { key: 'sticky', label: 'Stick to the top', type: 'toggle' },
    ],
    render: (b, ctx) => {
      const pages = ctx.site.pages;
      const links = pages.length > 1
        ? pages.map((p) => `<a href="${esc(pageHref(p.slug, ctx))}">${esc(p.title)}</a>`).join('')
        : '';
      const logo = b.props['logo'] ? `<img src="${esc(b.props['logo'])}" alt="">` : '';
      const cls = 'ssm-navbar' + (b.props['sticky'] ? ' is-sticky' : '');
      const toggle = links ? '<button class="ssm-nav-toggle" type="button" data-ssm-nav-toggle aria-label="Menu">Menu</button>' : '';
      return `<nav ${root(b, ctx, cls)}><div class="ssm-navbar-inner"><a class="ssm-brand" href="${esc(pageHref(pages[0]?.slug ?? '', ctx))}">${logo}<span${editable(ctx, 'brand')}>${esc(b.props['brand'])}</span></a>${toggle}${links ? `<div class="ssm-nav-links">${links}</div>` : ''}</div></nav>`;
    },
  },
  {
    type: 'hero', label: 'Hero', icon: 'hero', group: 'Sections', root: 'only',
    props: () => ({
      eyebrow: '', title: 'Say what you do in one line', subtitle: 'Add a sentence that explains why it matters.',
      primaryLabel: 'Get started', primaryHref: '', secondaryLabel: '', secondaryHref: '',
      image: '', overlay: 45, align: 'center',
    }),
    fields: [
      { key: 'eyebrow', label: 'Small label', type: 'text' },
      { key: 'title', label: 'Title', type: 'text' },
      { key: 'subtitle', label: 'Subtitle', type: 'textarea' },
      { key: 'primaryLabel', label: 'Button label', type: 'text' },
      { key: 'primaryHref', label: 'Button link', type: 'link' },
      { key: 'secondaryLabel', label: 'Second button label', type: 'text' },
      { key: 'secondaryHref', label: 'Second button link', type: 'link' },
      { key: 'image', label: 'Background image', type: 'image' },
      { key: 'overlay', label: 'Image darkening (%)', type: 'number', min: 0, max: 90 },
      { key: 'align', label: 'Align', type: 'select', options: [{ label: 'Center', value: 'center' }, { label: 'Left', value: 'left' }] },
    ],
    render: (b, ctx) => {
      const p = b.props;
      const cls = ['ssm-hero', p['image'] ? 'has-image' : '', p['align'] === 'left' ? 'is-left' : ''].filter(Boolean).join(' ');
      const bg = p['image'] ? `background-image:url('${String(p['image']).replace(/'/g, '%27')}');--ssm-overlay:${(Number(p['overlay']) || 0) / 100}` : '';
      const eyebrow = p['eyebrow'] ? `<div class="ssm-eyebrow"${editable(ctx, 'eyebrow')}>${esc(p['eyebrow'])}</div>` : '';
      const primary = p['primaryLabel'] ? `<a class="ssm-button" href="${href(p['primaryHref'] ?? '', ctx)}">${esc(p['primaryLabel'])}</a>` : '';
      const secondary = p['secondaryLabel'] ? `<a class="ssm-button is-outline" href="${href(p['secondaryHref'] ?? '', ctx)}">${esc(p['secondaryLabel'])}</a>` : '';
      const actions = primary || secondary ? `<div class="ssm-actions">${primary}${secondary}</div>` : '';
      return `<header ${root(b, ctx, cls, bg)}><div class="ssm-hero-inner">${eyebrow}<h1${editable(ctx, 'title')}>${esc(p['title'])}</h1><p class="ssm-lead"${editable(ctx, 'subtitle')}>${esc(p['subtitle'])}</p>${actions}</div></header>`;
    },
  },
  {
    type: 'features', label: 'Features', icon: 'features', group: 'Sections', root: 'only',
    props: () => ({
      items: [
        { title: 'First benefit', text: 'Explain what this does for your visitor.' },
        { title: 'Second benefit', text: 'Keep it to a sentence or two.' },
        { title: 'Third benefit', text: 'Three points is usually plenty.' },
      ],
    }),
    fields: [{
      key: 'items', label: 'Items', type: 'list', itemDefault: { title: 'New benefit', text: 'Describe it.' },
      itemFields: [{ key: 'title', label: 'Title', type: 'text' }, { key: 'text', label: 'Text', type: 'textarea' }],
    }],
    render: (b, ctx) => {
      const items = (b.props['items'] as any[]).map((item, i) =>
        `<div class="ssm-feature"><h3${editable(ctx, `items.${i}.title`)}>${esc(item.title)}</h3><p${editable(ctx, `items.${i}.text`)}>${esc(item.text)}</p></div>`);
      return `<section ${root(b, ctx, 'ssm-section')}><div class="ssm-container ssm-features">${items.join('')}</div></section>`;
    },
  },
  {
    type: 'footer', label: 'Footer', icon: 'footer', group: 'Sections', root: 'only',
    props: () => ({ text: `© ${new Date().getFullYear()} My site` }),
    fields: [{ key: 'text', label: 'Text', type: 'text' }],
    render: (b, ctx) => `<footer ${root(b, ctx, 'ssm-footer')}><span${editable(ctx, 'text')}>${esc(b.props['text'])}</span></footer>`,
  },
];

const BY_TYPE = new Map(BLOCKS.map((d) => [d.type, d]));

export function definition(type: string): BlockDefinition {
  return BY_TYPE.get(type) ?? BY_TYPE.get('html')!;
}

export function createBlock(type: string, props: Record<string, any> = {}, children?: Block[]): Block {
  const def = definition(type);
  const block: Block = { id: uid(), type, props: { ...def.props(), ...props } };
  if (def.style) block.style = def.style();
  const kids = children ?? def.children?.() ?? (def.container ? [] : undefined);
  if (kids) block.children = kids;
  return block;
}

export function columnBlock(): Block {
  return column();
}

export function renderBlocks(blocks: Block[], ctx: RenderContext): string {
  return blocks.map((block) => {
    const def = definition(block.type);
    return def.render(block, ctx, renderBlocks(block.children ?? [], ctx));
  }).join('\n');
}
