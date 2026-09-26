# FASE 3 — App móvil: feed, lectura, personalización y comparador (Nelson · 5 – 8 oct)

> F3-02, F3-03 y la función pura de F3-08 se hacen como **trabajo previo** entre el 30 sep y el 4 oct
> (ver `docs/CRONOGRAMA.md` §3). Al iniciar la fase solo quedan la UI y la integración.

## Resumen

| | |
|---|---|
| Entra | Handoff F2: noticias reales publicadas con fuentes, certeza, geo, imágenes; login y perfil mínimos (F1) |
| Sale (demostrable) | Feed jerárquico por ubicación con "Lo que debes saber", tiers, "¿Por qué veo esto?", lectura con procedencia completa, aprendizaje de intereses, actualización en tiempo real y comparador de ubicaciones en el portal |
| Tope de gasto IA | USD 0.50 (esta fase no debería gastar: todo es código) |
| Fuera de alcance | Chat (F4) |

Recomendación: desarrollar el motor de ranking con pruebas primero (F3-02, F3-03), luego la UI.
Si se usa MobAI (ver IOS-ANDROID-DISTRIBUCION.md §4 `[PLUS]`), Claude Code puede navegar la app para verificar flujos.

---

### F3-01 — Capa de datos del feed
**Pasos:**
1. Hook `useNewsFeed()`: listener de Firestore de noticias publicadas con `publishedAt` dentro de la ventana
   (`config/public.feedWindowHours`, default 72) + consulta de esenciales (`importance == 3`) de las últimas 72 h; fusión
   sin duplicados.
2. Hook `useProfile()`: listener de `users/{uid}`.
3. Estados de carga, vacío y error con reintento.
**CA:** CA1: una noticia publicada desde el portal llega al hook en < 5 s sin recargar.

### F3-02 — Motor de ranking (TDD)
**Leer:** RELEVANCIA.md completo, ADR-002.
**Pasos:**
1. Escribir primero las 9 pruebas de RELEVANCIA.md §8 con el corpus fijo y las 4 personas.
2. Implementar `packages/shared/src/ranking/`: `proximity.ts`, `affinity.ts`, `recency.ts`, `score.ts`,
   `antibubble.ts` (esenciales, cuotas, diversidad), `tiers.ts`, `rankFeed.ts`.
3. Pesos por defecto y lectura de `config/public.rankingWeights`.
4. Métrica de diversidad en la salida.
**CA:** CA1: las 9 pruebas pasan. CA2: `rankFeed` sobre 200 noticias tarda < 20 ms en un teléfono de gama media
(medir en la app, registrar en evidencia).
**Evidencia:** reporte de pruebas (evidencia clave para la sección 7).

### F3-03 — Explicaciones ("¿Por qué veo esto?")
**Leer:** RELEVANCIA.md §6.
**Pasos:** `packages/shared/src/explain/reasons.ts` con el catálogo de textos; pruebas por cada condición; máximo 3
razones ordenadas por contribución.
**CA:** CA1: cada ítem del feed de las 4 personas tiene al menos 1 razón y ninguna razón contradice sus componentes.

### F3-04 — Pantalla de feed con jerarquía visual
**Leer:** RELEVANCIA.md §5.
**Pasos:**
1. Tokens de diseño en `apps/mobile/src/theme/` (tipografía, espaciado, colores de tema y de certeza, modo oscuro).
2. Componentes `MustKnowBlock` (carrusel horizontal con encabezado "Lo que debes saber · igual para todos en tu zona"),
   `HeroCard`, `LargeCard`, `MediumRow`, `CompactRow`.
3. Chips obligatorios en toda tarjeta: certeza (si no es `confirmada`), alcance ("Local", "Nacional", "Internacional"),
   tema; tiempo relativo.
4. Encabezado con ubicación activa y botón para cambiarla; pull-to-refresh (re-ranquea con `now` actual).
5. Identidad visual propia: el enunciado pide que no sea una lista indiferenciada; usar como referencia conceptual la
   jerarquía de portadas deportivas (tipo Marca) sin copiar su diseño.
**CA:** CA1: con el corpus semilla, las 4 personas ven feeds visiblemente distintos. CA2: ninguna tarjeta sin chips
requeridos. CA3: se ve bien en iPhone pequeño (SE) y Android grande.

### F3-05 — Imágenes y portada tipográfica en la app
**Leer:** IMAGENES.md §2 y §5.
**Pasos:**
1. Componente `CoverArt` que renderiza la portada desde `packages/shared/src/cover/spec.ts` (misma apariencia que el
   portal) con la leyenda fija.
2. Componente `NewsImage` con pie obligatorio por tipo y hoja de detalle al tocar (tipo, autor, licencia, origen,
   advertencia IA).
3. En tier `compacta`, ícono con tooltip en lugar de pie.
**CA:** CA1: cada tipo de imagen del corpus muestra su pie correcto; imposible renderizar una imagen sin pie (prueba de componente).

### F3-06 — Panel "¿Por qué veo esto?" y control del usuario
**Pasos:**
1. Botón "?" en cada tarjeta → hoja inferior con razones, barras de contribución por componente y botones
   "Más como esto" / "Menos de esto".
2. Registrar evento `why_opened` (sirve como métrica de transparencia).
**CA:** CA1: "Menos de esto" en un tema baja sus noticias en el siguiente render, excepto las de "Lo que debes saber".

### F3-07 — Vista de lectura con procedencia
**Leer:** VERIFICACION-Y-FUENTES.md §2, §4 y §6.
**Pasos:**
1. `news/[id].tsx`: imagen con pie, título, chips, banner según certeza (texto de `certaintyNote`), bloque "Actualizada"
   si hay correcciones, resumen IA con su chip (si existe), cuerpo markdown con citas estilizadas.
2. Sección fija "Cómo se hizo esta noticia": fuentes (nombre, organización, tipo, confirma/contradice, enlace, fecha),
   justificación de certeza, publicado por, qué sugirió la IA vs lo publicado, versiones.
3. Para `disputada`: vista lado a lado de lo que dice cada fuente.
4. Retractadas accesibles por enlace directo con banner rojo y contenido tachado.
**CA:** CA1: las 4 certezas del corpus se ven correctamente. CA2: todo elemento generado con IA tiene su etiqueta.

### F3-08 — Señales e intereses
**Leer:** RELEVANCIA.md §7.
**Pasos:**
1. `packages/shared/src/interests/update.ts` (pura, con pruebas): aplica deltas, límites [0,10], silenciado, decaimiento.
2. En la app: registrar `open` al entrar a lectura, `dwell` al salir con segundos (solo si ≥ 20 s), botones de F3-06.
3. Escribir eventos en `users/{uid}/events` y actualizar `interests` en el perfil (debounce, un write por sesión de lectura).
4. Pantalla Perfil: "Esto es lo que la app cree que te interesa" (barras por tema), botón "Reiniciar intereses",
   temas silenciados con opción de reactivar, toggle "Personalizar mi feed" (off = ver sin personalizar).
**CA:** CA1: pruebas de `update.ts` pasan. CA2: leer 3 noticias de deportes cambia visiblemente el orden medio del feed.
CA3: con el toggle apagado, dos cuentas en la misma ubicación ven el mismo orden.

### F3-09 — Cambio de ubicación en caliente
**Pasos:** al elegir otra ubicación, el feed se re-ranquea al instante (sin esperar red), el encabezado del chat se
actualiza y se muestra un aviso breve "Estás viendo noticias como si estuvieras en {ciudad}".
**CA:** CA1: el cambio se refleja en < 300 ms en el feed.

### F3-10 — Tiempo real y avisos
**Pasos:**
1. Si llega una noticia nueva que entra en los primeros 3 o en "Lo que debes saber", mostrar indicador "Nueva noticia"
   arriba; al tocarlo, desplazar arriba.
2. `[PLUS]` Si una noticia en `readNewsIds` recibe corrección/retractación, tarjeta "Una noticia que leíste fue corregida".
**CA:** CA1: publicar desde el portal hace aparecer el indicador en dos teléfonos en < 5 s.

### F3-11 — Comparador de ubicaciones (portal)
**Objetivo:** proyectar en la demo cómo cambia la misma noticia según la ubicación (secciones 4 y 7).
**Pasos:**
1. Ruta `/compare` en `apps/admin`, usando `rankFeed` de `shared` (mismo motor que la app).
2. Columnas = las 8 ubicaciones; perfil neutro por defecto; selector para cargar una de las 4 personas de prueba.
3. Filas = noticias publicadas; celda = posición, tier (color) y si está en "Lo que debes saber"; resaltar noticia
   seleccionada (p. ej. la recién publicada). Actualización en tiempo real.
4. Panel de diversidad por columna (temas distintos en top 10, conteo por alcance).
**CA:** CA1: el comparador y la app muestran la misma posición para la misma ubicación y perfil neutro.
CA2: publicar desde el portal actualiza el comparador sin recargar.

### F3-12 — Pulido, accesibilidad, evidencia y cierre
**Pasos:**
1. Modo oscuro, tamaño de texto dinámico, contraste AA en chips de certeza, estados vacíos con texto útil.
2. Videos de: feed en 3 ubicaciones, "¿Por qué veo esto?", lectura de las 4 certezas, cambio de ubicación, tiempo real.
3. Completar `docs/handoffs/FASE-3.md`, filas F3 en PLAN.md §6, `git tag fase-3-done`.
**CA:** CA1: Joaquín corre app y comparador siguiendo solo el handoff.
