import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, type Firestore } from 'firebase/firestore';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createEmptyDraft } from '../packages/shared/src/editorial/draft';
import {
  buildSource,
  createClaim,
  recomputeClaims,
} from '../packages/shared/src/editorial/sources';
import type { News } from '../packages/shared/src/types';
import { loadNews, SaveBlockedError, saveNewsFields } from '../apps/admin/src/lib/newsStore';

let testEnv: RulesTestEnvironment;
let db: Firestore;

const NOW = new Date('2026-10-02T15:00:00.000Z');

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'ai-news-app-f24cf',
    firestore: { rules: readFileSync('../firestore.rules', 'utf8') },
  });
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore() as unknown as Firestore, 'admins', 'admin-a'), {});
  });
  db = testEnv.authenticatedContext('admin-a').firestore() as unknown as Firestore;
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe('F2-02 news editor persistence', () => {
  it('CA1: a draft saved incomplete can be closed and reopened without losing data', async () => {
    const draft = createEmptyDraft('draft-1', 'admin-a', NOW);
    await setDoc(doc(db, 'news', draft.id), draft);

    const edited: News = {
      ...draft,
      title: 'Sismo sacude el occidente',
      lead: 'Entradilla a medio escribir',
      topics: ['clima-desastres'],
      geo: {
        scope: 'local',
        countries: ['GT'],
        cityIds: ['gt-quetzaltenango'],
        regions: ['centroamerica'],
      },
      importance: 3,
    };
    await saveNewsFields(db, edited);

    const reopened = await loadNews(db, 'draft-1');
    expect(reopened).toMatchObject({
      id: 'draft-1',
      title: edited.title,
      lead: edited.lead,
      body: '',
      topics: edited.topics,
      geo: edited.geo,
      importance: 3,
      workflow: 'borrador',
      createdBy: 'admin-a',
    });
    expect((reopened?.updatedAt ?? '') > draft.updatedAt).toBe(true);
  });

  it('CA2: invalid data is not stored as published, and the stored news is untouched', async () => {
    const published: News = {
      ...createEmptyDraft('pub-1', 'admin-a', NOW),
      title: 'Titular válido',
      lead: 'Entradilla válida',
      body: 'Cuerpo válido',
      topics: ['salud'],
      geo: { scope: 'nacional', countries: ['GT'], cityIds: [], regions: ['centroamerica'] },
      workflow: 'publicada',
    };
    await setDoc(doc(db, 'news', published.id), published);

    await expect(
      saveNewsFields(db, { ...published, title: '', topics: [] }),
    ).rejects.toBeInstanceOf(SaveBlockedError);

    const stored = (await getDoc(doc(db, 'news', 'pub-1'))).data();
    expect(stored?.title).toBe('Titular válido');
    expect(stored?.topics).toEqual(['salud']);
  });
});

describe('F2-03 sources and claims persistence', () => {
  const confirming = buildSource({
    id: 's-yes',
    name: 'Prensa Libre',
    organization: 'Grupo Prensa Libre',
    url: 'https://example.org/prensa-libre/nota',
    type: 'medio',
    accessedAt: NOW.toISOString(),
    supports: 'confirma',
    note: '',
  });
  const contradicting = buildSource({ ...confirming, id: 's-no', supports: 'contradice' });

  it('stores sources and claims, with statuses following links and unlinks (CA1)', async () => {
    const draft = createEmptyDraft('draft-2', 'admin-a', NOW);
    await setDoc(doc(db, 'news', draft.id), draft);

    const sources = [confirming, contradicting];
    const claim = createClaim('c1', 'La cifra es 12', ['s-yes'], sources);
    await saveNewsFields(db, { ...draft, sources, claims: [claim] });
    expect((await loadNews(db, 'draft-2'))?.claims[0]?.status).toBe('respaldada');

    const disputed = recomputeClaims([{ ...claim, sourceIds: ['s-yes', 's-no'] }], sources);
    await saveNewsFields(db, { ...draft, sources, claims: disputed });
    expect((await loadNews(db, 'draft-2'))?.claims[0]?.status).toBe('en_disputa');

    const unlinked = recomputeClaims([{ ...claim, sourceIds: [] }], sources);
    await saveNewsFields(db, { ...draft, sources, claims: unlinked });
    const stored = await loadNews(db, 'draft-2');
    expect(stored?.claims[0]).toMatchObject({ sourceIds: [], status: 'sin_respaldo' });
    expect(stored?.sources).toHaveLength(2);
    expect(stored?.sources[0] && 'note' in stored.sources[0]).toBe(false);
  });

  it('does not store an invalid source URL, even in a draft (CA2)', async () => {
    const draft = createEmptyDraft('draft-3', 'admin-a', NOW);
    await setDoc(doc(db, 'news', draft.id), draft);

    const broken = { ...confirming, url: 'prensalibre.com/nota' };
    await expect(saveNewsFields(db, { ...draft, sources: [broken] })).rejects.toBeInstanceOf(
      SaveBlockedError,
    );
    expect((await loadNews(db, 'draft-3'))?.sources).toEqual([]);
  });
});
