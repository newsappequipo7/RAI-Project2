import { expect, test, type Page } from '@playwright/test';
import { createAdmin, listDocs, readDoc, type TestAdmin } from './emulators';

const WORKER = 'http://127.0.0.1:8787';

let admin: TestAdmin;
const workerCalls: { path: string; body: unknown }[] = [];

test.beforeAll(async () => {
  admin = await createAdmin(String(Date.now()));
});

/** The Worker is replaced by a stub: AI stays mock and no real service or credit is touched. */
async function stubWorker(page: Page) {
  await page.route(`${WORKER}/**`, async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === 'OPTIONS') {
      return route.fulfill({
        status: 204,
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-headers': '*',
          'access-control-allow-methods': '*',
        },
      });
    }

    workerCalls.push({
      path,
      body: request.postData() ? JSON.parse(request.postData() as string) : null,
    });
    const json =
      path === '/health'
        ? {
            ok: true,
            indexVersion: 1,
            flags: { killSwitch: false, imageGenEnabled: false, chatMode: 'full' },
            env: 'dev',
            aiMode: 'mock',
          }
        : path === '/admin/index/upsert'
          ? { indexVersion: 2, upserted: 1, invalidatedDigests: [] }
          : { error: { code: 'not_found', message: `unexpected ${path}` } };
    return route.fulfill({
      status: path === '/health' || path === '/admin/index/upsert' ? 200 : 404,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify(json),
    });
  });
}

async function login(page: Page) {
  await page.goto('/');
  await page.getByLabel('Correo').fill(admin.email);
  await page.getByLabel('Contraseña').fill(admin.password);
  await page.getByRole('button', { name: 'Entrar con el emulador' }).click();
  await expect(page.getByRole('heading', { name: 'Noticias', exact: true })).toBeVisible();
}

test('an editor creates a news, adds sources, completes the checklist and publishes it', async ({
  page,
}) => {
  await stubWorker(page);
  await login(page);

  // Create a draft and open the editor.
  await page.getByRole('button', { name: 'Nueva noticia' }).click();
  await expect(page).toHaveURL(/\/news\/[A-Za-z0-9]+$/);
  const id = new URL(page.url()).pathname.split('/').pop() as string;

  const publish = page.getByRole('button', { name: 'Publicar' });
  await expect(publish).toBeDisabled(); // an empty draft can never be published

  // Content and classification.
  await page
    .getByLabel('Título', { exact: true })
    .fill('Alerta sanitaria por aumento de casos de dengue');
  await page
    .getByLabel('Entradilla')
    .fill('El Ministerio de Salud reporta un aumento de casos y pide acudir al centro de salud.');
  await page
    .getByLabel('Cuerpo (markdown simple)')
    .fill(
      'El Ministerio de Salud informó que los casos de dengue aumentaron esta semana.\n\nSe recomienda eliminar criaderos de zancudos.',
    );
  await page.getByLabel('Salud', { exact: true }).check();
  await page.getByLabel('Guatemala', { exact: true }).check();
  await page.getByLabel('centroamerica', { exact: true }).check();
  await page.getByRole('radio', { name: /2 · Importante/ }).check();
  await expect(page.getByText('Guardado')).toBeVisible(); // autosave after 2 s

  // Sources: an invalid URL is rejected, a valid one is stored.
  const sourceForm = page.locator('#section-sources form');
  await sourceForm.getByLabel('Nombre', { exact: true }).fill('Ministerio de Salud');
  await sourceForm.getByLabel('Organización').fill('Ministerio de Salud');
  await sourceForm.getByLabel('URL', { exact: true }).fill('no-es-una-url');
  await sourceForm.getByRole('button', { name: 'Agregar fuente' }).click();
  await expect(page.getByText('La URL debe ser un enlace http(s) completo')).toBeVisible();
  await sourceForm.getByLabel('URL', { exact: true }).fill('https://example.org/salud/dengue');
  await sourceForm.locator('select').first().selectOption('primaria') // «Tipo»;
  await sourceForm.getByRole('button', { name: 'Agregar fuente' }).click();
  await expect(page.getByText('1 organización distinta confirma')).toBeVisible();

  // A claim linked to the source becomes «Respaldada».
  await page
    .getByLabel('Texto', { exact: true })
    .fill('Los casos de dengue aumentaron esta semana.');
  await page
    .locator('#section-claims form')
    .getByLabel(/Ministerio de Salud/)
    .check();
  await page.getByRole('button', { name: 'Agregar afirmación' }).click();
  await expect(
    page.locator('#section-claims').getByText('Respaldada', { exact: true }),
  ).toBeVisible();

  // Image: the generated cover.
  await page.getByRole('tab', { name: 'Portada generada' }).click();
  await page.getByRole('button', { name: 'Usar portada generada' }).click();
  await expect(page.getByText('Portada generada · no es foto').first()).toBeVisible();

  // Certainty: one source only allows «en desarrollo», and it needs a note.
  await page.getByRole('radio', { name: /En desarrollo/ }).check();
  await expect(page.getByRole('button', { name: 'Ir al campo' }).first()).toBeVisible();
  await expect(publish).toBeDisabled();
  await page
    .getByLabel('Nota: qué falta confirmar')
    .fill('Falta una segunda fuente que confirme la cifra.');

  // The checklist must be complete.
  await expect(publish).toBeDisabled();
  for (const item of await page.locator('#section-checklist input[type=checkbox]').all())
    await item.check();
  await expect(page.getByText(/Lista para publicar como «En desarrollo»/)).toBeVisible();
  await expect(publish).toBeEnabled();

  // Publish: confirm, then the news is stored as published and sent to the index.
  page.once('dialog', (dialog) => dialog.accept());
  await publish.click();
  await expect(page.getByText(/Publicada \(versión 1\) y añadida al índice/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Ver en el comparador' })).toBeVisible();

  const stored = await readDoc(`news/${id}`);
  expect(stored).toMatchObject({
    workflow: 'publicada',
    certainty: 'en_desarrollo',
    version: 1,
    publishedBy: admin.uid,
    title: 'Alerta sanitaria por aumento de casos de dengue',
  });
  expect(stored?.indexPending).toBeUndefined(); // cleared once the Worker confirmed
  expect(await listDocs(`news/${id}/versions`)).toEqual(['1']);

  // The stubbed Worker received exactly one upsert for this news; no AI endpoint was touched.
  const upserts = workerCalls.filter((call) => call.path === '/admin/index/upsert');
  expect(upserts).toHaveLength(1);
  expect(JSON.stringify(upserts[0]?.body)).toContain(id);
  expect(workerCalls.some((call) => call.path === '/admin/enrich')).toBe(false);

  // It shows up in the list as published.
  await page.getByRole('link', { name: '← Noticias' }).click();
  await expect(
    page.getByRole('row', { name: /Alerta sanitaria por aumento de casos de dengue.*publicada/ }),
  ).toBeVisible();
});
