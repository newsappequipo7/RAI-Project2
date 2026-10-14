# Presupuesto de IA (USD 20 totales)

## 1. Reglas

1. Toda llamada a un modelo pasa por `services/api/src/ai/gateway.ts`. Sin excepciones.
2. El gateway calcula costo con `src/ai/pricing.ts` (precio por millón de tokens de entrada/salida por modelo) y lo
   registra en D1 **antes** de devolver la respuesta.
3. `pricing.ts` se llena con precios **verificados en la página oficial del proveedor** el día que se configura, con
   comentario de fecha y URL. Si el proveedor cambia precios, se actualiza y se anota en un loop.
4. Desarrollo local usa `AI_MODE=mock` por defecto. Para usar el modelo real hay que poner `AI_MODE=live` a propósito.
5. El saldo real del proveedor se lee a mano del panel del proveedor **cada lunes y antes de la demo** y se registra con
   `POST /admin/budget-snapshot`. Si el ledger y el panel difieren más de 10 %, se investiga y se registra un loop.

## 2. Umbrales automáticos (gasto acumulado según ledger, entorno dev)

| Gasto acumulado | Acción automática del gateway |
|---|---|
| < USD 8 | Normal |
| ≥ USD 8 | Aviso en el dashboard; `image_generate` se deshabilita |
| ≥ USD 11 (soft) | `enrich` solo con caché o mock; chat en dev pasa a `retrieval_only` |
| ≥ USD 13 (hard) | Kill switch en `env=dev`: toda tarea de IA bloqueada salvo con `env=demo` |
| Reserva USD 7 | Solo se consume con `env=demo` durante ensayos generales y la presentación |

`env=demo` se activa con un secret distinto; lo tiene solo quien opera la demo.

## 3. Medidas de ahorro (cada una es una diapositiva de la sección 9)

| Medida | Dónde | Ahorro |
|---|---|---|
| Ranking por código | Feed | 100 % de llamadas de lectura del feed |
| Embeddings en Workers AI | Índice y consultas | Embeddings fuera del presupuesto de créditos (dentro de cuota gratuita de Cloudflare; verificar) |
| Enriquecimiento 1 vez por noticia + caché por hash de contenido | Portal | Re-enriquecer sin cambios cuesta 0 |
| Abstención por umbral antes del LLM | Chat | Preguntas fuera de corpus no gastan |
| Digest precalculado por ubicación | Chat | "Resume lo de hoy" cuesta 1 llamada por ubicación e índice, no por usuario |
| Caché de respuestas 15 min | Chat | Compañeros preguntando lo mismo en la demo |
| Rate limit 20/h por usuario | Chat | Evita abuso y bucles |
| Contexto recortado (top-k 6, extractos de 1 200 caracteres) | Chat | Menos tokens de entrada |
| `temperature = 0`, salida JSON corta | Chat, enrich | Menos tokens de salida |
| Portada tipográfica por código | Imágenes | Evita generación de imágenes |

## 4. Costo por función (medido con el ledger el 2026-10-13; ver [F4-08](../../evidence/F4-08-costs.md))

Modelo por defecto: Claude Haiku 5.5 a USD 0.10 / USD 0.50 por millón de tokens (entrada/salida) hasta 100 000 tokens de
prompt, USD 0.50 / USD 2.50 por encima (verificado el 2026-10-12 en la página oficial de precios).

| Función | Tokens entrada (prom.) | Tokens salida (prom.) | Costo por llamada (medido) | Llamadas pagadas | Gasto medido | Llamadas esperadas | Total esperado |
|---|---|---|---|---|---|---|---|
| `enrich` | 1 362 | 364 | **0.003183** (con Haiku 4.5; LOOP-005) | 5 | 0.0159 | 80 noticias | ≈ 0.25 con 4.5; ≈ 0.03 con 5.5 (estimado, sin medir) |
| `chat_answer` | 1 170 | 350 | **0.000292** | 83 | 0.0243 | 1 500 (dev + evals + demo) | ≈ 0.44 sin caché; ≈ 0.26 con 40 % evitado |
| `digest` | 2 985 | 721 | **0.000809** (mezcla de 4.5 y 5.5) | 24 | 0.0194 | 8 ubicaciones × ~20 regeneraciones | ≈ 0.13 |
| `embed` | — | — | 0 créditos | 141 | 0 | — | 0 |
| `image_generate` | — | — | no aplica (deshabilitado; Anthropic no genera imágenes) | 0 | 0 | 0 | 0 |

Gasto total del ledger al medir: **USD 0.0596**, nivel `normal`, 21 % de las 357 llamadas resueltas sin LLM (caché o
abstención). `enrich` se midió el 2026-10-03 con `enrich.v1` y Haiku 4.5: el ledger coincide con la consola de Anthropic a
menos de 1 %. El costo de `chat_answer` coincide con el cálculo a partir de los tokens medios a tarifa de Haiku 5.5;
`digest` mezcla las llamadas hechas con Haiku 4.5 antes del cambio de modelo, por eso sale más caro de lo que da la tarifa
nueva (≈ 0.00066). Total proyectado ≈ USD 0.8 como cota alta, muy por debajo del tope de USD 13 de desarrollo. Pendiente:
medir `enrich` con Haiku 5.5 (el 4.5 sigue como cota alta) y repetir esta tabla después de los ensayos.

**Cómo repetir la medición:** `EVAL_ID_TOKEN=… pnpm evals:costs --api <worker> --out ../evidence/F4-08-costs.md` (la ruta
es relativa a `evals/`) lee `GET /admin/costs` (`taskStats`: solo llamadas reales pagadas, sin `mock` ni caché). Las
latencias p50/p95 por modo las imprime y guarda `pnpm evals:chat` (`metrics.latencyByMode`).

Fórmula: `costo = (in/1e6)·precioIn + (out/1e6)·precioOut`. Llenar la columna "Costo por llamada" en la primera semana
con el promedio real de D1 y proyectar. Si la proyección total supera USD 13, cambiar de modelo o recortar contexto
antes de seguir (y registrarlo como loop: es exactamente el tipo de evidencia que pide la sección 8).

## 5. Estimación de la demo (para justificar la reserva)

Supuesto: 25 compañeros × 5 preguntas = 125 preguntas; 40 % resueltas por digest, caché o abstención → ~75 llamadas
LLM. Más 3 ensayos generales del equipo (~60 llamadas cada uno). Total ≈ 255 llamadas × costo medio medido.
La reserva de USD 7 debe cubrir **al menos 3×** esa estimación. Si no la cubre, bajar el modelo del chat en demo.

**Resultado (2026-10-13, [F4-08](../../evidence/F4-08-costs.md)):** 255 llamadas × USD 0.000292 ≈ **USD 0.07**; la reserva
de USD 7.00 las cubre **93.9×** (objetivo ≥ 3×).

## 6. Dashboard de costos (portal `/costs`, F2)

Muestra: gasto acumulado, saldo estimado (20 − gasto), último saldo real registrado, gasto por tarea y por día, costo
medio por llamada, % de llamadas evitadas (caché + abstención + digest), estado de flags y umbrales. Se proyecta en la
sección 9 de la presentación.
