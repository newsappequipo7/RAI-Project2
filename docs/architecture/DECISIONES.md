# Registro de decisiones (ADR)

Formato corto. Una decisión nueva = una entrada nueva al final. No se edita una decisión aceptada: se reemplaza con otra
que diga "Reemplaza ADR-00X". Estas decisiones son evidencia para la sección 6 de la presentación.

Plantilla:
```
## ADR-0XX — Título
Estado: propuesta | aceptada | reemplazada por ADR-0YY
Fecha: YYYY-MM-DD · Autor: Persona N
Contexto: qué problema o restricción obliga a decidir.
Opciones: A, B, C con pros/contras en una línea cada una.
Decisión: la elegida.
Consecuencias: qué ganamos, qué perdemos, qué hay que vigilar.
Evidencia: enlace a loop, medición o prueba que la respalda.
```

---

## ADR-001 — Expo compatible con Expo Go como app móvil
Estado: aceptada (a confirmar con spike F1-02)
Contexto: nadie del equipo tiene cuenta Apple Developer de pago y el presupuesto lo prohíbe. Los compañeros deben poder
usar la app en su iPhone durante la clase.
Opciones: (A) Expo + Expo Go: se instala desde App Store gratis y carga nuestro JS. (B) Build nativo vía ios-builder
(GitHub Actions) + reinstalación con Apple ID gratuito vía MobAI: vence a los 7 días y requiere USB por dispositivo.
(C) PWA: no es "app" y en iOS el login y la instalación son menos confiables.
Decisión: A como plan principal, B como respaldo para teléfonos del equipo, C como emergencia.
Consecuencias: prohibido agregar módulos nativos fuera de Expo Go; Google Sign-In nativo no disponible → puente web (ADR-003).

## ADR-002 — Ranking por código, no por LLM
Estado: aceptada
Contexto: el enunciado pide evitar llamadas costosas cuando ordenar o presentar pueda resolverse más barato.
Decisión: motor de ranking determinista en `packages/shared/ranking`, compartido por app, portal y pruebas.
Consecuencias: costo 0 en lectura, explicable, testeable. Perdemos matices semánticos finos; se compensan con temas y
geo enriquecidos una sola vez al publicar.

## ADR-003 — Login móvil mediante puente web de Firebase
Estado: aceptada (a confirmar con spike F1-03)
Contexto: Expo Go no incluye el SDK nativo de Google Sign-In.
Decisión: página `/auth/mobile` en Firebase Hosting que autentica con el SDK web y devuelve el `id_token` de Google por
deep link en el fragmento; la app lo canjea con `signInWithCredential`.
Consecuencias: un solo camino de login para Expo Go, build nativo y web. Riesgo: fuga de token por redirección abierta
→ lista blanca de esquemas de redirect y token en fragmento.

## ADR-004 — Backend en Cloudflare Workers (plan Free), sin Admin SDK de Firebase
Estado: aceptada
Contexto: Cloud Functions requiere plan Blaze (tarjeta). Queremos infraestructura gratis y sin tarjeta.
Opciones: (A) Cloud Functions en Blaze. (B) Cloudflare Worker + KV + D1 + Workers AI. (C) Servidor propio en un PaaS gratis.
Decisión: B. Firestore sigue siendo fuente de verdad y lo escriben los clientes con reglas; el Worker mantiene un índice
derivado en KV que el portal actualiza al publicar.
Consecuencias: embeddings sin gastar créditos (Workers AI), ledger en D1, y acceso a Jev vía Workers AI para el
laboratorio. Hay que mantener sincronía KV↔Firestore (endpoint `rebuild`).

## ADR-005 — Búsqueda semántica por fuerza bruta en el Worker
Estado: aceptada
Contexto: el corpus de la demo será de decenas a pocos cientos de noticias.
Decisión: similitud coseno sobre todo el índice en memoria del Worker, cargado desde KV.
Consecuencias: cero infraestructura adicional. Revisar si el corpus supera ~2 000 noticias (entonces Vectorize).

## ADR-006 — La certeza la decide un humano; el modelo no puede elevarla
Estado: aceptada
Decisión: `certainty` solo se escribe desde el portal. El chat hereda la certeza de las noticias citadas. Las sugerencias
de IA en el portal quedan guardadas en `aiSuggestions` para auditar qué se aceptó.

## ADR-007 — Portada tipográfica generada por código como opción preferida sin foto
Estado: aceptada
Contexto: generar imágenes con IA cuesta créditos y puede parecer evidencia real.
Decisión: jerarquía foto real → licencia libre → portada tipográfica (código, costo 0) → ilustración IA (deshabilitada
por defecto, etiquetada). Ver `docs/domain/IMAGENES.md`.

## ADR-008 — Modelo de embeddings multilingüe en Workers AI
Estado: propuesta (verificar en F1-09)
Decisión: `@cf/baai/bge-m3` por soporte de español. Confirmar nombre, dimensión y cuota gratuita en la documentación
de Cloudflare antes de indexar. Si cambia, reindexar todo (`/admin/index/rebuild`).
