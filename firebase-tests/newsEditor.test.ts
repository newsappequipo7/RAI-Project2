import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, type Firestore } from 'firebase/firestore';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createEmptyDraft } from '../packages/shared/src/editorial/draft';
import { buildCoverImage, buildFreeLicenseImage } from '../packages/shared/src/editorial/images';
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
