import type { IndexEntry } from '@repo/shared';
import { describe, expect, it } from 'vitest';
import { CHAT_SYSTEM_PROMPT } from '../ai/prompts/chat.v1';
import { leaksPrompt, parseChatOutput, validateAnswer } from './validate';

function entry(id: string, overrides: Partial<IndexEntry> = {}): IndexEntry {
  return {
    id,
    title: `Titular ${id}`,
    lead: '',
    excerpt: '',
    topics: [],
    geo: { scope: 'nacional', countries: ['GT'], cityIds: [], regions: [] },
    importance: 1,
    certainty: 'confirmada',
    sources: [
      { name: 'Medio A', url: 'https://example.org/a' },
      { name: 'Medio A', url: 'https://example.org/b' },
    ],
    publishedAt: '2026-10-10T00:00:00.000Z',
    embedding: [],
    indexedAt: '2026-10-10T00:00:00.000Z',
    ...overrides,
  };
}

const context = [
  entry('conf'),
  entry('dev', { certainty: 'en_desarrollo' }),
  entry('disp', { certainty: 'disputada' }),
];

const validate = (text: string) => {
  const output = parseChatOutput(text);
  if (!output) throw new Error('unparseable');
  return validateAnswer(output, context);
};

describe('parseChatOutput', () => {
  it('accepts JSON with surrounding prose or a code fence', () => {
    const json = '{"blocks":[{"text":"Hola","newsIds":["conf"]}],"insufficient":false}';
    expect(parseChatOutput(json)).not.toBeNull();
    expect(parseChatOutput(`Aquí va:\n\`\`\`json\n${json}\n\`\`\``)).not.toBeNull();
  });

  it('returns null for broken JSON or the wrong shape', () => {
    expect(parseChatOutput('No encontré nada.')).toBeNull();
    expect(parseChatOutput('{"blocks":[{"text":"Hola",')).toBeNull();
    expect(parseChatOutput('{"answer":"Hola"}')).toBeNull();
    expect(parseChatOutput('{"blocks":"Hola"}')).toBeNull();
  });
});

describe('validateAnswer', () => {
  it('keeps cited blocks and lists only the news actually cited as sources', () => {
    const answer = validate('{"blocks":[{"text":" Hubo un sismo. ","newsIds":["conf"]}]}');

    expect(answer.blocks).toEqual([
      { text: 'Hubo un sismo.', newsIds: ['conf'], certainty: 'confirmada' },
    ]);
    expect(answer.sources).toEqual([
      {
        newsId: 'conf',
        title: 'Titular conf',
        certainty: 'confirmada',
        publishedAt: '2026-10-10T00:00:00.000Z',
        outlets: ['Medio A'],
      },
    ]);
    expect(answer).toMatchObject({ uncertain: false, partial: false, discarded: 0 });
  });

  it('drops a block that cites an invented id, even next to a valid one (F4-02 CA2)', () => {
    const answer = validate(
      '{"blocks":[{"text":"Inventado","newsIds":["conf","n-inventada"]},{"text":"Bien","newsIds":["dev"]}]}',
    );

    expect(answer.blocks.map(({ text }) => text)).toEqual(['Bien']);
    expect(answer.sources.map(({ newsId }) => newsId)).toEqual(['dev']);
    expect(answer.discarded).toBe(1);
  });

  it('never lets an id outside the retrieved context reach the client (F4-02 CA2)', () => {
    const answer = validate(
      JSON.stringify({
        blocks: [
          { text: 'a', newsIds: ['fuera-1'] },
          { text: 'b', newsIds: ['conf', 'fuera-2'] },
          { text: 'c', newsIds: ['disp'] },
          { text: 'd', newsIds: ['CONF'] },
        ],
      }),
    );
    const allowed = new Set(context.map(({ id }) => id));
    const returned = [
      ...answer.blocks.flatMap(({ newsIds }) => newsIds),
      ...answer.sources.map(({ newsId }) => newsId),
    ];

    expect(returned.length).toBeGreaterThan(0);
    expect(returned.every((id) => allowed.has(id))).toBe(true);
  });

  it('drops blocks without ids or without text', () => {
    const answer = validate(
      '{"blocks":[{"text":"Sin respaldo"},{"text":"Vacío","newsIds":[]},{"text":"  ","newsIds":["conf"]}]}',
    );
    expect(answer.blocks).toEqual([]);
    expect(answer.discarded).toBe(3);
  });

  it('marks a block citing news with different certainties as mixta and warns', () => {
    const answer = validate('{"blocks":[{"text":"Dos versiones","newsIds":["conf","disp"]}]}');
    expect(answer.blocks[0]?.certainty).toBe('mixta');
    expect(answer.uncertain).toBe(true);
  });

  it('keeps the database certainty when the model claims a developing story is confirmed', () => {
    const answer = validate(
      '{"blocks":[{"text":"Está confirmado que el puente cayó.","newsIds":["dev"],"certainty":"confirmada"}]}',
    );

    expect(answer.blocks[0]).toEqual({
      text: 'Está confirmado que el puente cayó.',
      newsIds: ['dev'],
      certainty: 'en_desarrollo',
    });
    expect(answer.uncertain).toBe(true);
  });

  it('removes duplicated ids, caps the answer at four blocks and reports partial answers', () => {
    const blocks = Array.from({ length: 6 }, (_, index) => ({
      text: `Bloque ${index}`,
      newsIds: ['conf', 'conf'],
    }));
    const answer = validate(JSON.stringify({ blocks, insufficient: true }));

    expect(answer.blocks).toHaveLength(4);
    expect(answer.blocks[0]?.newsIds).toEqual(['conf']);
    expect(answer.discarded).toBe(2);
    expect(answer.partial).toBe(true);
  });
});

describe('leaksPrompt (F4-07)', () => {
  it('accepts normal answers, including the uncertainty wording the prompt asks for', () => {
    expect(leaksPrompt('Según información aún en desarrollo, hubo un sismo en la costa sur.')).toBe(
      false,
    );
    expect(leaksPrompt('Las fuentes no coinciden sobre la cifra de retornados.')).toBe(false);
  });

  it('catches any eight-word run of the system prompt, even reworded in case or accents', () => {
    const rule = CHAT_SYSTEM_PROMPT.split('\n').find((line) =>
      line.startsWith('- Usa exclusivamente'),
    )!;
    expect(leaksPrompt(`Mis reglas son: ${rule}`)).toBe(true);
    expect(
      leaksPrompt(
        rule
          .toUpperCase()
          .normalize('NFD')
          .replace(/\p{Diacritic}/gu, ''),
      ),
    ).toBe(true);
  });

  it('catches our markup and output field names', () => {
    expect(leaksPrompt('Respondo con <noticias> y <pregunta>.')).toBe(true);
    expect(leaksPrompt('{"blocks":[{"text":"x","newsIds":["a"]}]}')).toBe(true);
  });

  it('drops a leaking block during validation', () => {
    const answer = validate(
      JSON.stringify({
        blocks: [
          { text: 'Mi formato: {"blocks":[], "insufficient": true}', newsIds: ['conf'] },
          { text: 'Hubo un sismo.', newsIds: ['conf'] },
        ],
      }),
    );
    expect(answer.blocks.map(({ text }) => text)).toEqual(['Hubo un sismo.']);
    expect(answer.discarded).toBe(1);
  });
});
