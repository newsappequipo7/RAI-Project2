import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, type Firestore } from 'firebase/firestore';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createEmptyDraft } from '../packages/shared/src/editorial/draft';
import { buildCoverImage, buildFreeLicenseImage } from '../packages/shared/src/editorial/images';
import { RevisionError } from '../packages/shared/src/editorial/revision';
import { listVersions, retractNews, saveRevision } from '../apps/admin/src/lib/revisionFlow';
import {
  buildSource,
  createClaim,
  recomputeClaims,
} from '../packages/shared/src/editorial/sources';
import type { News } from '../packages/shared/src/types';
import { loadNews, SaveBlockedError, saveNewsFields } from '../apps/admin/src/lib/newsStore';
import {
  clearIndexPending,
  indexNews,
  NotPublishableError,
  PublishBlockedError,
  publishNews,
  rebuildIndex,
} from '../apps/admin/src/lib/publishFlow';

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

describe('F2-05 certainty, note and checklist persistence', () => {
  it('stores them, and removes the note instead of writing undefined when it is emptied', async () => {
    const draft = createEmptyDraft('draft-4', 'admin-a', NOW);
    await setDoc(doc(db, 'news', draft.id), draft);

    const checklist = { ...draft.checklist, fuentes_revisadas: true, imagen_etiquetada: true };
    await saveNewsFields(db, {
      ...draft,
      certainty: 'disputada',
      certaintyNote: 'El ministerio y el medio dan cifras distintas.',
      checklist,
    });

    const stored = await loadNews(db, 'draft-4');
    expect(stored).toMatchObject({
      certainty: 'disputada',
      certaintyNote: 'El ministerio y el medio dan cifras distintas.',
      checklist,
    });

    await saveNewsFields(db, {
      ...draft,
      certainty: 'confirmada',
      certaintyNote: undefined,
      checklist,
    });
    const cleared = await loadNews(db, 'draft-4');
    expect(cleared?.certainty).toBe('confirmada');
    expect(cleared && 'certaintyNote' in cleared).toBe(false);
  });
});

const publishable = (id: string): News => ({
  ...createEmptyDraft(id, 'admin-a', NOW),
  title: 'Titular',
  lead: 'Entradilla.',
  body: 'Cuerpo.',
  topics: ['salud'],
  geo: { scope: 'nacional', countries: ['GT'], cityIds: [], regions: ['centroamerica'] },
  certainty: 'en_desarrollo',
  certaintyNote: 'Falta una segunda fuente.',
  sources: [
    {
      id: 's1',
      name: 'Ministerio de Salud',
      organization: 'Ministerio de Salud',
      url: 'https://example.org/salud',
      type: 'primaria',
      accessedAt: NOW.toISOString(),
      supports: 'confirma',
    },
  ],
  claims: [],
  image: {
    kind: 'portada_generada',
    url: '',
    credit: 'Portada generada por la app (no es una fotografía)',
    altText: 'Portada generada para: Titular',
  },
  checklist: {
    fuentes_revisadas: true,
    afirmaciones_con_respaldo: true,
    titulo_no_sensacionalista: true,
    imagen_etiquetada: true,
    alcance_geo_revisado: true,
    certeza_justificada: true,
  },
});

describe('F2-06 publish and index', () => {
  it('CA1: publishes in one transaction with version snapshot and a pending index mark', async () => {
    const news = publishable('pub-a');
    await setDoc(doc(db, 'news', news.id), news);

    const published = await publishNews(db, news.id, 'admin-a', new Date('2026-10-03T10:00:00Z'));
    expect(published).toMatchObject({ workflow: 'publicada', version: 1, indexPending: true });

    const stored = await loadNews(db, news.id);
    expect(stored).toMatchObject({
      workflow: 'publicada',
      version: 1,
      publishedBy: 'admin-a',
      publishedAt: '2026-10-03T10:00:00.000Z',
      indexPending: true,
    });
    const version = await getDoc(doc(db, 'news', news.id, 'versions', '1'));
    expect(version.data()).toMatchObject({ title: 'Titular', version: 1, workflow: 'publicada' });
  });

  it('refuses to publish what validatePublish rejects, leaving no trace', async () => {
    const incomplete = { ...publishable('pub-b'), sources: [] };
    await setDoc(doc(db, 'news', incomplete.id), incomplete);

    await expect(publishNews(db, incomplete.id, 'admin-a')).rejects.toBeInstanceOf(
      PublishBlockedError,
    );
    expect((await loadNews(db, incomplete.id))?.workflow).toBe('borrador');
    expect((await getDoc(doc(db, 'news', incomplete.id, 'versions', '1'))).exists()).toBe(false);
  });

  it('does not publish twice, nor a missing news', async () => {
    await expect(publishNews(db, 'pub-a', 'admin-a')).rejects.toBeInstanceOf(NotPublishableError);
    await expect(publishNews(db, 'does-not-exist', 'admin-a')).rejects.toBeInstanceOf(
      NotPublishableError,
    );
    expect((await loadNews(db, 'pub-a'))?.version).toBe(1);
  });

  it('CA2: with the Worker down the mark stays; the retry clears it', async () => {
    const deps = (upsert: () => Promise<{ indexVersion: number }>) => ({
      upsert,
      remove: () => Promise.reject(new Error('not used for a published news')),
      clearPending: (id: string) => clearIndexPending(db, id),
    });
    const published = (await loadNews(db, 'pub-a')) as News;

    const down = await indexNews(
      published,
      deps(() => Promise.reject(new Error('Worker apagado'))),
    );
    expect(down.status).toBe('pending');
    expect((await loadNews(db, 'pub-a'))?.indexPending).toBe(true);

    const retried = await indexNews(
      published,
      deps(() => Promise.resolve({ indexVersion: 12 })),
    );
    expect(retried).toEqual({ status: 'indexed', indexVersion: 12 });
    const cleared = await loadNews(db, 'pub-a');
    expect(cleared && 'indexPending' in cleared).toBe(false);
  });

  it('rebuilds from every published news and clears the marks it resolved', async () => {
    const second = publishable('pub-c');
    await setDoc(doc(db, 'news', second.id), second);
    await publishNews(db, second.id, 'admin-a');

    const sent: string[][] = [];
    const result = await rebuildIndex(db, {
      rebuild: async (items) => {
        sent.push(items.map((item) => item.id).sort());
        return { indexVersion: 20, upserted: items.length };
      },
    });

    // Every published news is sent (pub-1 comes from the F2-02 tests); drafts such as pub-b are not.
    expect(result).toEqual({ indexVersion: 20, upserted: 3 });
    expect(sent).toEqual([['pub-1', 'pub-a', 'pub-c']]);
    const after = await loadNews(db, 'pub-c');
    expect(after && 'indexPending' in after).toBe(false);
  });
});

describe('F2-07 images', () => {
  const found = {
    thumbUrl: 'https://upload.example.org/t.jpg',
    url: 'https://upload.example.org/volcan.jpg',
    title: 'Volcán de Fuego',
    creator: 'Ana Pérez',
    license: 'CC BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    sourceUrl: 'https://commons.example.org/volcan',
  };

  it('stores the image, and removes the field instead of writing undefined (CA1)', async () => {
    const draft = createEmptyDraft('img-1', 'admin-a', NOW);
    await setDoc(doc(db, 'news', draft.id), draft);

    const image = buildFreeLicenseImage(found, 'Volcán en erupción');
    await saveNewsFields(db, { ...draft, image });
    expect((await loadNews(db, 'img-1'))?.image).toEqual(image);

    await saveNewsFields(db, { ...draft, image: undefined });
    const cleared = await loadNews(db, 'img-1');
    expect(cleared && 'image' in cleared).toBe(false);
  });

  it('CA1: a news without photo publishes with a free-license image and another with a cover', async () => {
    const withLicense = {
      ...publishable('img-free'),
      image: buildFreeLicenseImage(found, 'Volcán'),
    };
    const withCover = { ...publishable('img-cover'), image: buildCoverImage('Titular') };
    await setDoc(doc(db, 'news', withLicense.id), withLicense);
    await setDoc(doc(db, 'news', withCover.id), withCover);

    expect((await publishNews(db, 'img-free', 'admin-a')).image?.kind).toBe('licencia_libre');
    expect((await publishNews(db, 'img-cover', 'admin-a')).image?.kind).toBe('portada_generada');
  });

  it('refuses to publish an image without credit', async () => {
    const noCredit = {
      ...publishable('img-nocredit'),
      image: { ...buildCoverImage('Titular'), credit: '' },
    };
    await setDoc(doc(db, 'news', noCredit.id), noCredit);

    await expect(publishNews(db, 'img-nocredit', 'admin-a')).rejects.toBeInstanceOf(
      PublishBlockedError,
    );
  });
});

describe('F2-08 corrections and retraction', () => {
  const publishAs = async (id: string) => {
    const news = publishable(id);
    await setDoc(doc(db, 'news', id), news);
    return publishNews(db, id, 'admin-a', new Date('2026-10-03T10:00:00Z'));
  };
  const entry = { kind: 'correccion' as const, summary: 'Se corrigió el titular.' };

  it('saves an edit as version 2 with its correction, keeping version 1 (CA2)', async () => {
    const v1 = await publishAs('rev-a');
    const edited = { ...v1, title: 'Titular corregido' };

    const v2 = await saveRevision(
      db,
      'rev-a',
      edited,
      entry,
      'admin-b',
      new Date('2026-10-04T10:00:00Z'),
    );
    expect(v2).toMatchObject({ version: 2, title: 'Titular corregido', indexPending: true });

    const stored = await loadNews(db, 'rev-a');
    expect(stored?.corrections).toEqual([
      {
        at: '2026-10-04T10:00:00.000Z',
        kind: 'correccion',
        summary: entry.summary,
        editorUid: 'admin-b',
      },
    ]);
    expect(stored?.publishedBy).toBe('admin-a');

    const versions = await listVersions(db, 'rev-a');
    expect(versions.map((item) => item.version)).toEqual([2, 1]);
    expect(versions.map((item) => item.title)).toEqual(['Titular corregido', 'Titular']);
  });

  it('rejects a missing summary, no changes and invalid data, leaving no new version', async () => {
    const v1 = await publishAs('rev-b');
    const attempt = (edited: News, summary = entry.summary) =>
      saveRevision(db, 'rev-b', edited, { kind: 'correccion', summary }, 'admin-a');

    await expect(attempt({ ...v1, title: 'Otro' }, '  ')).rejects.toMatchObject({
      code: 'summary_invalid',
    });
    await expect(attempt({ ...v1 })).rejects.toMatchObject({ code: 'no_changes' });
    await expect(attempt({ ...v1, title: '' })).rejects.toBeInstanceOf(PublishBlockedError);

    expect((await loadNews(db, 'rev-b'))?.version).toBe(1);
    expect((await getDoc(doc(db, 'news', 'rev-b', 'versions', '2'))).exists()).toBe(false);
  });

  it('CA1: retracting keeps the news with its correction, and the index entry is removed', async () => {
    const v1 = await publishAs('rev-c');

    const retracted = await retractNews(db, 'rev-c', 'Los datos eran falsos.', 'admin-b');
    expect(retracted).toMatchObject({ certainty: 'retractada', version: 2, title: v1.title });

    const stored = await loadNews(db, 'rev-c');
    expect(stored).toMatchObject({
      workflow: 'publicada',
      certainty: 'retractada',
      title: v1.title,
    });
    expect(stored?.corrections.at(-1)).toMatchObject({
      kind: 'retractacion',
      summary: 'Los datos eran falsos.',
    });
    expect((await listVersions(db, 'rev-c')).map((item) => item.certainty)).toEqual([
      'retractada',
      'en_desarrollo',
    ]);

    const removed: string[] = [];
    const outcome = await indexNews(stored as News, {
      upsert: () => Promise.reject(new Error('must not upsert a retracted news')),
      remove: async (id) => {
        removed.push(id);
        return { indexVersion: 30 };
      },
      clearPending: (id) => clearIndexPending(db, id),
    });
    expect(outcome).toEqual({ status: 'indexed', indexVersion: 30 });
    expect(removed).toEqual(['rev-c']);
    const cleared = await loadNews(db, 'rev-c');
    expect(cleared && 'indexPending' in cleared).toBe(false);
  });

  it('cannot retract twice, edit a retracted news, or retract a draft', async () => {
    await expect(retractNews(db, 'rev-c', 'otra vez', 'admin-a')).rejects.toMatchObject({
      code: 'already_retracted',
    });
    const retracted = (await loadNews(db, 'rev-c')) as News;
    await expect(
      saveRevision(db, 'rev-c', { ...retracted, title: 'Editada' }, entry, 'admin-a'),
    ).rejects.toBeInstanceOf(RevisionError);

    const draft = publishable('rev-draft');
    await setDoc(doc(db, 'news', draft.id), draft);
    await expect(retractNews(db, 'rev-draft', 'x', 'admin-a')).rejects.toMatchObject({
      code: 'not_published',
    });
  });
});

describe('F2-04 AI suggestions persistence', () => {
  const suggestion = {
    topics: [{ key: 'salud', confidence: 0.9 }],
    geo: { scope: 'nacional' as const, countries: ['GT'], cityIds: [], regions: ['centroamerica'] },
    importance: { value: 2 as const, rationale: 'Afecta a muchas personas.' },
    claims: [{ text: 'Hay 12 casos.', needsSource: true }],
    summary: 'Resumen sugerido.',
    sensationalismFlag: { flagged: true, reason: 'El título exagera la cifra.' },
    model: 'claude-haiku-4-5-20251001',
    costUsd: 0.004,
    createdAt: '2026-10-03T12:00:00.000Z',
  };

  it('stores the suggestion and the approved summary, and removes the summary when dropped (CA3)', async () => {
    const draft = createEmptyDraft('ai-1', 'admin-a', NOW);
    await setDoc(doc(db, 'news', draft.id), draft);

    // Asking the model only records the suggestion: no field the editor owns changes.
    await saveNewsFields(db, { ...draft, aiSuggestions: suggestion });
    const asked = await loadNews(db, 'ai-1');
    expect(asked?.aiSuggestions).toEqual(suggestion);
    expect(asked).toMatchObject({ topics: [], importance: 0, claims: [], title: '' });
    expect(asked && 'aiSummary' in asked).toBe(false);

    const approved = {
      text: 'Resumen aprobado.',
      approvedBy: 'admin-a',
      approvedAt: '2026-10-03T12:05:00.000Z',
    };
    await saveNewsFields(db, { ...draft, aiSuggestions: suggestion, aiSummary: approved });
    expect((await loadNews(db, 'ai-1'))?.aiSummary).toEqual(approved);

    await saveNewsFields(db, { ...draft, aiSuggestions: suggestion, aiSummary: undefined });
    const dropped = await loadNews(db, 'ai-1');
    expect(dropped && 'aiSummary' in dropped).toBe(false);
    expect(dropped?.aiSuggestions).toEqual(suggestion);
  });

  it('keeps the suggestion in the published version for the audit trail', async () => {
    const news = { ...publishable('ai-pub'), aiSuggestions: suggestion };
    await setDoc(doc(db, 'news', news.id), news);

    const published = await publishNews(db, news.id, 'admin-a');
    expect(published.aiSuggestions).toEqual(suggestion);
    const version = await getDoc(doc(db, 'news', news.id, 'versions', '1'));
    expect(version.data()?.aiSuggestions).toEqual(suggestion);
  });
});
