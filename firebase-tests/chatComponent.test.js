import { createElement } from '../apps/mobile/node_modules/react/index.js';
import { renderToStaticMarkup } from '../apps/mobile/node_modules/react-dom/server.js';
import { describe, expect, it } from 'vitest';

import { AssistantMessage, FailureRow, Suggestions } from '../apps/mobile/src/chat/ChatViews';
import { feedPalette } from '../apps/mobile/src/theme/feed';

const published = '2026-10-09T12:00:00.000Z';
const answer = {
  mode: 'answer',
  blocks: [
    {
      text: 'Según información aún en desarrollo, cayó un puente.',
      newsIds: ['n-dev'],
      certainty: 'en_desarrollo',
    },
  ],
  sources: [
    {
      newsId: 'n-dev',
      title: 'Cae un puente en la ruta al Pacífico',
      certainty: 'en_desarrollo',
      publishedAt: published,
      outlets: ['AGN', 'Prensa Libre'],
    },
  ],
  notice: 'Hay información en desarrollo o disputada: revisa la certeza de cada noticia.',
  generatedBy: { provider: 'mock', model: 'mock' },
  cached: false,
  costUsd: 0,
};
const abstain = {
  mode: 'abstain',
  blocks: [],
  sources: [],
  notice: 'No encontré noticias publicadas sobre eso. Puedo contarte lo más reciente de tu zona.',
  generatedBy: null,
  cached: false,
  costUsd: 0,
};

function render(response, initiallyExpanded = false) {
  return renderToStaticMarkup(
    createElement(AssistantMessage, {
      response,
      question: '¿Qué pasó con el puente?',
      locationId: 'gt-guatemala',
      palette: feedPalette.light,
      onOpenNews() {},
      initiallyExpanded,
    }),
  );
}

describe('F4-04 chat message component', () => {
  it('shows each block with its certainty chip, tappable source chips, notice and AI footer (CA2)', () => {
    const markup = render(answer);
    expect(markup).toContain('Según información aún en desarrollo, cayó un puente.');
    expect(markup).toContain('En desarrollo');
    expect(markup).toContain('Abrir noticia: Cae un puente en la ruta al Pacífico');
    expect(markup).toContain('AGN · Prensa Libre');
    expect(markup).toContain('Hay información en desarrollo o disputada');
    expect(markup).toContain('Respuesta generada con IA a partir de 1 noticia publicada · mock');
    expect(markup).toContain('¿Cómo se generó?');
  });

  it('says explicitly that an abstention used no AI and found no news (CA2)', () => {
    const markup = render(abstain);
    expect(markup).toContain('No encontré noticias publicadas sobre eso');
    expect(markup).toContain('Sin IA: no se encontraron noticias publicadas que respondan esto');
  });

  it('expands "¿Cómo se generó?" with intent, news used, origin and cost', () => {
    const markup = render(answer, true);
    for (const text of [
      'Intención detectada',
      'Novedades sobre un tema',
      'Noticias usadas (1)',
      'Cae un puente en la ruta al Pacífico',
      'Generada ahora con mock',
      'USD 0',
    ]) {
      expect(markup).toContain(text);
    }
  });
});

describe('F4-04 chat states', () => {
  const failure = (kind) =>
    renderToStaticMarkup(
      createElement(FailureRow, {
        failure: kind,
        question: '¿Qué pasa?',
        palette: feedPalette.dark,
        onRetry() {},
      }),
    );

  it('offers a retry on network errors only', () => {
    expect(failure('network')).toContain('Reintentar');
    expect(failure('network')).toContain('No hay conexión');
    expect(failure('rate_limited')).toContain('límite de 20 mensajes por hora');
    expect(failure('rate_limited')).not.toContain('Reintentar');
  });

  it('renders the four suggestions as buttons', () => {
    const markup = renderToStaticMarkup(
      createElement(Suggestions, {
        suggestions: ['a', 'b', 'c', 'd'],
        palette: feedPalette.light,
        onPick() {},
      }),
    );
    expect(markup.match(/role="button"/g)).toHaveLength(4);
  });
});
