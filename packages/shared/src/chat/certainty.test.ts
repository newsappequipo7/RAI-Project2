import { describe, expect, it } from 'vitest';
import { blockCertainty, lowestCertainty } from './certainty';

describe('blockCertainty', () => {
  it('inherits a single certainty', () => {
    expect(blockCertainty(['en_desarrollo', 'en_desarrollo'])).toBe('en_desarrollo');
  });

  it('is mixta when the cited news disagree', () => {
    expect(blockCertainty(['confirmada', 'disputada'])).toBe('mixta');
  });

  it('is undefined without citations', () => {
    expect(blockCertainty([])).toBeUndefined();
  });
});

describe('lowestCertainty', () => {
  it('returns the least certain', () => {
    expect(lowestCertainty(['confirmada', 'disputada', 'en_desarrollo'])).toBe('disputada');
    expect(lowestCertainty(['confirmada', 'en_desarrollo'])).toBe('en_desarrollo');
    expect(lowestCertainty([])).toBeUndefined();
  });
});
