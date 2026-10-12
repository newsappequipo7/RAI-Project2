# F4-09 — Preparación de la demo (parte de Joaquín)

Fecha: 2026-10-11 · Responsable de este registro: Joaquín · Rama: `fase-4/f4-09-demo-readiness`

Según `docs/CRONOGRAMA.md` §3, el script `pnpm demo:prepare` y los videos de respaldo (pasos 3 y 4) son de **Diego**.
Este registro cubre los pasos 1 y 2 y el guion de la sección 5 (Chat), que presenta Joaquín. No se modificó nada en
producción: el estado se leyó del portal (`/news`, Firestore de producción) y del código.

## Estado por paso

| Paso | Estado | Hallazgo | Quién / qué falta |
|---|---|---|---|
| 1a. Versión final publicada | ◐ | La app no tiene `expo-updates` ni `eas.json`: **no hay EAS Update**, así que el plan es el túnel de Metro (`pnpm -F mobile start --tunnel`) o el Plan B nativo | Equipo: decidir túnel + Plan B; el chat (F4-04) necesita además el Worker desplegado con F4-01…F4-07 |
| 1b. `/instalar` con QR final | ◐ | La página existe y genera el QR desde `VITE_EXPO_PROJECT_URL` o desde la URL que se escriba en ella (se guarda en el navegador) | Día de la demo: pegar la URL `exp://…` del túnel activo y proyectar |
| 2a. Borradores D1 y D2 | ☐ | `pnpm seed:editorial --check`: `demo-d1` y `demo-d2` pasan `validatePublish`. Pero en Firestore de producción hay **41 noticias, todas publicadas, y ningún borrador**: ni D1/D2 ni los 16 editoriales están cargados | Cargar con `pnpm seed:editorial --target=prod` (gcloud con permisos); decisión pendiente de F2-11 |
| 2b. Noticia para retractar | ☐ | Propuesta: retractar **D1** en la sección 7. El guion del chat ya la usa en la sección 5, y `demoFlow.test.ts` prueba que, tras retirarla del índice, el chat y el digest dejan de citarla | Daniel decide |
| Guion de la sección 5 | ☑ | Agregado a `docs/ops/DEMO-RUNBOOK.md` §2: 6 preguntas con ubicación, qué debe verse y su caso del set dorado | — |

## Riesgos para `demo:prepare` (para Diego)

1. **Ventana de 72 h.** Las 40 noticias semilla de producción se escribieron el 10 de octubre con horas relativas a
   ese momento. El 11 de octubre, en el comparador, ya solo 24 entraban al ranking. El día de la presentación estarán
   todas fuera, y los digests responderán «No hay noticias recientes». `demo:prepare` debe volver a escribir la semilla
   con horas actuales (`pnpm seed --target=prod`) **antes** de reconstruir el índice y calentar los 8 digests. La
   semilla incluye las 3 retractadas, así que se conservan.
2. **`env=demo` no es un flag:** es `ENV` en `services/api/wrangler.toml` y requiere desplegar. Con `ENV=demo`, el
   límite de 20 mensajes por hora aplica también a los admins, y `debug` desaparece de las respuestas («¿Cómo se
   generó?» calcula la intención en el teléfono, F4-04).
3. **Noticia maliciosa de F4-07:** comprobar que **no** esté en el índice (`pnpm seed:injection --api <worker> --remove`).
4. **Digest sin `config/public`:** si se cambia `feedWindowHours` para la demo, el digest sigue usando 72 h (F4-03).

## Pruebas

`services/api/src/rag/demoFlow.test.ts` (4 pruebas):
- la pregunta del guion desde `mx-cdmx` se clasifica como `otro_pais` → GT;
- la respuesta sobre D1 hereda «en desarrollo» y muestra el aviso;
- tras retractar (retirar del índice), una pregunta ya hecha no sale de caché y no cita D1;
- el digest de Quetzaltenango que citaba D1 se invalida.

```text
pnpm lint / typecheck   OK
pnpm test               OK: shared 289, Firestore 80, evals 11, admin 71, Worker 214 (665 pruebas)
```
