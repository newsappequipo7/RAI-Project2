# Jev (TypeSafe AI) — investigación para el laboratorio de rediseño

Fecha de revisión: 2026-09-26. Jev salió en acceso anticipado el 2026-09-15; todo cambia rápido. Revalidar antes de
entregar el laboratorio.

Leyenda: **[V]** verificado en documentación/políticas oficiales de TypeSafe · **[P]** afirmación del proveedor sin
verificación independiente · **[T]** fuente de terceros · **[S]** supuesto nuestro, falta verificar.

## 1. Qué es

- [V] Jev es el modelo principal de TypeSafe y el primer "System One model": recibe un `state` (texto, JSON o arreglo)
  y un mapa de preguntas tipadas, y devuelve respuestas estructuradas con probabilidades. **No genera texto.**
  Fuente: https://docs.typesafe.ai/introduction
- [V] Tres primitivas: **Choice** (elige una opción de una lista, hasta 255 opciones; devuelve `choice`,
  `probabilities`, `confidence`), **Score** (posición en una rúbrica ordenada de 2 a 10 niveles; puede caer entre
  niveles; devuelve `score`, `legend`, `probabilities`, `confidence`), **Noul** (sí/no; devuelve probabilidad de "sí"
  sin campo de confianza). Fuente: https://docs.typesafe.ai/api.md
- [V] Todas las preguntas de una llamada se evalúan en paralelo y de forma aislada contra el mismo `state`.
- [V] Endpoint `POST https://api.typesafe.ai/v1/systemone`, modelo `jev-latest` (hoy apunta a `jev-1.13.0`).
- [V] La guía oficial recomienda preguntas atómicas y combinar resultados con lógica propia en código.

## 2. Límites frente a un LLM (página oficial de "jaggedness")

Fuente [V]: https://docs.typesafe.ai/model-jaggedness/jev-1.13.md

- Lectura literal: responde lo escrito, no la intención.
- No es calculadora: no cuenta de forma confiable; la aritmética debe ir en código.
- Compara mal fechas y horas; conviene extraer componentes y comparar en código.
- Pierde precisión con indirecciones y dobles negaciones.
- Pierde precisión con `state` grande lleno de detalle irrelevante: filtrar antes.
- Contenido adversarial (instrucciones inyectadas) puede mover la respuesta; no lo trata como hostil por defecto.
- No garantiza invariantes estructurales (una Noul y su negación no tienen por qué sumar 1).
- **No sirve para generar texto.** Para eso, un modelo generativo.
- [V] Idioma: inglés es el idioma principal de entrenamiento; otros idiomas se manejan "pero no igual de bien" y la
  documentación pide probar con contenido propio. **Relevante: nuestro contenido está en español.**
  Fuente: https://docs.typesafe.ai/models.md
- [T] Que "no alucina" significa que no puede devolver un valor fuera del esquema; **sí puede equivocarse**.
  Fuente: https://www.firecrawl.dev/blog/what-is-jev

## 3. Precio, velocidad, recursos

- [V] Precio: USD 0.042 por millón de tokens de entrada; salida gratis. Límites: 250 000 tokens/s y
  1 200 solicitudes/min (ajustándose dinámicamente). Contexto: 64k tokens por solicitud; 32k para `state` + la pregunta
  más larga. Solo texto (sin imagen/audio). Fuente: https://docs.typesafe.ai/models.md
- [V] Cloudflare Workers AI lo ofrece como `typesafe/jev`, marcado como **"Zero data retention"**, con el mismo precio
  de entrada, contexto de 32k. Fuente: https://developers.cloudflare.com/ai/models/typesafe/jev/
- [T] También disponible en OpenRouter (32K contexto, mismo precio). Fuente: https://openrouter.ai/provider/typesafe
- [P] Velocidad: 70–500 ms extremo a extremo; "40–200× más rápido" y "40–400× más barato" que LLMs de frontera; la
  cifra de titular sale de evaluaciones propias y conviene tratarla como techo. Fuente [T] que lo resume:
  https://flaviocopes.com/jev/
- [P] ~68 % de precisión en el benchmark de 4 flujos de TypeSafe, cerca de LLMs de gama media. Fuente [T]:
  https://www.datacamp.com/blog/system-one-models-jev
- [S] Para nuestras tareas (clasificar una noticia de ~500 tokens con 5 preguntas) el costo sería del orden de
  USD 0.00002 por noticia. Falta medir precisión en español.
- [S] Consumo de recursos/energía: TypeSafe no publica cifras de energía; solo se puede argumentar indirectamente por
  menor tiempo de cómputo. Marcar como no verificado.

## 4. Datos, telemetría, conservación y entrenamiento

- [V] Política de privacidad: TypeSafe **no entrena ni hace fine-tuning** con los prompts ni con el Input del cliente, y
  no divulga el Input a terceros salvo a sus proveedores de servicio. Recoge datos de cuenta, IP, dispositivo y uso;
  usa cookies y Google Analytics en su sitio. Servicios alojados en EE. UU.
  Fuente: https://typesafe.ai/legal/privacy-policy
- [V] Conservación: "por el tiempo razonablemente necesario" para prestar el servicio (no fija plazo). La retención
  cero (ZDR) directa es solo para clientes enterprise. Fuentes: privacy policy y https://docs.typesafe.ai/legal.md
- [V] DPA: TypeSafe actúa como encargado (processor); notificación de incidentes en 72 h; subprocesadores listados en
  su trust center. Fuente: https://typesafe.ai/legal/data-processing
- [V] Mismo peso de modelo para todas las cuentas; no se adapta con datos del cliente. Fuente: models.md
- [T] Acceso: acceso anticipado con consola en console.typesafe.ai; un reporte indica que el 2026-09-20 se abrió a
  todos con USD 5 de crédito y el 2026-09-22 se pausaron registros por demanda. **Verificar estado actual.**
  Fuente: https://www.firecrawl.dev/blog/what-is-jev

Implicación para nosotros [S]: si usamos Jev vía Cloudflare Workers AI (que ya es nuestro backend), obtenemos ZDR sin
plan enterprise y evitamos depender de la pausa de registros. Verificar cómo se factura en Workers AI (cuota gratuita
vs pago por token) antes de afirmarlo en el board.

## 5. Qué datos enviaría nuestro proyecto

| Tarea candidata | Datos enviados | Datos personales |
|---|---|---|
| Clasificar tema / alcance / importancia al publicar | Título, entradilla, extracto de la noticia | No |
| Marcar sensacionalismo del título | Título + entradilla | No |
| Relevancia de pasajes recuperados para el chat | Pregunta del usuario + extractos | La pregunta puede contener datos personales → minimizar: no enviar uid, nombre ni ubicación exacta |
| Ruteo de intención del chat | Pregunta del usuario | Igual que arriba |

## 6. Mapa inicial LLM / JEV / CODE para este proyecto (hipótesis para el laboratorio)

| Función | Elección | Justificación breve |
|---|---|---|
| Orden del feed y puntaje | CODE | Aritmética exacta, explicable, costo 0; Jev falla en números |
| Proximidad geográfica | CODE | Reglas sobre catálogos |
| Tema de la noticia | JEV (Choice) | Conjunto cerrado de temas; tarea de clasificación típica |
| Alcance geográfico | JEV (Choice) + CODE | Choice para scope; países extraídos por coincidencia con catálogo en código |
| Importancia sugerida | JEV (Score, 4 niveles) | Rúbrica ordenada; el humano confirma |
| Sensacionalismo del título | JEV (Noul) | Sí/no con probabilidad umbralizable |
| ¿Afirmación necesita fuente? | LLM extrae afirmaciones → JEV (Noul por afirmación) | Jev no genera; decide sobre candidatos |
| Ruteo de intención del chat | JEV (Choice) o CODE | Comparar contra reglas actuales |
| Relevancia de pasajes antes de responder | JEV (Noul por pasaje) | Cookbook oficial "Classifying RAG passages" |
| Verificar que una cita respalda la frase | JEV (Choice) | Cookbook oficial "Double-checking citations" |
| Respuesta del chat, resumen, digest | LLM | Requiere generación de texto |
| Certeza de la noticia | Humano | Decisión editorial; ninguna IA |

Cookbooks oficiales relevantes: https://docs.typesafe.ai/cookbooks/classifying_rag_passages.md y
https://docs.typesafe.ai/cookbooks/citation_check.md.

## 7. Cómo encaja en la arquitectura

El gateway resuelve proveedor por tarea (`AiTask`). Agregar Jev = nuevo proveedor `typesafe` (o `workers-ai` con
modelo `typesafe/jev`) y apuntar tareas de clasificación a él. El ledger ya registra costo y latencia por tarea, así que
la comparación LLM vs Jev para el laboratorio sale de los mismos datos. Esto **no** es parte obligatoria del Proyecto 2.

## 8. Falta verificar

- Estado actual de registro en TypeSafe y crédito gratuito.
- Facturación de `typesafe/jev` en Workers AI y si entra en la cuota gratuita.
- Precisión real en español con 20–30 noticias etiquetadas a mano.
- Latencia medida desde Guatemala.
