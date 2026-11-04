import { createBlock } from './blocks';
import { Block, Site, uid } from './model';
import { PRESET_THEMES } from './themes';

export interface Template { id: string; name: string; description: string; blocks: (name: string) => Block[]; }

export const TEMPLATES: Template[] = [
  { id: 'blank', name: 'Blank', description: 'An empty page.', blocks: () => [] },
  {
    id: 'landing', name: 'Landing page', description: 'Navigation, hero, features and a contact form.',
    blocks: (name) => [
      createBlock('navbar', { brand: name }),
      createBlock('hero', { title: name, eyebrow: 'Welcome' }),
      createBlock('features'),
      createBlock('section', {}, [createBlock('heading', { text: 'Get in touch' }), createBlock('form')]),
      createBlock('footer', { text: `© ${new Date().getFullYear()} ${name}` }),
    ],
  },
  {
    id: 'personal', name: 'Personal page', description: 'A short introduction beside a photo.',
    blocks: (name) => [
      createBlock('navbar', { brand: name }),
      createBlock('section', {}, [
        createBlock('columns', {}, [
          createBlock('column', {}, [createBlock('image', { alt: `Portrait of ${name}` })]),
          createBlock('column', {}, [
            createBlock('heading', { text: `Hi, I'm ${name}`, level: 1 }),
            createBlock('text'),
            createBlock('button', { label: 'Contact me', href: 'mailto:you@example.com' }),
          ]),
        ]),
      ]),
      createBlock('footer', { text: `© ${new Date().getFullYear()} ${name}` }),
    ],
  },
];

export function newSite(name: string, templateId: string): Site {
  const template = TEMPLATES.find((t) => t.id === templateId) ?? TEMPLATES[0];
  return {
    settings: { title: name, description: '', lang: 'en', favicon: '', mode: 'spa' },
    theme: structuredClone(PRESET_THEMES[0]),
    pages: [{ id: uid(), title: 'Home', slug: 'home', description: '', blocks: template.blocks(name) }],
  };
}
