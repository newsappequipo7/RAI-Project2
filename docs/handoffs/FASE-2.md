# Handoff FASE-2 → FASE-3

Responsable: Daniel Dubón · Fecha de cierre: **pendiente** (se llena al etiquetar) · Tag: `fase-2-done` (**aún no creado**: ver §5, hay tareas con evidencia incompleta)

## 1. Qué quedó funcionando (demostrable)
Un editor puede, desde el portal (`/news`), llevar una noticia de borrador a publicada con las reglas editoriales
aplicadas por código y la IA solo como asistente:
- **Lista y editor** de noticias en tiempo real, con autoguardado de borradores (2 s), validación junto a cada campo y
  vista previa de markdown segura.
- **Fuentes y afirmaciones**: la URL se valida, hay un indicador de cuántas organizaciones distintas confirman, y el estado
  de cada afirmación (`respaldada`, `sin_respaldo`, `en_disputa`) se **calcula** a partir de las fuentes vinculadas.
- **Sugerencias con IA** (`POST /admin/enrich`, prompt `enrich.v2`): temas, alcance, importancia, afirmaciones, resumen y
  alerta de sensacionalismo. Nada se aplica sin un clic; las afirmaciones de la IA entran siempre como «sin respaldo». Al
  final, una tabla «La IA sugirió, se publicó» deja el rastro de qué decidió la persona.
- **Reglas de certeza y checklist** (`validatePublish`): el botón Publicar está bloqueado hasta que se cumpla la tabla de
  `VERIFICACION-Y-FUENTES.md` §2 y el checklist; cada error enlaza al campo.
- **Publicar e indexar**: transacción con versión y snapshot en `versions/{v}`; si el Worker no responde, la noticia queda
  con `indexPending` y hay «Reintentar indexación»; «Reconstruir índice» en `/news`.
- **Imágenes**: subir foto (Cloudinary sin firma o URL), búsqueda con licencia libre (Openverse y Commons, sin `NC`),
  portada tipográfica generada (`packages/shared/src/cover/spec.ts`, para que la app la dibuje igual) y, solo con el flag,
  la pestaña de ilustración IA (sin proveedor todavía, ADR-011).
- **Correcciones y retractación**: editar una publicada exige una entrada de corrección y crea una versión nueva;
  retractar la conserva con su corrección y la saca del índice; pestaña Historial con diff de título, entradilla y certeza.
- **Dashboard de costos** (`/costs`): gasto, saldo, reserva, desvío contra el panel del proveedor, gráficos, costo medio,
  llamadas evitadas, flags con confirmación y registro del saldo real.
- **Pruebas**: unitarias, de emulador y un e2e de navegador (Playwright) contra los emuladores de Auth y Firestore, todo
  en modo mock y sin gastar créditos.
- **Corpus editorial**: 16 borradores de noticias reales (8 ubicaciones) y 2 borradores de demo, con un cargador seguro
  (`pnpm seed:editorial`). **Están sin publicar**: ver `docs/ops/CORPUS-EDITORIAL.md`.

## 2. Cómo correrlo desde cero
Requisitos: los de la Fase 1 (Node 24, pnpm 11.6, Java 21, `firebase-tools`) y, para el e2e, el navegador de Playwright.

```bash
git clone git@github.com:newsappequipo7/RAI-Project2.git && cd RAI-Project2
pnpm install --frozen-lockfile
pnpm lint && pnpm typecheck && pnpm test          # todo en mock; incluye las pruebas contra el emulador
pnpm -F e2e run install:browsers                   # solo la primera vez (descarga Chromium)
pnpm -F e2e run e2e                                # e2e del portal contra los emuladores (levanta los emuladores solo)
pnpm -F admin dev                                  # portal en localhost:5173 (usa el Worker desplegado en mock)
```

Variables de entorno (solo nombres; los valores no se versionan):
| Dónde | Nombre | Para qué |
|-------|--------|----------|
| `apps/admin/.env` | `VITE_CLOUDINARY_CLOUD_NAME`, `VITE_CLOUDINARY_UPLOAD_PRESET` | Subir fotos reales (ADR-010). Ambos son públicos por diseño; salen del panel de Cloudinary (*Cloud name*) y del preset sin firma. Sin ellos la pestaña acepta solo URL |
| `apps/admin/.env` | `VITE_API_URL` | Opcional: apunta a otro Worker (por defecto el desplegado) |
| `apps/admin/.env` | `VITE_FIRESTORE_EMULATOR=true`, `VITE_AUTH_EMULATOR=true` | Solo desarrollo local con emuladores; el e2e los pone solo. Nunca aplican en un build de producción |
| `services/api/.dev.vars` | `ADMIN_UIDS` | Como en la Fase 1 |
| Secret del Worker | `ANTHROPIC_API_KEY` | Solo Diego (regla de oro 9). **Vence el 2026-10-29** |

Preset de Cloudinary (ADR-010): *Signing mode: Unsigned*, *Asset folder: news*, ID público autogenerado e impredecible,
*Overwrite: false*. El campo *Allowed formats* no se encontró en la interfaz al configurarlo (ver §5).

Trabajar con datos locales:
```bash
firebase emulators:start --only auth,firestore
pnpm seed --target=emulator                        # 40 noticias semilla publicadas
pnpm seed:editorial --check                        # valida las 18 del corpus editorial; sin escribir
pnpm seed:editorial --target=emulator              # las carga como BORRADORES (nunca pisa lo ya trabajado)
```

Para **publicar una noticia** (lo que debe poder hacer Nelson solo con este documento): en `/news` → «Nueva noticia» → llenar
Contenido y Clasificación → agregar al menos una fuente que confirme y vincular las afirmaciones → elegir imagen (la pestaña
«Portada generada» es la más rápida) → elegir la certeza (con una sola fuente, solo «En desarrollo» y con nota) → marcar el
checklist → Publicar. Si algo falta, el panel «cosas por resolver» lo dice y cada error enlaza al campo.

Desplegar (desde un `main` **actualizado**; ver LOOP-008):
```bash
git fetch && git checkout main && git pull
pnpm -F admin build && firebase deploy --only hosting
pnpm -F api run deploy                                          # con `run`; deja el Worker en mock
cd services/api && pnpm exec wrangler deploy --var AI_MODE:live # SOLO temporal; volver a desplegar sin --var
```

## 3. Estado de tareas
Detalle y enlaces en `docs/PLAN.md` §6. Las pruebas automáticas cuentan como evidencia; los ◐ indican qué falta.

| ID | Estado | Evidencia | Nota |
|----|--------|-----------|------|
| F2-01 | ☑ | `firebase-tests/newsList.test.ts`, `newsList.test.ts` (admin), e2e | CA1 y CA2 |
| F2-02 | ☑ | `fieldRules.test.ts` (shared), `firebase-tests/newsEditor.test.ts`, e2e | CA1 y CA2 |
| F2-03 | ☑ | `sources.test.ts`, emulador, e2e (URL inválida rechazada, afirmación «Respaldada») | CA1 y CA2 |
| F2-04 | ◐ | PR #9, LOOP-005, `enrich*.test.ts` | CA1–CA4 hechos con créditos reales (Diego). Falta la iteración `enrich.v2` con antes/después y capturas |
| F2-05 | ☑ | `validatePublish.test.ts` (27), e2e (botón bloqueado, «Ir al campo») | CA1 y CA2 |
| F2-06 | ☑ | `publishFlow.test.ts`, emulador (publicar, rechazo, reintento, reconstrucción); recorrido manual con el Worker real: `indexVersion` 6 → 7 (`evidence/captures/F2-06-*`) | CA1 y CA2 |
| F2-07 | ☑ | ADR-010/011, `images.test.ts`, `image.test.ts` (Worker), emulador; recorrido manual: subida real a Cloudinary (HTTP 200), búsqueda real en Openverse/Commons, portada y ausencia de la pestaña IA (`evidence/captures/F2-07-*`) | CA1 y CA2. Falta una captura de la pestaña «Subir foto real» con una imagen neutral (la de prueba era un meme) |
| F2-08 | ☑ | `revision.test.ts`, emulador; recorrido manual con el Worker real: versiones 1, 2 y 3, `indexVersion` 8 → 9 por el `remove` (`evidence/captures/F2-08-*`) | CA1 y CA2 |
| F2-09 | ☑ | `costsView.test.ts`, prueba del Worker contra una lectura independiente del ledger, uso real (saldo registrado, costos leídos en LOOP-005) | CA1 y CA2 |
| F2-10 | ☑ | `e2e/tests/publish-flow.spec.ts` (se rompió el bloqueo del botón a propósito y falló); CI verde en el PR #12 (confirmado por el equipo) | CA1: el CI corre unitarias y e2e en mock, sin créditos |
| F2-11 | ◐ | `corpus.test.ts`, `docs/ops/CORPUS-EDITORIAL.md`, LOOP-006 | 16 borradores + 2 de demo listos y validados (CA2). **Falta que una persona los revise y publique** para llegar a 56 publicadas (CA1 pide ≥ 55) |
| F2-12 | ◐ | este handoff, LOOP-006/007/008 | La vista previa móvil `[PLUS]` no se hizo. Falta el recorrido de Nelson (CA1) y el tag |

## 4. Desviaciones respecto a contratos o docs
Los docs de `docs/architecture/` están actualizados con todo lo de esta lista.
- **Rutas del portal en inglés** (`/news`, `/costs`), como pide el doc de fase; los valores de dominio (`borrador`,
  `en_desarrollo`…) siguen en español porque son el contrato.
- **`GET /health` agrega `aiMode: 'mock' | 'live'`** (`HealthResponse`); cualquier valor distinto de `live` es `mock`.
  Resuelve la deuda de la Fase 1 y alimenta los avisos del portal.
- **`News.indexPending?: boolean`** (tipos, esquema y `MODELO-DATOS.md`): lo escribe la transacción de publicar y lo borra
  la confirmación del Worker.
- **`POST /admin/enrich`**: límites de entrada, prompt versionado, normalización en código y caché con clave por versión de
  prompt, modo (mock/live) y hash de título + entradilla + cuerpo; un acierto queda en el ledger como llamada `cached`
  (`gateway.recordCacheHit`).
- **`POST /admin/image/search`** y **`/admin/image/generate`** documentados; este último pasa por el gateway y, con el flag
  encendido, responde `provider_error` hasta que un ADR adopte un proveedor (ADR-011).
- **ADR-010** (fotos en Cloudinary con preset sin firma) y **ADR-011** (ilustración IA sin proveedor).
- **`EDITABLE_FIELDS`** vive ahora en `packages/shared` (incluye `image`, `aiSuggestions` y `aiSummary`).
- **Una fuente de `redes` sí basta para «en desarrollo»**: el doc solo la excluye para «confirmada».
- El comando de despliegue correcto es `pnpm -F api run deploy` (corregido en `CLAUDE.md`).
- El e2e **no** llama al Worker real: lo reemplaza por un doble, porque el Worker verifica tokens de Google y no los del
  emulador de Auth. Para entrar en desarrollo se añadió un login por correo contra el emulador de Auth.

## 5. Deuda y problemas conocidos
| Severidad | Problema | Sugerencia |
|-----------|----------|------------|
| Alta | Las 16 noticias reales siguen sin publicar (F2-11 CA1: ≥ 55 publicadas) | Que una persona abra cada enlace, marque el checklist y publique desde el portal, con la guía `CORPUS-EDITORIAL.md`. Antes, cargarlas a producción con `pnpm seed:editorial --target=prod` |
| Alta | La key de Anthropic vence el **2026-10-29**, antes de la presentación | Renovarla y volver a subirla con `wrangler secret put` (Diego) |
| Media | `enrich.v2` (definiciones de alcance) no está medido: Haití devolvía `nacional` | Repetir las 5 noticias de LOOP-005 con el Worker en live (≈ USD 0.016) y registrar el antes/después |
| Media | `Allowed formats` del preset de Cloudinary no se encontró en la interfaz: el preset sin firma acepta cualquier formato de imagen | Buscarlo en la pestaña *Advanced*; el portal ya valida JPG/PNG/WebP y 5 MB antes de subir, pero no protege contra uso externo del preset |
| Media | La ilustración IA no tiene proveedor (Anthropic no genera imágenes) | Decidir con un ADR si se quiere; la portada tipográfica cubre el caso |
| Media | Las noticias semilla no tienen versiones guardadas (nacieron fuera del portal): su Historial sale vacío hasta que se les haga una corrección. Además el estado de sus afirmaciones se asignó a mano y no coincide con la regla calculada | No bloquea nada; considerar regenerarlas desde el portal |
| Media | Falta el primer saldo real posterior al gasto (19.98) en `/costs`: la alerta de desvío puede seguir en rojo por el redondeo a centavos de la consola | Registrarlo; con gastos de centavos la comparación válida es por tokens |
| Baja | El e2e cubre un solo recorrido (publicar) y con Worker simulado; correcciones, retractación e imágenes no tienen e2e | Ampliar si hay tiempo |
| Baja | Una prueba de tiempo real del emulador falló dos veces sin causa confirmada | Ver LOOP-007; el mensaje de error ahora diagnostica |
| Baja | Playwright quedó en 1.62.0 porque 1.63.0 salió hace menos de las 24 h que exige la política de pnpm | Subir cuando cumpla |
| Baja | Heredadas de la Fase 1 y no tocadas: `isAdmin()` del emulador da «evaluation error» para no-admin (falla cerrada); `env=demo` es una variable normal | Ver `FASE-1.md` §5 |
| Baja | `[PLUS]` F2-12: la vista previa móvil del editor no se hizo | Solo si sobra tiempo |

## 6. Gasto de IA de la fase
Tope de la fase: USD 3.00. Datos al 2026-10-03; el ledger y el panel se leyeron en `/costs` y en la consola de Anthropic
(no desde esta máquina: la lectura de `/admin/costs` requiere sesión de admin).
- Según el ledger (`/costs`): USD 0.0160 en total, de los cuales `enrich` USD 0.0159 (5 llamadas pagadas y 2
  cacheadas). El resto es la llamada de prueba de la Fase 1.
- Según la consola de Anthropic: 6 810 tokens de entrada y 1 821 de salida, que a USD 1 / 5 por millón dan USD 0.0159;
  saldo USD 19.98. Diferencia con el ledger menor a 1 %. El panel de `/costs` puede marcar la alerta de más de 10 % por el
  redondeo a centavos de la consola con gastos tan pequeños: la comparación válida es por tokens.
- Costo medio por tarea: `enrich` USD 0.003183 por llamada pagada (≈ 20 % menos que el supuesto de USD 0.0040).
  Proyección: 80 noticias ≈ USD 0.25.
- No se gastó nada más en esta fase: desarrollo y pruebas corren en mock. `enrich.v2` no se ha medido con créditos.

## 7. Qué necesita saber la siguiente persona antes de empezar
1. **Qué lee el feed.** Muestra noticias con `workflow = 'publicada'`. Las `retractada` siguen siendo `publicada`, con su
   corrección, pero deben quedar **fuera del feed** y mostrarse con banner rojo y texto tachado. Ignora `indexPending`.
   Las 40 semilla y las 16 del corpus (cuando se publiquen) cumplen todas las reglas; el estado de certeza ya está en el
   documento, no hay que calcularlo.
2. **Qué reutilizar para dibujar.** `packages/shared` ya exporta lo que la app debe pintar igual que el portal:
   `buildCoverSpec` y `wrapCoverTitle` (portada, para F3-05), `imageCaption` (el pie de cada tipo de imagen),
   `CERTAINTY_RULES` (texto de cada banner) y `compareSuggestions`. El resumen con IA (`aiSummary`) solo existe si un
   editor lo aprobó; llévalo con su etiqueta «Resumen generado con IA · revisado por {editor}».
3. **No llames a un modelo al leer y trabaja en mock.** El Worker desplegado está en `mock`; si algo del portal no
   responde como esperas, revisa `GET /health` → `aiMode`. Nunca despliegues desde un `main` local sin hacer `git fetch`.

## 8. Loops registrados en esta fase
- [LOOP-005](../../evidence/loops/LOOP-005-enrich-calidad-y-costo.md): calidad del prompt `enrich.v1` y costo medio
  (USD 0.003183 por llamada, ledger y Console coinciden a menos de 1 %; importancia y alcance de Haití por afinar).
- [LOOP-006](../../evidence/loops/LOOP-006-verificar-fuentes-antes-de-redactar.md): una búsqueda web no basta; la lectura de
  las fuentes originales contradijo a los resúmenes en cuatro casos (F2-11).
- [LOOP-007](../../evidence/loops/LOOP-007-prueba-de-tiempo-real-intermitente.md): prueba de tiempo real del emulador
  intermitente, reescrita para ser determinista; causa raíz no confirmada (F2-01, F2-03).
- [LOOP-008](../../evidence/loops/LOOP-008-ramas-sobre-main-desactualizado.md): ramas creadas sobre un `main` local
  desactualizado y push rechazado por el upstream heredado (proceso, F2-06 y F2-07).
