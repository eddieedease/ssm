export interface BlockStyle {
  paddingTop?: number;
  paddingBottom?: number;
  paddingX?: number;
  marginTop?: number;
  marginBottom?: number;
  textAlign?: string;
  color?: string;
  background?: string;
  backgroundImage?: string;
  radius?: number;
  maxWidth?: number;
  className?: string;
  anchor?: string;
}

/** One component on a page. `props` are defined by its registry entry. */
export interface Block {
  id: string;
  type: string;
  props: Record<string, any>;
  style?: BlockStyle;
  children?: Block[];
}

export interface Page {
  id: string;
  title: string;
  slug: string;
  description: string;
  blocks: Block[];
}

export interface ThemeTokens {
  primary: string;
  onPrimary: string;
  background: string;
  surface: string;
  text: string;
  muted: string;
  border: string;
  fontBody: string;
  fontHeading: string;
  radius: number;
  baseSize: number;
  containerWidth: number;
}

export interface Theme {
  name: string;
  tokens: ThemeTokens;
  css: string;
}

export interface SiteSettings {
  title: string;
  description: string;
  lang: string;
  favicon: string;
  /** spa: one index.html with a small hash router. multi: one .html per page. */
  mode: 'spa' | 'multi';
}

export interface Site {
  settings: SiteSettings;
  theme: Theme;
  pages: Page[];
}

export function uid(): string {
  return 'b' + Math.random().toString(36).slice(2, 10);
}

export function slugify(value: string): string {
  return value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
