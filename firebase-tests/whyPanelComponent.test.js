import { createElement } from '../apps/mobile/node_modules/react/index.js';
import { renderToStaticMarkup } from '../apps/mobile/node_modules/react-dom/server.js';
import { describe, expect, it } from 'vitest';

import { WhyPanelContent } from '../apps/mobile/src/feed/WhyPanel';
import { feedPalette } from '../apps/mobile/src/theme/feed';
import corpus from '../packages/shared/fixtures/news.json';
import { DEFAULT_RANKING_WEIGHTS } from '../packages/shared/src/config/feed';
import { createDefaultProfile } from '../packages/shared/src/profile';
import { rankFeed } from '../packages/shared/src/ranking/rankFeed';
import { buildSeedNews } from '../packages/shared/src/seed';

const now = new Date('2026-10-09T12:00:00Z');
const profile = createDefaultProfile('reader', 'Lector', 'gt-guatemala', now);
const ranking = rankFeed({
  news: buildSeedNews(corpus, now),
  profile,
  locationId: profile.locationId,
  now,
});

function render(item) {
  return renderToStaticMarkup(
    createElement(WhyPanelContent, {
      item,
      weights: DEFAULT_RANKING_WEIGHTS,
      personalization: true,
      palette: feedPalette.light,
      busy: false,
      error: null,
      onClose() {},
      onFeedback() {},
    }),
  );
}

describe('F3-06 explanation sheet component', () => {
  it('shows the item reasons, all four contribution bars and both preference actions', () => {
    const item = ranking.feed[0];
    const markup = render(item);
    expect(markup).toContain('¿Por qué veo esto?');
    for (const reason of item.reasons) expect(markup).toContain(reason.text);
    for (const label of [
      'Importancia editorial',
      'Cercanía a tu ubicación',
      'Afinidad con tus temas',
      'Recencia',
    ]) {
      expect(markup).toContain(label);
    }
    expect(markup).toContain('Más como esto');
    expect(markup).toContain('Menos de esto');
  });

  it('explains that essential news remains visible despite preference changes', () => {
    expect(ranking.mustKnow.length).toBeGreaterThan(0);
    expect(render(ranking.mustKnow[0])).toContain('tus preferencias no la quitan');
  });
});
