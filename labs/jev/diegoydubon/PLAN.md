# Laboratorio: Rediseño del Proyecto 2 con Jev — Plan en 2 partes

Actividad en pareja del curso Responsible AI. Producto analizado: **AI Assisted News App** (Proyecto 2).
Entregables: **(1) un board visual** en una sola vista (Miro o FigJam) y **(2) un prototipo interactivo** de 3 a 5
pantallas en Figma o Framer. No se integra la API de Jev ni se modifica el backend; las respuestas del prototipo se simulan.

## 0. Cómo se evita la codependencia

Este documento **congela de antemano** las decisiones que ambas partes necesitan (flujo, usuario, matriz inicial,
flujo propuesto, estados de la interfaz y textos). Con eso:

- **Parte A** (investigación y análisis) valida esas decisiones contra las fuentes y llena sus zonas del board.
- **Parte B** (experiencia y prototipo) diseña las pantallas a partir de las mismas decisiones y llena sus zonas del board.

Nadie espera a nadie. Si la investigación de A contradice una decisión congelada, A **no cambia el contrato**: lo anota
en `CAMBIOS.md` (§6) y se resuelve en la integración final, que es la única sesión conjunta (≈ 1 h).

| | Parte A — Investigación y análisis | Parte B — Experiencia y prototipo |
|---|---|---|
| Responsable | | |
| Produce | Respuestas de investigación, matriz completa, medidas de Responsible AI, conclusión, fuentes | Flujo actual con Design Thinking, flujo propuesto con datos que salen, prototipo con anotaciones |
| Zonas del board | 2, 4, 5 | 1, 3 |
| Herramientas | Navegador, documentación oficial, Miro | Figma (o Framer), Miro |

## 1. Contrato congelado (ambas partes lo usan tal cual)

### 1.1 Flujo elegido

**Consulta sobre noticias en el chat** (pantalla inicial de la app). Es donde más funciones distintas conviven
(clasificar, recuperar, verificar, redactar) y donde el usuario ve directamente el efecto de cada decisión.

### 1.2 Usuario y necesidad

- **Usuario:** lector de la app, en una ubicación simulada (p. ej. Ciudad de Guatemala), que pregunta en español
  cotidiano, a veces con expresiones locales.
- **Necesidad:** entender rápido qué pasa en su zona o en otro país **y saber cuánto puede confiar** en la respuesta.
- **Punto del flujo a mejorar:** entre "recupero noticias" y "respondo". Hoy el sistema decide con un umbral fijo de
  similitud: a veces responde con noticias que no contestan la pregunta y a veces se abstiene sin explicar por qué.
  Además, cada respuesta pasa por un LLM aunque la decisión previa sea solo de clasificación.

### 1.3 Flujo actual (Proyecto 2)

1. Pregunta del usuario + ubicación simulada.
2. Intención detectada con reglas de código.
3. Embedding de la pregunta y búsqueda por similitud en las noticias publicadas.
4. Si el mejor puntaje < umbral fijo → abstención genérica.
5. Si no → 1 llamada al LLM que redacta y cita.
6. Código valida que las citas estén entre las noticias recuperadas y hereda la certeza de la base de datos.

### 1.4 Matriz inicial por función (Parte A la valida y completa los impactos)

| # | Función | Elección | Justificación breve |
|---|---|---|---|
| F1 | Detectar intención (resumen, mi región, otro país, tema) | CODE, con JEV Choice como respaldo si las reglas no reconocen la frase | Conjunto cerrado de opciones; las reglas son gratis y explicables, Jev cubre frases que las reglas no entienden |
| F2 | Detectar país o región mencionado | CODE | Coincidencia contra catálogo de países y gentilicios; Jev es literal y no aporta sobre una lista exacta |
| F3 | Recuperar noticias candidatas | CODE (embeddings + similitud) | Cálculo numérico; Jev no es calculadora |
| F4 | ¿Este pasaje responde la pregunta? | JEV Noul por pasaje | Reemplaza el umbral fijo por un juicio por pasaje; hay cookbook oficial de clasificación de pasajes RAG |
| F5 | Decidir abstenerse o responder | CODE sobre las probabilidades de F4 | Regla auditable con umbrales visibles |
| F6 | Redactar la respuesta | LLM | Requiere generar texto; Jev no genera |
| F7 | ¿La cita respalda la frase? | JEV Choice | Verificación barata posterior al LLM; hay cookbook oficial de verificación de citas |
| F8 | Certeza de la noticia (confirmada, en desarrollo…) | CODE (heredada de la base de datos, decidida por un humano) | Ningún modelo decide si algo es cierto |
| F9 | Mensajes de incertidumbre y salidas | CODE | Textos fijos y predecibles |

### 1.5 Flujo propuesto (Parte B lo dibuja; Parte A lo usa en la conclusión)

1. Pregunta + ubicación → **F1/F2 código** (Jev Choice solo si las reglas no clasifican).
2. **F3 código**: top 6 noticias candidatas.
3. **F4 Jev Noul** sobre cada pasaje: "¿Este texto responde la pregunta del usuario?".
4. **F5 código**, umbrales de trabajo (supuestos a calibrar, marcarlos así en el board):
   - Algún pasaje con probabilidad ≥ 0.70 → responder con esos pasajes.
   - Mejor pasaje entre 0.40 y 0.70 → **estado de incertidumbre** (pantalla 4).
   - Todos < 0.40 → **abstención con alternativa** (pantalla 5), sin llamar al LLM.
5. **F6 LLM** redacta solo con los pasajes aceptados.
6. **F7 Jev Choice** verifica cada cita; una cita no respaldada se elimina y la frase se marca "sin verificar".
7. **F8/F9 código**: certeza heredada, chips y textos finales.

### 1.6 Datos que salen del sistema

| Destino | Qué se envía | Qué **no** se envía |
|---|---|---|
| Jev (vía Cloudflare Workers AI, marcado como retención cero) | Pregunta del usuario + extractos de noticias publicadas | uid, nombre, correo, ubicación simulada exacta, historial |
| LLM (Anthropic) | Pregunta + pasajes aceptados | Lo mismo que arriba |
| Ninguno | Certeza, intereses, eventos del usuario | Se quedan en nuestra base de datos |

### 1.7 Pantallas del prototipo (Parte B)

Datos simulados coherentes: ubicación "Ciudad de Guatemala"; noticia en desarrollo "Alerta por lluvias intensas en
Quetzaltenango"; noticia confirmada internacional "Banco central europeo mantiene tasas".

| # | Pantalla | Qué debe mostrar |
|---|---|---|
| P1 | Chat inicial | Ubicación simulada visible, 4 sugerencias tocables, aviso "Esta conversación no se guarda" |
| P2 | Respuesta (recorrido principal) | Bloques con chips de fuente, chip de certeza heredado ("En desarrollo"), marca "Cita verificada" por cita, pie "Respuesta generada con IA a partir de N noticias" |
| P3 | "¿Cómo se generó?" | Pasos con su responsable: Código / Jev / LLM; pasajes aceptados y descartados con su probabilidad; tiempo y costo aproximados (simulados) |
| P4 | Estado de incertidumbre | Texto: "Encontré noticias relacionadas, pero no estoy seguro de que respondan tu pregunta." Salidas: **Ver las noticias encontradas**, **Reformular**, **Responder de todas formas** (con advertencia) |
| P5 | Abstención / error | Texto: "No encontré noticias publicadas sobre eso." Salidas: **Ver lo más reciente de mi zona**, **Probar otra pregunta**. Variante de error de red con **Reintentar** |

### 1.8 Riesgo de sesgo elegido

La documentación oficial de Jev indica que el inglés es su idioma principal y que otros idiomas funcionan peor.
**Riesgo:** preguntas en español guatemalteco coloquial podrían clasificarse peor, haciendo que el chat se abstenga o
dude más con justo los usuarios a los que sirve la app (exclusión). **Medida concreta:** cuando Jev cae en la zona
dudosa, el sistema no castiga al usuario: muestra P4 con salidas y permite "Responder de todas formas"; además se
define una prueba con frases locales antes de activar Jev (documentar como pendiente de verificar).

## 2. Parte A — Investigación y análisis

### A1. Verificar fuentes (punto 1 de la tarea)
Partir de `docs/research/JEV.md` y **abrir cada fuente original**; actualizar fecha de revisión. Prioridad:
- https://docs.typesafe.ai/introduction · https://docs.typesafe.ai/api.md · https://docs.typesafe.ai/models.md
- https://docs.typesafe.ai/model-jaggedness/jev-1.13.md (límites)
- https://typesafe.ai/legal/privacy-policy · https://typesafe.ai/legal/data-processing · https://docs.typesafe.ai/legal.md
- https://developers.cloudflare.com/ai/models/typesafe/jev/
- Cookbooks: https://docs.typesafe.ai/cookbooks/classifying_rag_passages.md y https://docs.typesafe.ai/cookbooks/citation_check.md
- Pendientes: estado actual de registro en TypeSafe; cómo se cobra Jev en Workers AI.

Entregar respuestas breves a las 3 preguntas (qué resuelve Jev y sus límites; qué datos enviaríamos y qué dicen las
políticas sobre uso, telemetría, conservación y entrenamiento; evidencia de velocidad, costo y recursos), con cada
afirmación marcada **[V] verificado · [P] afirmación del proveedor · [T] tercero · [S] supuesto propio**.

### A2. Completar la matriz (Lean Thinking)
Para F1–F9, llenar en una tabla: elección, justificación, e impacto en **UX, privacidad, velocidad, costo, recursos y
funcionalidad** (una palabra o frase corta por celda, con flecha ↑ ↓ = respecto al flujo actual). Añadir una fila
resumen: qué llamadas al LLM se evitan (abstenciones decididas antes del LLM) y qué se gana o pierde.
Si una elección del contrato no se sostiene con las fuentes, no la cambies en la matriz: anótala en `CAMBIOS.md`.

### A3. Responsible AI
Una tarjeta por tema:
- **Datos mínimos** (usar §1.6).
- **Comunicación de límites e incertidumbre** (qué ve el usuario en P2, P4 y P5).
- **Decisión incorrecta:** qué pasa si Jev descarta un pasaje correcto (falsa abstención → salida "Ver las noticias
  encontradas") o acepta uno incorrecto (F7 elimina la cita no respaldada; la certeza nunca la decide un modelo).
- **Sesgo/exclusión y medida** (§1.8).

### A4. Conclusión y fuentes
5–6 líneas sobre la arquitectura propuesta (híbrida: código decide, Jev clasifica, LLM redacta, humano certifica),
lista de enlaces y caja **"Supuestos y falta verificar"** (umbrales, precisión en español, latencia desde Guatemala,
facturación en Workers AI, estado de registro).

**Done de la Parte A:** zonas 2, 4 y 5 del board completas; toda afirmación con etiqueta [V]/[P]/[T]/[S] y enlace;
`CAMBIOS.md` actualizado (aunque sea con "sin cambios").

## 3. Parte B — Experiencia y prototipo

### B1. Flujo actual con Design Thinking (zona 1 del board)
Diagrama de §1.3 con: usuario, necesidad y el punto de dolor señalado (§1.2). Incluir un ejemplo concreto de pregunta
que hoy sale mal (p. ej. "¿qué onda con las lluvias en Xela?").

### B2. Flujo propuesto y datos (zona 3 del board)
Diagrama de §1.5 con cada paso coloreado por responsable (Código / Jev / LLM / Humano), las tres ramas de F5 y la
tabla de §1.6 junto al diagrama. Explicar en 2 líneas qué cambia para el usuario y cómo se mantiene el valor.

### B3. Prototipo
- Pantallas P1–P5 de §1.7, enlazadas: recorrido principal P1 → P2 → P3, y recorridos alternos P1 → P4 y P1 → P5.
- Cada salida de P4 y P5 debe llevar a algún lado (aunque sea a P1 o a una lista simulada).
- Anotaciones breves en cada pantalla: qué decisión técnica produce lo que se ve (p. ej. "Chip 'Cita verificada':
  Jev Choice confirmó la cita").
- Etiquetas visibles de origen: todo lo generado por IA dice que lo es.
- Punto de inicio marcado y enlace con permiso de lectura.

**Done de la Parte B:** zonas 1 y 3 del board completas; prototipo navegable sin explicación oral; enlace probado en
una ventana de incógnito.

## 4. Board: una sola vista

| Zona | Contenido | Dueño |
|---|---|---|
| 1 | Flujo actual, usuario y necesidad | B |
| 2 | Matriz LLM / JEV / CODE con impactos | A |
| 3 | Flujo propuesto y datos que salen | B |
| 4 | Medidas de Responsible AI (datos mínimos, incertidumbre, error, sesgo) | A |
| 5 | Conclusión, fuentes, supuestos y lo que falta verificar | A |

Crear el board con las 5 zonas vacías **antes** de empezar (cualquiera de los dos, 5 minutos). Cada quien trabaja solo
en sus zonas. Textos breves; nada de párrafos largos.

## 5. Integración final (única sesión conjunta, ≈ 1 h)

1. Revisar `CAMBIOS.md` y decidir cada propuesta: aceptar (B ajusta la pantalla o el diagrama afectado) o mantener el
   contrato y dejarlo como supuesto en la zona 5.
2. Coherencia: cada riesgo de la zona 4 tiene una respuesta visible en el prototipo; cada fila de la matriz aparece en
   el flujo propuesto.
3. Permisos de lectura del board y del prototipo; punto de inicio identificado.
4. Exportar el board a PDF legible como respaldo.
5. Entrega única con: nombres de los dos, identificación del equipo y nombre del Proyecto 2 ("AI Assisted News App"),
   enlace o PDF del board y enlace del prototipo.

## 6. `CAMBIOS.md` (solo lo escribe la Parte A)

```
| # | Decisión del contrato | Qué dice la fuente | Enlace | Propuesta | Resuelto en integración |
```
