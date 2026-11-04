import { Component, computed, input } from '@angular/core';

const ICONS: Record<string, string> = {
  section: 'M3 5h18v14H3z',
  columns: 'M3 5h18v14H3zM12 5v14',
  column: 'M8 4h8v16H8z',
  spacer: 'M12 4v16M8 8l4-4 4 4M8 16l4 4 4-4',
  divider: 'M3 12h18',
  heading: 'M6 4v16M18 4v16M6 12h12',
  text: 'M4 6h16M4 12h16M4 18h10',
  button: 'M3 8h18v8H3zM8 12h8',
  image: 'M3 5h18v14H3zM3 16l5-5 4 4 3-3 6 6M15 9h.01',
  gallery: 'M3 3h8v8H3zM13 3h8v8h-8zM3 13h8v8H3zM13 13h8v8h-8z',
  video: 'M3 5h18v14H3zM10 9l5 3-5 3z',
  card: 'M4 4h16v16H4zM4 11h16M8 15h8',
  accordion: 'M3 5h18M3 12h18M3 19h18M17 8l2 2 2-2',
  form: 'M4 5h16v5H4zM4 14h16v5H4z',
  code: 'M8 7l-5 5 5 5M16 7l5 5-5 5',
  navbar: 'M3 5h18v14H3zM3 10h18M7 7.5h3',
  hero: 'M3 4h18v16H3zM7 10h10M9 14h6',
  features: 'M3 6h5v12H3zM9.5 6h5v12h-5zM16 6h5v12h-5z',
  footer: 'M3 5h18v14H3zM3 15h18',
  back: 'M15 5l-7 7 7 7',
  undo: 'M9 7L4 12l5 5M4 12h11a5 5 0 0 1 5 5',
  redo: 'M15 7l5 5-5 5M20 12H9a5 5 0 0 0-5 5',
  desktop: 'M3 5h18v11H3zM8 20h8M12 16v4',
  tablet: 'M6 3h12v18H6zM11 18h2',
  phone: 'M8 3h8v18H8zM11 18h2',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  download: 'M12 4v11M7 11l5 5 5-5M4 20h16',
  plus: 'M12 5v14M5 12h14',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  up: 'M12 19V5M6 11l6-6 6 6',
  down: 'M12 5v14M6 13l6 6 6-6',
  parent: 'M5 20V8h13M13 3l5 5-5 5',
  layers: 'M12 3l9 5-9 5-9-5zM3 13l9 5 9-5',
  pages: 'M6 3h9l4 4v14H6zM15 3v4h4',
  folder: 'M3 6h6l2 2h10v11H3z',
  palette: 'M12 3a9 9 0 1 0 0 18c1.5 0 2-1 2-2s-.5-1.5-.5-2.5S14 15 15 15h2a4 4 0 0 0 4-4c0-4.5-4-8-9-8zM7.5 11h.01M10 7.5h.01M15 7.5h.01',
  settings: 'M4 7h10M18 7h2M4 17h2M10 17h10M16 5v4M8 15v4',
  x: 'M6 6l12 12M18 6L6 18',
  drag: 'M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01',
};

@Component({
  selector: 'ssm-icon',
  template: `
    <svg viewBox="0 0 24 24" [attr.width]="size()" [attr.height]="size()" fill="none" stroke="currentColor"
      stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path [attr.d]="path()" />
    </svg>
  `,
  host: { class: 'inline-flex' },
})
export class Icon {
  readonly name = input.required<string>();
  readonly size = input(18);
  protected readonly path = computed(() => ICONS[this.name()] ?? '');
}
