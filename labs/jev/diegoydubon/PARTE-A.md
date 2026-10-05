# Parte A — Investigación y análisis (Jev × AI Assisted News App)

Revisión de fuentes: 2026-10-04. Etiquetas: **[V]** verificado en fuente oficial abierta hoy · **[P]** afirmación del
proveedor · **[T]** tercero · **[S]** supuesto propio. Textos cortos pensados para pegar en el board (zonas 2, 4 y 5).

---

## A1. Respuestas de investigación

### 1. ¿Qué resuelve Jev y cuáles son sus límites?

- **Resuelve:** decisiones rápidas y estructuradas. Recibe un `state` y preguntas tipadas (Choice, Score, Noul) y devuelve
  respuesta + probabilidades; cada pregunta se evalúa de forma independiente. [V] [introduction](https://docs.typesafe.ai/introduction)
- **Primitivas:** Choice (hasta 255 opciones), Score (2–10 niveles), Noul (sí/no con probabilidad). [V] [api](https://docs.typesafe.ai/api.md)
- **Encaja en nuestro flujo** en F1, F4 y F7: son clasificaciones sobre candidatos cerrados, y los cookbooks oficiales
  cubren F4 y F7. [V] [passages](https://docs.typesafe.ai/cookbooks/classifying_rag_passages.md) · [citas](https://docs.typesafe.ai/cookbooks/citation_check.md)
- **Límites oficiales** [V] [jev-1.13](https://docs.typesafe.ai/model-jaggedness/jev-1.13.md): lectura literal; no cuenta ni es
  calculadora; compara mal fechas; falla con dobles negaciones; un `state` grande con detalle irrelevante distrae; no trata
  el contenido como hostil (inyección posible); se inclina por la primera opción de un Choice; **no genera texto**.
- **Idioma:** inglés es el principal y donde la precisión es mejor; otros idiomas "no igual de bien"; piden probar. [V] [models](https://docs.typesafe.ai/models.md)
- **"No alucina"** significa no salirse del esquema; sí puede elegir una opción válida pero equivocada. [T] [Firecrawl](https://www.firecrawl.dev/blog/what-is-jev)
- **Contexto:** 64k tokens directo (32k para `state` + pregunta más larga); 32k en Workers AI. Solo texto. [V] [models](https://docs.typesafe.ai/models.md) · [Cloudflare](https://developers.cloudflare.com/ai/models/typesafe/jev/)

### 2. ¿Qué datos enviaríamos y qué dicen las políticas?

Envío (de `PLAN.md` §1.6): pregunta + extractos de noticias publicadas. No uid, nombre, correo, ubicación exacta ni historial. [S]

| Tema | Qué dice | Etiqueta |
|---|---|---|
| Entrenamiento | "We will not train or fine tune any AI/ML models on your prompts or other Input." Modelo "not trained on customer requests or responses". | [V] [privacidad](https://typesafe.ai/legal/privacy-policy) · [models](https://docs.typesafe.ai/models.md) |
| Conservación | "Por el tiempo razonablemente necesario" para prestar el servicio; sin plazo fijo. | [V] [privacidad](https://typesafe.ai/legal/privacy-policy) · [DPA](https://typesafe.ai/legal/data-processing) |
| Retención cero | TypeSafe la ofrece **a clientes enterprise**. Cloudflare marca `typesafe/jev` con "Zero Data Retention: Yes". Que la etiqueta de Cloudflare cubra a TypeSafe no está documentado en las fuentes que abrí. | [V] la oferta enterprise ([legal](https://docs.typesafe.ai/legal.md)); [P] la etiqueta de Cloudflare |
| Telemetría | Recoge datos de dispositivo, ubicación por IP y uso, cookies y Google Analytics en su sitio. No vende datos. | [V] [privacidad](https://typesafe.ai/legal/privacy-policy) |
| Terceros | Comparte con proveedores de servicio y analítica. | [V] [privacidad](https://typesafe.ai/legal/privacy-policy) |
| Rol y ubicación | Encargado (processor); incidentes en 72 h; objeción a nuevos subprocesadores en 15 días; transferencias con cláusulas contractuales tipo UE; alojado en EE. UU. | [V] [DPA](https://typesafe.ai/legal/data-processing) · [privacidad](https://typesafe.ai/legal/privacy-policy) |

Nota: la política cubre al cliente de TypeSafe. Si entramos por Cloudflare, el contrato intermedio es el de Cloudflare, que no revisé. [S]

### 3. Velocidad, costo y recursos

| Dato | Valor | Etiqueta |
|---|---|---|
| Precio | USD 0.042 / M tokens de entrada; salida gratis | [V] [models](https://docs.typesafe.ai/models.md) · [Cloudflare](https://developers.cloudflare.com/ai/models/typesafe/jev/) |
| Límites | 100K tokens/s y 80 solicitudes/s, ajustables sin aviso | [V] [models](https://docs.typesafe.ai/models.md) |
| Latencia | 70–500 ms extremo a extremo (titular del proveedor); prueba independiente: mediana 0.35 s por pasaje, detectó 6 de 7 defectos plantados frente a 7 de 7 de un modelo de frontera | [P] [Firecrawl](https://www.firecrawl.dev/blog/what-is-jev) como [T] |
| Exactitud | ~68 % en benchmark propio de 4 flujos, cerca de LLMs de gama media | [P] vía [DataCamp](https://www.datacamp.com/blog/system-one-models-jev) |
| Costo F4 estimado | 6 pasajes × ~500 tokens ≈ 3 000 tokens ≈ **USD 0.00013 por pregunta** | [S] cálculo propio |
| Facturación en Workers AI | La página de precios de Workers AI no menciona `typesafe/jev` ni si usa la cuota gratuita de 10 000 neurons/día | [V] que no está documentado; costo real **sin verificar** |
| Energía/recursos | TypeSafe no publica cifras. Solo se puede argumentar menos cómputo por decisión | [S] |

Acceso: registro directo abierto el 2026-09-20 con USD 5 de crédito; pausado el 09-22; reabierto el 09-27 **sin crédito
gratis** según agregadores. [T] débil; confirmar entrando a console.typesafe.ai. Alternativas: Workers AI (nuestro backend), Vercel AI Gateway, OpenRouter. [T] [Firecrawl](https://www.firecrawl.dev/blog/what-is-jev)

---

## A2. Matriz LLM / JEV / CODE (zona 2 del board)

Cada celda tiene dos señales independientes respecto al flujo actual (umbral fijo + 1 LLM por respuesta):
la **flecha** dice si el valor sube (↑) o baja (↓) y el **color** dice si eso mejora (🟢) o empeora (🔴); ⚪ = sin cambio.
En el board: flecha negra, fondo verde o rojo. Magnitudes de costo y velocidad son [S] salvo que se indique.

| # | Función | Elección | Justificación | UX | Privacidad | Velocidad | Costo | Recursos | Funcionalidad |
|---|---|---|---|---|---|---|---|---|---|
| F1 | Detectar intención | CODE + Jev Choice de respaldo | Conjunto cerrado; reglas gratis, Jev cubre frases raras | 🟢 ↑ frases entendidas | 🔴 ↑ datos que salen (solo en el respaldo) | 🔴 ↑ +~0.35 s solo en el respaldo [T] | ⚪ < USD 0.00001 | ⚪ | 🟢 ↑ |
| F2 | País/región mencionado | CODE | Catálogo y gentilicios; lista exacta | ⚪ | ⚪ nada sale | ⚪ | ⚪ 0 | ⚪ | ⚪ |
| F3 | Recuperar candidatas | CODE (embeddings) | Cálculo numérico; Jev no cuenta | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ |
| F4 | ¿Pasaje responde la pregunta? | JEV Noul por pasaje | Reemplaza umbral fijo por juicio por pasaje; cookbook oficial | 🟢 ↓ respuestas fuera de tema | 🔴 ↑ datos que salen: pregunta + extractos a un tercero (extractos públicos) | 🔴 ↑ ~0.35 s en total: las 6 llamadas van en paralelo, no 6 × 0.35 s [T][S] | 🔴 ↑ ~USD 0.00013 por pregunta | 🟢 ↓ cómputo respecto a un LLM por decisión [S] | 🟢 ↑ habilita rama de incertidumbre |
| F5 | Responder, dudar o abstenerse | CODE sobre F4 | Regla auditable con umbrales visibles | 🟢 ↑ explicable y con salida | ⚪ | ⚪ | 🟢 ↓ llamadas al LLM en ramas 2 y 3 | 🟢 ↓ tokens del LLM | 🟢 ↑ 3 ramas |
| F6 | Redactar respuesta | LLM | Genera texto; Jev no | ⚪ | ⚪ solo pasajes aceptados | ⚪ | 🟢 ↓ tokens (menos pasajes) | ⚪ | ⚪ |
| F7 | ¿La cita respalda la frase? | JEV Choice (+ chequeo de texto en código, ver CAMBIOS #1) | Verificación barata tras el LLM; cookbook oficial | 🟢 ↑ marca "Cita verificada" | 🔴 ↑ datos que salen: frase + pasaje a Jev | 🔴 ↑ +1 llamada tras el LLM (en paralelo entre citas) [S] | 🔴 ↑ costo pequeño | ⚪ | 🟢 ↑ elimina citas falsas |
| F8 | Certeza de la noticia | CODE (humano en BD) | Ningún modelo decide si algo es cierto | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ garantiza regla de oro 3 |
| F9 | Mensajes de incertidumbre y salidas | CODE | Textos fijos y predecibles | 🟢 ↑ siempre hay salida | ⚪ | ⚪ | ⚪ 0 | ⚪ | 🟢 ↑ |

**Fila resumen — llamadas al LLM:**
- **Se evitan:** ramas 2 (incertidumbre) y 3 (abstención con alternativa). Hoy basta superar un umbral de similitud para
  pagar una llamada al LLM aunque el pasaje no responda; con F4 esas llamadas no ocurren. En la rama 2 el LLM solo corre
  si el usuario elige "Responder de todas formas".
- **Cuánto:** no se puede cuantificar sin medir con preguntas reales. [S] Se medirá comparando el ledger de costos antes y después.
- **Se gana:** menos respuestas fuera de tema, citas verificadas, estados explicables, menos tokens al LLM.
- **Se pierde:** latencia extra (F4 y F7 suman llamadas), un proveedor nuevo con la pregunta del usuario, y dependencia de un
  modelo cuya precisión en español no está medida.

---

## A3. Responsible AI (zona 4 del board)

**Datos mínimos**
- Sale a Jev: pregunta + extractos de noticias ya publicadas. [S] diseño
- No sale: uid, nombre, correo, ubicación simulada exacta, historial. Certeza e intereses se quedan en nuestra base.
- Riesgo residual: la pregunta puede contener datos personales escritos por el usuario. Mitigación: aviso en P1 "Esta
  conversación no se guarda" y no enviar nada más que la pregunta actual.
- La política de TypeSafe no entrena con el Input [V], pero la conservación no tiene plazo fijo [V]; ZDR es etiqueta de Cloudflare [P].

**Comunicación de límites e incertidumbre**
- P2: chip de certeza heredado de la base ("En desarrollo"), "Cita verificada" por cita, pie "Respuesta generada con IA a partir de N noticias". Una frase sin verificar se marca "sin verificar".
- P4: "Encontré noticias relacionadas, pero no estoy seguro de que respondan tu pregunta." Tres salidas, entre ellas "Responder de todas formas" con advertencia.
- P5: "No encontré noticias publicadas sobre eso." con "Ver lo más reciente de mi zona" y "Probar otra pregunta".
- P3 muestra quién decidió cada paso (Código / Jev / LLM) y las probabilidades. Las probabilidades de Jev se muestran como señal, no como certeza: [T] puede elegir una opción válida pero equivocada.

**Decisión incorrecta**
| Error | Qué pasa | Defensa |
|---|---|---|
| Jev descarta un pasaje correcto (falsa abstención) | El usuario no recibe respuesta pese a existir la noticia | Salida "Ver las noticias encontradas" y "Responder de todas formas"; zona dudosa 0.40–0.70 no abstiene en silencio |
| Jev acepta un pasaje incorrecto | El LLM puede redactar con material que no responde | F7 elimina cita no respaldada; la frase queda "sin verificar" |
| Jev se equivoca en F7 | Cita buena eliminada o mala aceptada | Chequeo de texto en código antes de Jev (CAMBIOS #1); confianza < 0.8 no se acepta sola |
| Texto con instrucciones inyectadas | Jev no trata el contenido como hostil [V] | Los extractos los publica una persona; F5 y F7 son código; el cookbook propone una Noul de inyección (CAMBIOS #2) |
| Certeza de la noticia | Nunca la decide un modelo | F8 hereda el estado puesto por un humano |

**Sesgo y exclusión**
- Riesgo: preguntas en español guatemalteco coloquial se clasifican peor porque el inglés es el idioma principal de Jev. [V] [models](https://docs.typesafe.ai/models.md) El efecto es más abstenciones o dudas justo para los usuarios de la app.
- Medida 1: en la zona dudosa el sistema no castiga; muestra P4 con salidas y "Responder de todas formas".
- Medida 2: antes de activar Jev, probar con 20–30 preguntas locales ("¿qué onda con las lluvias en Xela?") comparando tasa de abstención de Jev contra el umbral actual. Aún **no hecha**.
- Medida 3: probar el Choice con orden de opciones invertido (Jev favorece la primera opción [V]).

---

## A4. Conclusión, fuentes, supuestos (zona 5 del board)

**Conclusión**
1. Arquitectura híbrida: el código decide y orquesta, Jev clasifica, el LLM redacta y un humano certifica.
2. Jev reemplaza solo dos decisiones donde un umbral fijo o una confianza ciega fallaba: si el pasaje responde (F4) y si la cita respalda (F7).
3. Lo que sube es pequeño en costo (centésimas de centavo por pregunta [S]) y visible en latencia (varias llamadas extra por respuesta).
4. Gana el usuario: menos respuestas fuera de tema, estados de duda con salida y citas verificadas. Pierde algo de privacidad al enviar la pregunta a un tercero.
5. La certeza sigue siendo humana: ningún modelo decide si una noticia es cierta.
6. La decisión de activarlo depende de medir precisión en español; sin esa prueba, la propuesta sigue siendo una hipótesis.

**Supuestos y falta verificar**
- Umbrales 0.40 / 0.70 y confianza 0.8: [S], calibrar con preguntas reales. El cookbook usa 0.45 y 0.55.
- Precisión en español guatemalteco: sin medir.
- Latencia desde Guatemala: sin medir; las cifras 70–500 ms y 0.35 s/pasaje no son nuestras.
- Facturación de `typesafe/jev` en Workers AI y cuota gratuita: no documentada.
- ZDR vía Cloudflare: etiqueta del distribuidor, sin contrato verificado.
- Estado actual de registro y crédito en TypeSafe: solo fuentes de terceros.
- Costo y ahorro de llamadas al LLM: estimados [S].
- Consumo de energía: sin cifras.

**Fuentes**
- [Introducción](https://docs.typesafe.ai/introduction) · [API](https://docs.typesafe.ai/api.md) · [Modelos](https://docs.typesafe.ai/models.md) · [Límites jev-1.13](https://docs.typesafe.ai/model-jaggedness/jev-1.13.md)
- [Privacidad](https://typesafe.ai/legal/privacy-policy) · [DPA](https://typesafe.ai/legal/data-processing) · [Legal](https://docs.typesafe.ai/legal.md)
- [Cloudflare typesafe/jev](https://developers.cloudflare.com/ai/models/typesafe/jev/) · [Precios Workers AI](https://developers.cloudflare.com/workers-ai/platform/pricing/)
- [Cookbook pasajes RAG](https://docs.typesafe.ai/cookbooks/classifying_rag_passages.md) · [Cookbook citas](https://docs.typesafe.ai/cookbooks/citation_check.md)
- [Firecrawl](https://www.firecrawl.dev/blog/what-is-jev) · [DataCamp](https://www.datacamp.com/blog/system-one-models-jev) · [Flavio Copes](https://flaviocopes.com/jev/) · [OpenRouter](https://openrouter.ai/provider/typesafe)
