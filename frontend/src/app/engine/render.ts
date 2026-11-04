import { esc, pageHref, RenderContext, renderBlocks } from './blocks';
import { Page, Site } from './model';
import { themeCss } from './themes';

/** Small runtime shipped with every export: hash router and mobile menu. */
const SITE_JS = `(function () {
  var pages = [].slice.call(document.querySelectorAll('[data-ssm-page]'));

  function show(slug) {
    var target = pages.filter(function (p) { return p.getAttribute('data-ssm-page') === slug; })[0];
    if (!target) {
      var anchor = slug && document.getElementById(slug);
      if (anchor) { anchor.scrollIntoView({ behavior: 'smooth' }); return; }
      if (slug) return;
      target = pages[0];
    }
    pages.forEach(function (p) { p.hidden = p !== target; });
    document.title = target.getAttribute('data-ssm-title');
    window.scrollTo(0, 0);
  }

  if (pages.length) {
    var start = location.hash.slice(1);
    if (start) show(start);
    window.addEventListener('hashchange', function () { show(location.hash.slice(1)); });
    document.addEventListener('click', function (event) {
      var link = event.target.closest && event.target.closest('a[href^="#"]');
      if (!link) return;
      var slug = link.getAttribute('href').slice(1);
      event.preventDefault();
      try { history.pushState(null, '', '#' + slug); } catch (e) { /* preview iframe */ }
      show(slug);
    });
  }

  document.addEventListener('click', function (event) {
    var toggle = event.target.closest && event.target.closest('[data-ssm-nav-toggle]');
    if (toggle) toggle.closest('.ssm-navbar').classList.toggle('is-open');
  });
})();
`;

const README = (title: string) => `${title}
Exported from Static Site Maker.

To publish: unzip this archive, connect to your web host with an FTP client
such as FileZilla, and upload everything to the public web folder (often
public_html or www). The site's entry page is index.html.
`;

function pageTitle(site: Site, page: Page, index: number): string {
  return index === 0 ? site.settings.title || page.title : `${page.title} – ${site.settings.title}`;
}

function documentHtml(site: Site, opts: { title: string; description: string; head: string; body: string }): string {
  const { lang, favicon } = site.settings;
  return `<!doctype html>
<html lang="${esc(lang || 'en')}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(opts.title)}</title>
${opts.description ? `<meta name="description" content="${esc(opts.description)}">\n` : ''}${favicon ? `<link rel="icon" href="${esc(favicon)}">\n` : ''}${opts.head}
</head>
<body>
${opts.body}
</body>
</html>
`;
}

function spaBody(site: Site, startSlug: string): string {
  const ctx: RenderContext = { site, editing: false, spa: true };
  return site.pages.map((page, i) => {
    const hidden = page.slug === startSlug ? '' : ' hidden';
    return `<div data-ssm-page="${esc(page.slug)}" data-ssm-title="${esc(pageTitle(site, page, i))}"${hidden}>\n${renderBlocks(page.blocks, ctx)}\n</div>`;
  }).join('\n');
}

/** Files for the ZIP. All paths are flat, so assets/… resolves the same everywhere. */
export function exportFiles(site: Site): Record<string, string> {
  const files: Record<string, string> = {
    'styles.css': themeCss(site.theme),
    'site.js': SITE_JS,
    'readme.txt': README(site.settings.title),
  };
  const head = '<link rel="stylesheet" href="styles.css">';
  const script = '<script src="site.js" defer></script>';

  if (site.settings.mode === 'spa') {
    files['index.html'] = documentHtml(site, {
      title: pageTitle(site, site.pages[0], 0),
      description: site.settings.description,
      head,
      body: `${spaBody(site, site.pages[0].slug)}\n${script}`,
    });
    return files;
  }

  const ctx: RenderContext = { site, editing: false, spa: false };
  site.pages.forEach((page, i) => {
    files[pageHref(page.slug, ctx)] = documentHtml(site, {
      title: pageTitle(site, page, i),
      description: page.description || site.settings.description,
      head,
      body: `${renderBlocks(page.blocks, ctx)}\n${script}`,
    });
  });
  return files;
}

/** Self-contained document for the Preview iframe. */
export function previewDocument(site: Site, baseUrl: string, startSlug: string): string {
  return documentHtml(site, {
    title: site.settings.title,
    description: '',
    head: `<base href="${esc(baseUrl)}">\n<style>${themeCss(site.theme)}</style>`,
    body: `${spaBody(site, startSlug)}\n<script>${SITE_JS}</script>`,
  });
}

/** Empty shell for the canvas iframe; the canvas fills #ssm-root and #ssm-theme. */
export function canvasDocument(baseUrl: string): string {
  return `<!doctype html><html><head><meta charset="utf-8">
<base href="${esc(baseUrl)}"><style id="ssm-theme"></style>
<style>
.ssm-drop-hint { padding: 28px 12px; text-align: center; font: 13px system-ui, sans-serif; color: #71717a;
  border: 1.5px dashed #a1a1aa; border-radius: 6px; }
.ssm-empty-page { display: grid; place-items: center; height: 70vh; font: 15px system-ui, sans-serif; color: #71717a; }
[data-ssm-editing] { visibility: hidden; }
</style></head><body><div id="ssm-root"></div></body></html>`;
}

export function canvasHtml(site: Site, page: Page): string {
  if (!page.blocks.length) return '<div class="ssm-empty-page">Drag a component here to start this page</div>';
  return renderBlocks(page.blocks, { site, editing: true, spa: true });
}
