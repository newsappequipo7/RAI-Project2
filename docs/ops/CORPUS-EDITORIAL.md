# Corpus editorial real (F2-11)

Borradores de **16 noticias reales** (1–2 de octubre de 2026) más los **2 borradores de demo** del guion
(`DEMO-RUNBOOK.md` §2). Los preparó Claude Code leyendo cada fuente original; **ninguna está publicada**. Publicarlas es
decisión de una persona editora: la certeza que traen es una *propuesta* que respeta las reglas de
`VERIFICACION-Y-FUENTES.md` §2, y el checklist editorial viene sin marcar a propósito.

## Cómo se cargan y se publican

```bash
pnpm seed:editorial --check                      # valida offline las 18 y comprueba validatePublish (no escribe nada)
firebase emulators:start --only firestore        # opcional: probar primero en el emulador
pnpm seed:editorial --target=emulator
pnpm seed:editorial --target=prod                # requiere `gcloud auth login` con la cuenta dueña del proyecto
```

- Solo escribe **borradores** (`workflow = borrador`) y **nunca pisa** un documento que ya exista: si una noticia ya se
  publicó o se editó, la omite. `--overwrite-drafts` solo reemplaza borradores intactos. Opciones: `--only=corpus|demo`.
- Cada borrador ya trae fuentes, afirmaciones vinculadas (el estado lo calcula el código), alcance, temas, importancia
  propuesta y la **portada generada** (las de demo D2 no traen imagen a propósito).
- Para publicar cada noticia en el portal (`/news`): abre **cada enlace de fuente** y comprueba que dice lo que se
  registró, lee la nota «Qué revisar» de abajo, marca el checklist (es una afirmación humana) y pulsa Publicar. El botón
  seguirá bloqueado hasta que el checklist esté completo.
- Con las 40 noticias de la semilla, publicar las 16 deja **56 publicadas** (CA1 pide ≥ 55). Los borradores de demo se
  quedan sin publicar hasta la demo.

## Qué está comprobado y qué no

- **Comprobado por prueba automática** (`packages/shared/src/editorial/corpus.test.ts`): las 16 son válidas para el
  esquema, cubren las 8 ubicaciones, usan enlaces `https` reales y distintos, y pasan `validatePublish` en cuanto se completa
  el checklist (CA2). También se comprueba que ninguna se puede publicar sin la intervención humana.
- **Comprobado al redactar:** los hechos, cifras y citas salen solo de lo que se leyó en cada enlace. Las páginas que
  devolvieron error (La Hora, Cambio Colombia, Deia, la Asamblea de El Salvador) **no se usan como fuente**.
- **No comprobado:** que las notas no cambien después (varias son historias vivas) y los puntos marcados abajo.
- **Dos descartes por error de fechas:** una nota de Diario El Mundo sobre el aguinaldo era de octubre de 2025 (reforma
  anterior) y una de El Universal sobre lluvias en CDMX era de mayo de 2026. Se detectaron al leer las fechas.

## Resumen

| ID | Ubicación | Alcance | Certeza propuesta | Fuentes (tipo) |
|---|---|---|---|---|
| `ed-gt-001` | Ciudad de Guatemala | nacional | confirmada | Prensa Libre (medio), Prensa Latina (agencia) |
| `ed-gt-002` | Ciudad de Guatemala | nacional | confirmada | EFE (agencia), Prensa Libre (medio) |
| `ed-gt-003` | Ciudad de Guatemala | nacional | confirmada | EFE (agencia), Agencia Guatemalteca de Noticias (agencia) |
| `ed-gt-004` | Quetzaltenango | local | en_desarrollo | Soy502 (medio), Prensa Libre (medio) |
| `ed-sv-001` | San Salvador | nacional | en_desarrollo | Diario El Salvador (medio) |
| `ed-sv-002` | San Salvador | nacional | en_desarrollo | Infobae (medio), Diario El Salvador (medio) |
| `ed-sv-003` | San Salvador | nacional | en_desarrollo | Infobae (medio), CR Prensa (medio) |
| `ed-mx-001` | Ciudad de México | local | en_desarrollo | La Razón de México (medio), La Silla Rota (medio) |
| `ed-us-001` | Nueva York | local | confirmada | Rent Guidelines Board (primaria), Infobae (medio), La Opinión (medio) |
| `ed-us-002` | Nueva York | local | en_desarrollo | Infobae (medio) |
| `ed-co-001` | Bogotá | nacional | en_desarrollo | El Tiempo (medio), Infobae (medio) |
| `ed-co-002` | Bogotá | local | confirmada | Alcaldía de Bogotá (primaria), Pulzo (medio) |
| `ed-ar-001` | Buenos Aires | nacional | confirmada | INDEC (primaria), La Gaceta (medio), Errepar (medio) |
| `ed-es-001` | Madrid | local | en_desarrollo | elDiario.es (medio), El Tiempo (medio) |
| `ed-es-002` | Madrid | nacional | confirmada | Boletín Oficial del Estado (primaria), Libertad Digital (medio), Real Automóvil Club de España (otro) |
| `ed-es-003` | Madrid | nacional | confirmada | EFE (agencia), The Objective (medio) |

## Qué revisar en cada una

### `ed-gt-001` — Jonathan Menkos asume la presidencia del Banco de Guatemala entre amparos del Cacif y de un diputado

- **Certeza propuesta:** confirmada
- **Importancia propuesta:** 2 · temas: economia, politica
- **Fuentes:**
  - Prensa Libre · medio · confirma — https://www.prensalibre.com/economia/jonathan-menkos-asume-el-banguat-entre-impugnaciones-y-advertencias-de-incertidumbre/
  - Prensa Latina · agencia · confirma — https://www.prensa-latina.cu/2026/09/29/gobierno-nombra-nuevas-autoridades-del-banco-de-guatemala/
- **Qué revisar:** Abrir ambos enlaces. Prensa Libre es del 2 de octubre y Prensa Latina del 29 de septiembre. Confirmar que los amparos siguen vigentes antes de publicar: es un tema que se mueve.

### `ed-gt-002` — Taiwán financiará un hospital oncológico, seguridad en La Aurora y estudios de la carretera al Atlántico

- **Certeza propuesta:** confirmada
- **Importancia propuesta:** 2 · temas: politica, salud
- **Fuentes:**
  - EFE (vía Infobae) · agencia · confirma — https://www.infobae.com/america/agencias/2026/10/02/taiwan-se-compromete-a-financiar-la-modernizacion-sanitaria-aerea-y-vial-de-guatemala/
  - Prensa Libre · medio · confirma — https://www.prensalibre.com/guatemala/politica/taiwan-amplia-su-cooperacion-con-guatemala-con-proyectos-para-el-aeropuerto-la-aurora-salud-y-carreteras-breaking/
- **Qué revisar:** Los montos del aeropuerto se expresan en monedas distintas (1,22 millones de dólares según EFE, 9,5 millones de quetzales según Prensa Libre): comprobar que sean equivalentes. La Hora y el CIV también cubrieron el convenio, pero sus páginas no se pudieron leer al preparar este borrador.

### `ed-gt-003` — Guatemala empata 0-0 con Surinam y sigue con opciones en la Liga de Naciones de Concacaf

- **Certeza propuesta:** confirmada
- **Importancia propuesta:** 0 · temas: deportes
- **Fuentes:**
  - EFE (vía Infobae) · agencia · confirma — https://www.infobae.com/america/agencias/2026/10/03/0-0-guatemala-empata-con-surinam-y-mantiene-sus-opciones-en-la-liga-de-naciones/
  - Agencia Guatemalteca de Noticias · agencia · confirma — https://agn.gt/como-quedo-surinam-vs-guatemala-en-la-liga-de-naciones-2026/
- **Qué revisar:** La AGN es un medio estatal: está bien como fuente del resultado, pero conviene la agencia (EFE) para los puntos del grupo, que la AGN no detalla. Comprobar el resultado del lunes 5 antes de que quede desactualizada.

### `ed-gt-004` — Más de 4 000 estudiantes de nivel medio desfilan en Quetzaltenango por la Independencia

- **Certeza propuesta:** en_desarrollo · nota: «Solo Soy502 confirma la cifra de participantes; falta una segunda fuente que la respalde.»
- **Importancia propuesta:** 0 · temas: cultura, educacion
- **Fuentes:**
  - Soy502 · medio · confirma — https://www.soy502.com/articulo/xelafer-2026-desfile-15-septiembre-quetzaltenango-102082
  - Prensa Libre (programación) · medio · contexto — https://www.prensalibre.com/vida/escenario/fiestas-de-independencia-2026-en-xela-desfiles-conciertos-y-actividades-de-xelafer-del-13-al-19-de-septiembre/
- **Qué revisar:** Otro medio de Quetzaltenango (La Voz de Xela, Prensa de Occidente) podría dar una segunda fuente y subir la noticia a «confirmada». Las cifras de participantes varían entre notas (se vieron 4 113 y 4 130): usar la del enlace.

### `ed-sv-001` — El Salvador cierra el 1 de octubre sin homicidios y suma 234 días sin muertes violentas en 2026

- **Certeza propuesta:** en_desarrollo · nota: «Una sola fuente periodística; falta el reporte original de la PNC o un segundo medio.»
- **Importancia propuesta:** 1 · temas: seguridad
- **Fuentes:**
  - Diario El Salvador · medio · confirma — https://diarioelsalvador.com/depais/el-salvador-inicia-octubre-sin-homicidios/859970
- **Qué revisar:** Buscar el comunicado de la PNC (fuente primaria) y enlazarlo: con él y esta nota la noticia cumpliría los requisitos para «confirmada». Es un conteo oficial que el Gobierno difunde a diario; conviene citar que lo publica la propia PNC.

### `ed-sv-002` — El Salvador permitirá pagar el aguinaldo desde el 1 de octubre y lo exenta de renta hasta 1 500 dólares

- **Certeza propuesta:** en_desarrollo · nota: «Dos medios coinciden, pero falta enlazar el decreto publicado en el Diario Oficial (fuente primaria).»
- **Importancia propuesta:** 2 · temas: economia, sociedad
- **Fuentes:**
  - Infobae · medio · confirma — https://www.infobae.com/el-salvador/2026/09/23/el-salvador-asamblea-legislativa-aprueba-que-el-aguinaldo-pueda-pagarse-desde-el-1-de-octubre/
  - Diario El Salvador · medio · confirma — https://diarioelsalvador.com/depais/aguinaldo-podra-ser-pagado-desde-el-1-de-octubre-y-estara-libre-de-renta-hasta-1500/856889
- **Qué revisar:** Cuidado: hay una nota de Diario El Mundo con un titular parecido («desde el 20 de octubre») pero es de octubre de 2025, de la reforma anterior. No usarla como fuente de esta noticia. Falta el decreto en el Diario Oficial o el sitio de la Asamblea (su certificado falló al consultarlo).

### `ed-sv-003` — El Salvador propone destinar 3 416 millones de dólares a educación en el presupuesto de 2027

- **Certeza propuesta:** en_desarrollo · nota: «Es un proyecto pendiente de aprobación en la Asamblea; falta la fuente oficial del Ministerio de Hacienda.»
- **Importancia propuesta:** 2 · temas: educacion, economia
- **Fuentes:**
  - Infobae · medio · confirma — https://www.infobae.com/el-salvador/2026/10/01/el-gobierno-de-el-salvador-invertira-el-275-del-total-de-su-presupuesto-para-el-ramo-de-educacion/
  - CR Prensa · medio · confirma — https://crprensa.com/2026/09/30/el-salvador-eleva-presupuesto-a-usd-12-421-millones-con-foco-en-educacion/
- **Qué revisar:** La diferencia con 2026 aparece como 1 865 o 1 866 millones según la nota: se usa «unos 1 865». Las notas sobre la Asamblea (asamblea.gob.sv) no se pudieron leer por un error de certificado; si se consigue, sería la fuente primaria. Hasta que se vote sigue siendo un proyecto.

### `ed-mx-001` — Alerta amarilla por lluvias en las 16 alcaldías de la CDMX deja inundaciones y retrasos en el transporte

- **Certeza propuesta:** en_desarrollo · nota: «Dos medios coinciden, pero falta el parte oficial de Protección Civil y el balance final del día.»
- **Importancia propuesta:** 1 · temas: clima-desastres, sociedad
- **Fuentes:**
  - La Razón de México · medio · confirma — https://www.razon.com.mx/ciudad/2026/10/01/lluvias-en-cdmx-hoy-1-de-octubre-estas-son-las-afectaciones-y-zonas-con-inundaciones/
  - La Silla Rota · medio · confirma — https://lasillarota.com/metropoli/2026/10/1/fuertes-lluvias-provocaron-inundaciones-y-retrasos-en-cablebus-cdmx-530938.html
- **Qué revisar:** Las dos notas no coinciden en la hora (La Silla Rota es de la mañana del 1 de octubre; La Razón habla de la tarde y la noche). Para no mezclar episodios, mantener la noticia en términos generales. NO usar la nota de El Universal sobre lluvias en CDMX que apareció en la búsqueda: es de mayo de 2026.

### `ed-us-001` — Nueva York congela desde el 1 de octubre las rentas de casi un millón de apartamentos estabilizados

- **Certeza propuesta:** confirmada
- **Importancia propuesta:** 2 · temas: economia, sociedad
- **Fuentes:**
  - Rent Guidelines Board de Nueva York · primaria · confirma — https://rentguidelinesboard.cityofnewyork.us/
  - Infobae · medio · confirma — https://www.infobae.com/estados-unidos/2026/10/01/tres-nuevas-leyes-de-nueva-york-entran-en-vigor-desde-el-1-de-octubre-que-es-importante-saber/
  - La Opinión · medio · confirma — https://laopinion.com/2026/10/01/nueva-york-congela-renta-apartamentos-como-saber-incluido/
- **Qué revisar:** La página de la Rent Guidelines Board no muestra los porcentajes en el texto visible (están en la Orden 58); abrir la orden y enlazarla para respaldar el 0 % con la fuente primaria. Vigilar la demanda: puede cambiar la noticia.

### `ed-us-002` — Nueva York: desde el 1 de octubre las empresas deben permitir cancelar suscripciones por el mismo medio

- **Certeza propuesta:** en_desarrollo · nota: «Una sola fuente periodística; falta una segunda fuente y el texto de la ley.»
- **Importancia propuesta:** 1 · temas: economia, sociedad
- **Fuentes:**
  - Infobae · medio · confirma — https://www.infobae.com/estados-unidos/2026/10/01/tres-nuevas-leyes-de-nueva-york-entran-en-vigor-desde-el-1-de-octubre-que-es-importante-saber/
- **Qué revisar:** Es la misma nota de Infobae que respalda la noticia de las rentas; para esta norma hace falta una segunda fuente independiente (el sitio del Estado o de la Fiscalía General) antes de plantear «confirmada».

### `ed-co-001` — Colombia revierte el aumento de 46 pesos por galón de gasolina anunciado para octubre

- **Certeza propuesta:** en_desarrollo · nota: «El anuncio del aumento y su reversión ocurrieron en menos de 24 horas; falta la resolución oficial que fije el precio vigente.»
- **Importancia propuesta:** 2 · temas: economia
- **Fuentes:**
  - El Tiempo · medio · confirma — https://www.eltiempo.com/economia/empresas/el-ministerio-de-minas-y-energia-y-el-ministerio-de-hacienda-acatan-la-instruccion-presidencial-y-revierten-el-aumento-de-octubre-en-la-gasolina-3590623
  - Infobae · medio · confirma — https://www.infobae.com/colombia/2026/10/01/gasolina-sube-46-desde-el-1-de-octubre-y-acpm-mantiene-su-precio-asi-quedan-los-combustibles-en-colombia/
- **Qué revisar:** CUIDADO: varios medios (Infobae, Cambio Colombia, El Espectador) publicaron la subida y otros la reversión. Este borrador existe precisamente por eso. Antes de publicar, buscar la resolución del Ministerio de Minas y Energía que fije el precio de octubre. Si la reversión se confirma, el titular y el cuerpo ya la reflejan.

### `ed-co-002` — Bogotá prevé cuatro movilizaciones entre el 1 y el 4 de octubre en Fontibón, Santa Fe y Teusaquillo

- **Certeza propuesta:** confirmada
- **Importancia propuesta:** 0 · temas: sociedad
- **Fuentes:**
  - Alcaldía de Bogotá · primaria · confirma — https://bogota.gov.co/mi-ciudad/gobierno/marchas-y-manifestaciones-en-bogota-del-1-al-4-de-octubre-de-2026
  - Pulzo · medio · confirma — https://www.pulzo.com/nacion/bogota/marchas-y-movilizaciones-en-bogota-2026-agenda-rutas-y-recomendaciones-oficiales-PP5319125A
- **Qué revisar:** Es una agenda: los eventos de los días 1 y 2 ya habrán pasado al publicar. Considerar presentarla como «agenda» o retirarla del feed cuando caduque. Los organizadores no figuran en las fuentes.

### `ed-ar-001` — Argentina: la inflación de agosto fue de 1,7 %, por debajo del 2,1 % de julio, según el INDEC

- **Certeza propuesta:** confirmada
- **Importancia propuesta:** 2 · temas: economia
- **Fuentes:**
  - INDEC — Informe técnico IPC agosto 2026 · primaria · confirma — https://www.indec.gob.ar/uploads/informesdeprensa/ipc_09_26A1BE2DC4CD.pdf
  - La Gaceta · medio · confirma — https://www.lagaceta.com.ar/nota/1153447/sociedad/inflacion-agosto-fue-17porciento-segun-indec.html
  - Errepar · medio · confirma — https://documento.errepar.com/actualidad/ipc-agosto-2026-de-cuanto-fue-la-inflacion-20260910190141328
- **Qué revisar:** Fuente primaria leída directamente (informe técnico del INDEC del 10 de septiembre). Es el dato de agosto; el de septiembre se publica el 13 de octubre y dejará esta noticia atrás.

### `ed-es-001` — La Comunidad de Madrid lleva a los tribunales el desalojo de la acampada por la vivienda en la Puerta del Sol

- **Certeza propuesta:** en_desarrollo · nota: «Pendiente de la decisión del Tribunal Superior de Justicia de Madrid; las cifras de asistencia no coinciden entre fuentes.»
- **Importancia propuesta:** 2 · temas: politica, sociedad
- **Fuentes:**
  - elDiario.es · medio · confirma — https://www.eldiario.es/madrid/jueza-eleva-tribunal-superior-madrid-peticion-ayuso-desalojar-puerta-sol_1_13556228.html
  - El Tiempo (EFE y AFP) · medio · confirma — https://www.eltiempo.com/mundo/europa/protestas-por-la-crisis-de-vivienda-en-madrid-desafian-orden-de-desalojo-y-mantienen-campamento-en-la-puerta-del-sol-3590901
- **Qué revisar:** Es una noticia viva: la decisión del TSJM puede llegar en cualquier momento y cambiar el texto. La cifra de «2 000 tiendas» es de los organizadores (no verificada de forma independiente); otras notas hablan de unas 500 tiendas el 30 de septiembre. Consultar EFE o la Delegación del Gobierno para una fuente primaria o de agencia.

### `ed-es-002` — Entra en vigor la reforma del Reglamento de Circulación: casco en patinetes y guantes para motoristas

- **Certeza propuesta:** confirmada
- **Importancia propuesta:** 2 · temas: sociedad
- **Fuentes:**
  - BOE — Real Decreto 518/2026 · primaria · confirma — https://www.boe.es/diario_boe/txt.php?id=BOE-A-2026-13889
  - Libertad Digital · medio · confirma — https://www.libertaddigital.com/servicios/trafico/2026-10-01/las-nuevas-normas-de-circulacion-ya-estan-en-vigor-que-deben-hacer-ahora-conductores-y-ciclistas-7468573/
  - Real Automóvil Club de España · otro · confirma — https://www.race.es/normativa-dgt
- **Qué revisar:** Leída la versión oficial del BOE. Dos puntos que los medios cuentan distinto y que aquí NO se afirman: el chaleco reflectante (el BOE no lo menciona para patinetes) y la cifra de la sanción (200 € solo aparece en Libertad Digital). Si se quiere incluir la multa, buscar su respaldo oficial.

### `ed-es-003` — Antonio Garamendi, reelegido presidente de la CEOE por aclamación para un tercer mandato

- **Certeza propuesta:** confirmada
- **Importancia propuesta:** 1 · temas: economia, politica
- **Fuentes:**
  - EFE (vía Público) · agencia · confirma — https://www.publico.es/economia/garamendi-reelegido-presidente-ceoe-proximos-cuatro-anos.html
  - The Objective · medio · confirma — https://theobjective.com/economia/2026-10-01/garamendi-cuatro-anos-ceoe-tercer-mandato/
- **Qué revisar:** Deia (también leída en la búsqueda) devolvió un error al abrirla, por lo que no se usa. Comprobar la cita de Garamendi en el enlace de EFE antes de publicar.

## Borradores de demo

- `demo-d1` — Alerta por lluvias intensas en Quetzaltenango (en_desarrollo, importancia 3). Borrador D1 del guion de la demo (§2): local, esencial, en desarrollo con nota. Fuente de ejemplo. Las fuentes son de ejemplo (`example.org`) y el cuerpo lleva la marca «Noticia de prueba para el proyecto académico», igual que la semilla: describen un escenario de demostración, no hechos reales.
- `demo-d2` — Banco central europeo mantiene tasas (confirmada, importancia 0). Borrador D2 del guion de la demo (§2): internacional, rutina, confirmada, SIN imagen para elegir la portada tipográfica en vivo. Las fuentes son de ejemplo (`example.org`) y el cuerpo lleva la marca «Noticia de prueba para el proyecto académico», igual que la semilla: describen un escenario de demostración, no hechos reales.
