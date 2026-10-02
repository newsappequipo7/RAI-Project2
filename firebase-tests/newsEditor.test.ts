import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, type Firestore } from 'firebase/firestore';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createEmptyDraft } from '../packages/shared/src/editorial/draft';
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
      geo: { scope: 'local', countries: ['GT'], cityIds: ['gt-quetzaltenango'], regions: ['centroamerica'] },
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

    await expect(saveNewsFields(db, { ...published, title: '', topics: [] })).rejects.toBeInstanceOf(
      SaveBlockedError,
    );

    const stored = (await getDoc(doc(db, 'news', 'pub-1'))).data();
    expect(stored?.title).toBe('Titular válido');
    expect(stored?.topics).toEqual(['salud']);
  });
});
