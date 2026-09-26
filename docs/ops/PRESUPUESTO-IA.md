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

## 4. Costo por función (plantilla; llenar con datos reales del ledger)

| Función | Tokens entrada (prom.) | Tokens salida (prom.) | Costo por llamada | Llamadas esperadas | Total esperado |
|---|---|---|---|---|---|
| `enrich` | ~1 500 (supuesto) | ~500 (supuesto) | medir | 80 noticias | medir |
| `chat_answer` | ~3 000 (supuesto) | ~400 (supuesto) | medir | 1 500 (dev + evals + demo) | medir |
| `digest` | ~3 000 (supuesto) | ~500 (supuesto) | medir | 8 ubicaciones × ~20 regeneraciones | medir |
| `embed` | — | — | 0 créditos | — | 0 |
| `image_generate` | — | — | medir | ≤ 5 | medir |

Fórmula: `costo = (in/1e6)·precioIn + (out/1e6)·precioOut`. Llenar la columna "Costo por llamada" en la primera semana
con el promedio real de D1 y proyectar. Si la proyección total supera USD 13, cambiar de modelo o recortar contexto
antes de seguir (y registrarlo como loop: es exactamente el tipo de evidencia que pide la sección 8).

## 5. Estimación de la demo (para justificar la reserva)

Supuesto: 25 compañeros × 5 preguntas = 125 preguntas; 40 % resueltas por digest, caché o abstención → ~75 llamadas
LLM. Más 3 ensayos generales del equipo (~60 llamadas cada uno). Total ≈ 255 llamadas × costo medio medido.
La reserva de USD 7 debe cubrir **al menos 3×** esa estimación. Si no la cubre, bajar el modelo del chat en demo.

## 6. Dashboard de costos (portal `/costs`, F2)

Muestra: gasto acumulado, saldo estimado (20 − gasto), último saldo real registrado, gasto por tarea y por día, costo
medio por llamada, % de llamadas evitadas (caché + abstención + digest), estado de flags y umbrales. Se proyecta en la
sección 9 de la presentación.
