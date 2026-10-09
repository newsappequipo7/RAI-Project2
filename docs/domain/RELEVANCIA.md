# Relevancia, jerarquía y anti-burbuja

Implementación: `packages/shared/src/ranking/`. Función pública única:

```ts
rankFeed(input: {
  news: News[];                 // publicadas dentro de la ventana + todas las esenciales vigentes
  profile: UserProfile;
  locationId: string;
  now: Date;
  weights?: RankingWeights;     // default en config/public
}): RankedFeed
```

```ts
interface RankedItem {
  news: News;
  score: number;                // [0,1]
  components: { importance: number; proximity: number; affinity: number; recency: number; penalties: number };
  tier: 'hero' | 'grande' | 'mediana' | 'compacta';
  reasons: Reason[];            // para "¿Por qué veo esto?"
  guaranteedBy?: 'esencial' | 'cuota_nacional' | 'cuota_internacional';
}
interface RankedFeed {
  mustKnow: RankedItem[];       // todas las esenciales; la UI muestra 5 + "ver todas"
  feed: RankedItem[];           // resto, ordenado y con tiers
  diversity: { topics: number; scopes: Record<GeoScope, number> };  // para métrica anti-burbuja
}
```

Función pura y determinista: mismas entradas → misma salida. Sin llamadas de red.

Contrato implementado en F3-02: tipos en `types.ts` y esquemas zod `rankingWeightsSchema`,
`rankedItemSchema`, `rankedFeedSchema` y `publicFeedConfigSchema` en `schemas.ts`.
`Reason = { code, text, contribution }`; `code` es una clave del catálogo de §6 y `contribution` está en [0,1].
En F3-02 `reasons` es un arreglo vacío: su generación y las condiciones de §6 corresponden a F3-03.

La capa de datos (F3-01) entrega noticias únicas por ID, ya filtradas por la ventana configurable. El motor
excluye además borradores, retractadas y fechas de publicación ausentes, inválidas o futuras. No aplica otra
ventana al feed regular: permite ampliar la ventana por configuración sin perder esas noticias al ordenar.
Rechaza ubicación simulada desconocida, `now` inválido y pesos explícitos inválidos.

## 1. Separar importancia de relevancia

- **Importancia** (propiedad de la noticia, igual para todos): la confirma un editor (0–3). La IA solo la sugiere.
- **Relevancia** (propiedad de la pareja noticia–usuario): se calcula con proximidad, afinidad y recencia.

## 2. Componentes (todos normalizados a [0,1])

**Importancia** `I = importance / 3`.

**Proximidad** `G` según la ubicación simulada del usuario (`loc`) y `news.geo`:

| Condición (se toma la primera que se cumple) | G |
|---|---|
| `scope == 'local'` y `loc.cityId ∈ cityIds` | 1.00 |
| `scope == 'local'`, mismo país, otra ciudad | 0.45 |
| `scope == 'global'` | 0.60 |
| `loc.country ∈ countries` | 0.75 |
| `loc.region ∈ regions` | 0.40 |
| `scope == 'internacional'` sin coincidencia | 0.20 |
| resto | 0.10 |

**Afinidad** `A`: promedio de `interests[t] / 10` sobre los temas de la noticia; si el usuario no tiene intereses aún,
`A = 0.3` (neutral). Si algún tema está en `mutedTopics`, `A = 0`.

**Recencia** `R = 0.5 ^ (horasDesdePublicación / vidaMedia)`, con `vidaMedia = 18 h` (24 h si importancia ≥ 2).

**Penalizaciones** `P`: ya leída → multiplicar score por 0.35; `certainty == 'retractada'` → excluida del feed
(aparece solo en la sección de correcciones).

## 3. Puntaje

`score = (wI·I + wG·G + wA·A + wR·R) · multiplicadores`

Pesos default (`config/public.rankingWeights`): `wI = 0.35, wG = 0.30, wA = 0.20, wR = 0.15`.
Con `profile.personalization = false`: `wA = 0` y se redistribuye proporcionalmente (modo "ver sin personalizar").

También se ignoran silenciados e historial de lectura: de lo contrario la penalización por leída contradice
la prueba 6. La afinidad neutral reportada es 0.3, con contribución ponderada cero.

Cada peso debe ser finito y estar en [0,1]; `wI + wG + wR > 0` para que el modo sin personalización sea válido.
Se normaliza la suma antes de calcular el puntaje. `resolvePublicFeedConfig(snapshot.data())` valida los campos
independientemente y usa defaults para los ausentes/inválidos (72 h, pesos anteriores, `demoMode=false`).
El helper no consulta Firestore: F3-01 y el comparador le pasan el documento y luego `rankingWeights` a `rankFeed`.
Los componentes reportados son valores sin ponderar; `components.penalties` es el multiplicador 1 o 0.35.
Desempates: puntaje descendente, publicación descendente, ID ascendente por código de caracteres (sin locale).

Justificación de los pesos para la presentación: importancia y proximidad dominan (lo que la persona **debería**
saber), la afinidad solo desempata dentro de lo relevante. La afinidad nunca puede superar a la importancia: una
noticia esencial con afinidad 0 siempre supera a una rutina con afinidad 1 en la misma zona.
Esa propiedad es una prueba automática (ver §8), bajo pesos default, misma recencia y sin penalización de lectura.
Pesos personalizados pueden cambiar esa comparación numérica; no alteran la inclusión del bloque esencial.

## 4. Reglas anti-burbuja (se aplican en este orden)

1. **Lo que debes saber (no personalizado):** toda noticia `importance == 3` con `G ≥ 0.40` o `scope == 'global'`,
   publicada en las últimas 72 h, va a `mustKnow` ordenada por recencia. No depende de intereses ni de silenciados.
   La salida conserva **todas** para no perder esenciales. La UI muestra máximo 5 y, si hay más, "ver todas"
   (`MUST_KNOW_PREVIEW_LIMIT`). La ventana esencial es siempre 72 h, inclusive, independiente de la del feed.
   Sus componentes y puntajes también se calculan sin personalización; desempates por ID. No se duplican en `feed`.
2. **Cuotas en los primeros 10 del feed:** al menos 1 noticia nacional (`loc.country ∈ countries`) y al menos
   1 internacional (sin coincidencia de país). Si no entran por puntaje, se promueve la mejor de cada tipo a las
   posiciones 5 y 8 respectivamente y se marca `guaranteedBy`.
3. **Diversidad de temas:** no más de 2 noticias consecutivas con el mismo tema principal cuando el conjunto
   lo permite. Se reordena de forma voraz, conservando separadores para el resto y ambas cuotas del top 10.
   La diversidad puede mover las posiciones de promoción iniciales, pero conserva su marca `guaranteedBy`.
   Si los temas disponibles hacen imposible evitar triples (por ejemplo, solo existe un tema), se conservan
   todas las noticias y se priorizan las cuotas disponibles: no se ocultan noticias para aparentar diversidad.
4. **Silenciar no oculta lo esencial:** `mutedTopics` baja la afinidad pero nunca saca una noticia de `mustKnow`.

La cuota nacional se determina por coincidencia de país (también puede cubrirla una noticia local o regional);
la internacional es la ausencia de coincidencia (incluye globales fuera del bloque esencial).
`diversity` mide solo las primeras 10 de `feed`: temas distintos incluyendo secundarios y conteos por el
`geo.scope` original; no suma `mustKnow` ni renombra los alcances para contar cuotas.

## 5. Jerarquía visual (tiers)

| Posición en `feed` | Tier | Presentación (referencia conceptual: portadas tipo Marca, adaptadas a móvil) |
|---|---|---|
| 1 | `hero` | Imagen a ancho completo, título grande, entradilla, chips de certeza y alcance |
| 2–3 | `grande` | Tarjeta con imagen 16:9 y título mediano, en columna |
| 4–9 | `mediana` | Fila con miniatura cuadrada a la izquierda |
| 10+ | `compacta` | Solo título + metadatos, lista densa |

Ajuste: si una noticia en posición 2–9 tiene `score ≥ 0.85`, sube a `grande` aunque esté más abajo (máximo 3 grandes).
Las noticias `en_desarrollo` muestran siempre un borde o chip "En desarrollo" independientemente del tier.

## 6. "¿Por qué veo esto?"

`reasons` se genera por código a partir de los componentes (nunca por LLM). Catálogo:

| Condición | Texto |
|---|---|
| `guaranteedBy == 'esencial'` | "Información esencial para tu zona: se muestra a todas las personas" |
| G = 1.00 | "Ocurre en tu ciudad ({ciudad})" |
| G = 0.75 | "Afecta a tu país ({país})" |
| G = 0.40 | "Es relevante para tu región ({región})" |
| G = 0.60 | "Tiene alcance global" |
| A ≥ 0.6 | "Sueles leer sobre {tema}" |
| `guaranteedBy == 'cuota_internacional'` | "Para que no te pierdas lo que pasa fuera de tu país" |
| `guaranteedBy == 'cuota_nacional'` | "Para que no te pierdas lo que pasa en tu país" |
| R ≥ 0.8 | "Publicada hace poco" |
| importance ≥ 2 | "El equipo editorial la marcó como importante" |

El panel muestra además barras simples con la contribución de cada componente y un botón "Menos de esto".

## 7. Aprendizaje de intereses (determinista)

Actualización de `interests[tema]` (acotado a [0, 10]) para cada tema de la noticia:

| Señal | Δ |
|---|---|
| `open` | +0.5 |
| `dwell` ≥ 20 s | +1.0 |
| `more_like_this` | +2.0 |
| `less_like_this` | −3.0 y agrega el tema a `mutedTopics` si queda en 0 |
| `chat_topic` (tema detectado en la pregunta del chat) | +0.5 |

Decaimiento diario: `interests[t] *= 0.9` aplicado al abrir la app si pasó ≥ 1 día desde `updatedAt`.
El usuario puede ver y reiniciar sus intereses en Perfil ("Esto es lo que la app cree que te interesa").

## 8. Pruebas obligatorias (`packages/shared/src/ranking/*.test.ts` y `evals/ranking-personas.test.ts`)

Personas de prueba: `gt-guatemala` interesado en deportes, `gt-quetzaltenango` sin historial, `mx-cdmx` interesado en
tecnología que silenció política, `es-madrid` interesado en economía. Corpus fijo: `packages/shared/fixtures/news.json`.

Propiedades que deben cumplirse (cada una es un test):
1. Una noticia esencial de GT aparece en `mustKnow` para ambas personas de GT aunque tengan política silenciada.
2. Una noticia esencial global aparece en `mustKnow` para las 4 personas.
3. Esencial con afinidad 0 supera a rutina con afinidad 1 en la misma zona.
4. Los primeros 10 del feed tienen ≥ 1 nacional y ≥ 1 internacional para cada persona (si el corpus los tiene).
5. Nunca hay 3 consecutivas con el mismo tema principal.
6. Con `personalization = false`, dos personas en la misma ubicación obtienen exactamente el mismo orden.
7. Una noticia `local` de Quetzaltenango queda más arriba para la persona de Quetzaltenango que para la de la capital.
8. Retractadas nunca aparecen en `feed` ni `mustKnow`.
9. Determinismo: dos ejecuciones con las mismas entradas producen el mismo resultado.

Estas pruebas son la evidencia principal para la pregunta "¿Cómo evita que una preferencia o ubicación oculte
información importante?".
