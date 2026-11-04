import { Theme, ThemeTokens } from './model';

export const FONT_STACKS: { label: string; value: string }[] = [
  { label: 'System sans', value: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' },
  { label: 'Humanist', value: 'Optima, Candara, "Noto Sans", source-sans-pro, sans-serif' },
  { label: 'Geometric', value: 'Avenir, Montserrat, Corbel, "URW Gothic", sans-serif' },
  { label: 'Serif', value: 'Charter, "Bitstream Charter", "Sitka Text", Cambria, Georgia, serif' },
  { label: 'Classic serif', value: '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif' },
  { label: 'Monospace', value: 'ui-monospace, "Cascadia Code", Menlo, Consolas, monospace' },
];

const [sans, humanist, geometric, serif, classic, mono] = FONT_STACKS.map((f) => f.value);

const base: ThemeTokens = {
  primary: '#4f46e5', onPrimary: '#ffffff', background: '#ffffff', surface: '#f4f4f5',
  text: '#18181b', muted: '#52525b', border: '#e4e4e7',
  fontBody: sans, fontHeading: sans, radius: 8, baseSize: 17, containerWidth: 1080,
};

export const PRESET_THEMES: Theme[] = [
  { name: 'Clean', css: '', tokens: base },
  {
    name: 'Midnight', css: '',
    tokens: { ...base, primary: '#818cf8', onPrimary: '#0f172a', background: '#0f172a', surface: '#1e293b',
      text: '#f1f5f9', muted: '#94a3b8', border: '#334155', fontHeading: geometric },
  },
  {
    name: 'Paper', css: '',
    tokens: { ...base, primary: '#b45309', background: '#fdf8ef', surface: '#f5ecdc', text: '#292018',
      muted: '#6b5d4d', border: '#e6d9c3', fontBody: serif, fontHeading: classic, radius: 3, baseSize: 18 },
  },
  {
    name: 'Forest', css: '',
    tokens: { ...base, primary: '#166534', background: '#f7faf5', surface: '#e7efe2', text: '#14281d',
      muted: '#4b6152', border: '#d0dec9', fontBody: humanist, fontHeading: humanist, radius: 14 },
  },
  {
    name: 'Mono', css: 'h1, h2, h3 { letter-spacing: -0.02em; }\n.ssm-button { text-transform: uppercase; letter-spacing: 0.06em; font-size: 0.85em; }',
    tokens: { ...base, primary: '#111111', background: '#ffffff', surface: '#f2f2f2', text: '#111111',
      muted: '#555555', border: '#111111', fontBody: mono, fontHeading: mono, radius: 0, baseSize: 15 },
  },
];

/** Component styles shared by the canvas, the preview and the export. */
const BASE_CSS = `
*, *::before, *::after { box-sizing: border-box; }
body { margin: 0; background: var(--ssm-background); color: var(--ssm-text); font-family: var(--ssm-font-body);
  font-size: var(--ssm-base-size); line-height: 1.6; }
h1, h2, h3, h4 { font-family: var(--ssm-font-heading); line-height: 1.2; margin: 0 0 0.5em; }
h1 { font-size: clamp(2.1rem, 5vw, 3.2rem); } h2 { font-size: clamp(1.6rem, 3.5vw, 2.2rem); }
h3 { font-size: 1.3rem; } h4 { font-size: 1.05rem; }
p { margin: 0 0 1em; } img, video, iframe { max-width: 100%; }
a { color: var(--ssm-primary); }
[hidden] { display: none !important; }
.ssm-section { padding: 56px 20px; background-size: cover; background-position: center; }
.ssm-container { max-width: var(--ssm-container); margin: 0 auto; }
.ssm-columns { display: grid; grid-template-columns: repeat(var(--ssm-cols, 2), minmax(0, 1fr)); gap: var(--ssm-gap, 24px); }
.ssm-column { min-width: 0; }
.ssm-text > :last-child { margin-bottom: 0; }
.ssm-button { display: inline-block; padding: 0.65em 1.3em; border: 2px solid var(--ssm-primary); border-radius: var(--ssm-radius);
  background: var(--ssm-primary); color: var(--ssm-on-primary); font-weight: 600; text-decoration: none; cursor: pointer; font: inherit; }
.ssm-button-wrap { margin: 0.5em 0; }
.ssm-button.is-outline { background: transparent; color: var(--ssm-primary); }
.ssm-image { margin: 0; } .ssm-image img { display: block; width: 100%; height: auto; border-radius: var(--ssm-radius); }
.ssm-image figcaption { margin-top: 0.5em; font-size: 0.85em; color: var(--ssm-muted); }
.ssm-placeholder { display: grid; place-items: center; min-height: 160px; background: var(--ssm-surface); color: var(--ssm-muted);
  border-radius: var(--ssm-radius); font-size: 0.9em; }
.ssm-gallery { display: grid; grid-template-columns: repeat(var(--ssm-cols, 3), minmax(0, 1fr)); gap: 12px; }
.ssm-gallery img { display: block; width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: var(--ssm-radius); }
.ssm-video { position: relative; aspect-ratio: 16 / 9; }
.ssm-video iframe, .ssm-video video { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; border-radius: var(--ssm-radius); }
.ssm-divider { border: 0; border-top: 1px solid var(--ssm-border); margin: 1.5em 0; }
.ssm-card { background: var(--ssm-surface); border-radius: var(--ssm-radius); overflow: hidden; height: 100%; }
.ssm-card img { display: block; width: 100%; aspect-ratio: 16 / 10; object-fit: cover; }
.ssm-card-body { padding: 20px; }
.ssm-features { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 28px; }
.ssm-feature p { color: var(--ssm-muted); margin: 0; }
.ssm-accordion details { border-bottom: 1px solid var(--ssm-border); padding: 0.8em 0; }
.ssm-accordion summary { cursor: pointer; font-weight: 600; }
.ssm-accordion details > div { padding-top: 0.5em; color: var(--ssm-muted); }
.ssm-navbar { background: var(--ssm-background); border-bottom: 1px solid var(--ssm-border); padding: 14px 20px; }
.ssm-navbar.is-sticky { position: sticky; top: 0; z-index: 20; }
.ssm-navbar-inner { max-width: var(--ssm-container); margin: 0 auto; display: flex; align-items: center; justify-content: space-between; gap: 20px; flex-wrap: wrap; }
.ssm-brand { display: inline-flex; align-items: center; gap: 10px; font-family: var(--ssm-font-heading); font-weight: 700; color: var(--ssm-text); text-decoration: none; }
.ssm-brand img { height: 30px; width: auto; }
.ssm-nav-links { display: flex; gap: 20px; flex-wrap: wrap; }
.ssm-nav-links a { color: var(--ssm-text); text-decoration: none; }
.ssm-nav-links a:hover { color: var(--ssm-primary); }
.ssm-nav-toggle { display: none; background: none; border: 1px solid var(--ssm-border); border-radius: var(--ssm-radius);
  color: var(--ssm-text); padding: 4px 10px; font: inherit; cursor: pointer; }
.ssm-hero { position: relative; padding: 96px 20px; background-size: cover; background-position: center; text-align: center; }
.ssm-hero.has-image { color: #fff; }
.ssm-hero.has-image::before { content: ""; position: absolute; inset: 0; background: rgb(0 0 0 / var(--ssm-overlay, 0.45)); }
.ssm-hero-inner { position: relative; max-width: 760px; margin: 0 auto; }
.ssm-hero.is-left { text-align: left; } .ssm-hero.is-left .ssm-hero-inner { margin: 0 auto 0 0; }
.ssm-eyebrow { font-size: 0.85em; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ssm-primary); margin-bottom: 0.6em; }
.ssm-hero.has-image .ssm-eyebrow { color: inherit; }
.ssm-lead { font-size: 1.2em; opacity: 0.85; }
.ssm-actions { display: flex; flex-wrap: wrap; gap: 12px; justify-content: center; margin-top: 1.5em; }
.ssm-hero.is-left .ssm-actions { justify-content: flex-start; }
.ssm-footer { padding: 32px 20px; border-top: 1px solid var(--ssm-border); color: var(--ssm-muted); font-size: 0.9em; text-align: center; }
.ssm-form { display: grid; gap: 14px; max-width: 520px; }
.ssm-form label { display: grid; gap: 4px; font-weight: 600; font-size: 0.9em; }
.ssm-form input, .ssm-form textarea { font: inherit; padding: 0.55em 0.75em; color: var(--ssm-text); background: var(--ssm-background);
  border: 1px solid var(--ssm-border); border-radius: var(--ssm-radius); }
.ssm-form .ssm-button { justify-self: start; }
@media (max-width: 720px) {
  .ssm-columns { grid-template-columns: minmax(0, 1fr); }
  .ssm-gallery { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .ssm-nav-toggle { display: block; }
  .ssm-nav-links { display: none; flex-direction: column; gap: 10px; width: 100%; }
  .ssm-navbar.is-open .ssm-nav-links { display: flex; }
  .ssm-hero { padding: 64px 20px; }
}
`;

function tokenCss(t: ThemeTokens): string {
  return `:root {
  --ssm-primary: ${t.primary};
  --ssm-on-primary: ${t.onPrimary};
  --ssm-background: ${t.background};
  --ssm-surface: ${t.surface};
  --ssm-text: ${t.text};
  --ssm-muted: ${t.muted};
  --ssm-border: ${t.border};
  --ssm-font-body: ${t.fontBody};
  --ssm-font-heading: ${t.fontHeading};
  --ssm-radius: ${t.radius}px;
  --ssm-base-size: ${t.baseSize}px;
  --ssm-container: ${t.containerWidth}px;
}`;
}

/** Full stylesheet. @import rules are only valid at the top, so they are hoisted. */
export function themeCss(theme: Theme): string {
  const imports: string[] = [];
  const custom = theme.css.replace(/^\s*@import[^;]+;\s*$/gm, (rule) => {
    imports.push(rule.trim());
    return '';
  });
  return [...imports, tokenCss(theme.tokens), BASE_CSS.trim(), custom.trim()].filter(Boolean).join('\n\n') + '\n';
}
