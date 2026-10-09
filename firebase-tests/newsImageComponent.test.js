import { createElement } from '../apps/mobile/node_modules/react/index.js';
import { renderToStaticMarkup } from '../apps/mobile/node_modules/react-dom/server.js';
import { describe, expect, it } from 'vitest';

import { NewsImage } from '../apps/mobile/src/feed/NewsImage';
import { feedPalette } from '../apps/mobile/src/theme/feed';
import { buildSeedNews } from '../packages/shared/src/seed';
import corpus from '../packages/shared/fixtures/news.json';

const stories = buildSeedNews(corpus, new Date('2026-10-09T12:00:00Z'));
const cover = stories.find((story) => story.image.kind === 'portada_generada');
const archive = stories.find((story) => story.image.kind === 'licencia_libre');

function render(news, variant = 'wide') {
  return renderToStaticMarkup(
    createElement(NewsImage, { news, palette: feedPalette.light, variant }),
  );
}

describe('F3-05 NewsImage component', () => {
  it('renders the mandatory caption for both image kinds present in the seed corpus', () => {
    for (const story of stories) {
      const markup = render(story);
      if (story.image.kind === 'portada_generada') {
        expect(markup).toContain('Portada generada · no es foto');
      } else {
        expect(story.image.kind).toBe('licencia_libre');
        expect(markup).toContain('Imagen de archivo, no corresponde al hecho');
        expect(markup).toContain(story.image.credit);
      }
    }
  });

  it('always supplies a caption when an image is displayed, including missing image data', () => {
    const real = {
      ...cover,
      image: {
        kind: 'foto_real',
        url: 'https://example.com/photo.jpg',
        credit: 'Ana Pérez',
        license: 'Con permiso',
        sourceUrl: 'https://example.com/source',
        altText: 'Foto del hecho',
      },
    };
    const ai = {
      ...cover,
      image: {
        kind: 'ilustracion_ia',
        url: 'https://example.com/art.jpg',
        credit: 'Generada por IA (mock)',
        altText: 'Dibujo abstracto',
        aiDisclosure: 'Ilustración generada con IA. No documenta el hecho.',
      },
    };
    expect(render(real)).toContain('Foto: Ana Pérez');
    expect(render(ai)).toContain('Ilustración generada con IA. No documenta el hecho.');
    expect(render(ai)).toContain('Ilustración IA');
    expect(render({ ...cover, image: undefined })).toContain('Portada generada · no es foto');
  });

  it('uses the compact provenance icon and tooltip label instead of a visible image', () => {
    const compact = render(archive, 'compact');
    expect(compact).toContain('Información de imagen: Imagen de archivo');
    expect(compact).not.toContain('<img');
  });
});
