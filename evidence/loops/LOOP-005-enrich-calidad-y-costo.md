# LOOP-005 — Calidad del prompt `enrich.v1` y costo medio de `enrich`
2026-10-02 (hora de Guatemala; el ledger lo registra el 2026-10-03 UTC) · Diego · Tareas: F2-04

## Comprensión
`POST /admin/enrich` sugiere temas, alcance, importancia, afirmaciones verificables, resumen y alerta de
sensacionalismo para una noticia. La IA solo sugiere: nada cambia hasta que la persona acepta cada campo y la certeza
la decide siempre un humano. El costo por noticia se estimó en `docs/ops/PRESUPUESTO-IA.md` §3 con supuestos
(≈ 1 500 tokens de entrada, ≈ 500 de salida, ≈ USD 0.0040 por llamada, 80 noticias ≈ USD 0.32).

## Hipótesis
- Con Haiku 4.5 y `enrich.v1` (`temperature = 0`, salida JSON corta), la salida cumple las reglas del portal: 1 a 3
  temas del catálogo, máximo 8 afirmaciones que aparecen en el texto, resumen de máximo 2 oraciones sin datos nuevos.
- El costo medio queda cerca de USD 0.004 por llamada y el ledger coincide con la consola de Anthropic.
- Repetir la misma noticia sin cambios sale de caché con costo USD 0.

## Construcción
PR #9 (`fase-2/f2-04-enrich`, merge `8b21328`): `b7e9a65` (endpoint, prompt versionado, normalización y caché) y
`ab4a49d` (panel "Asistente de IA" y tabla de auditoría en el editor). La caché usa la versión del prompt, el modo de
IA y un hash de título, entradilla y cuerpo. Para la prueba se desplegó el Worker en live de forma temporal
(`wrangler deploy --var AI_MODE:live`, versión `8a6baa84…`) y se devolvió a mock al terminar (versión `3b0873b8…`).

## Prueba y observación
Cinco noticias semilla distintas, sin guardar nada en Firestore (siempre Cancelar).

**Costo** (ledger y consola, 2026-10-03 UTC):

| Medida | Valor |
|---|---|
| Llamadas del ledger antes → después | 28 → 35 (5 pagadas + 2 cacheadas) |
| Gasto de `enrich` según ledger | USD 0.0159 (total del ledger 0.0160) |
| Costo medio por llamada pagada | USD 0.003183 |
| Costos individuales conocidos | sismo 0.003928, Haití 0.003283, cumbre 0.002793, cifras 0.002656; cierres viales ≈ 0.0032 por diferencia |
| Tokens en Console (3 oct) | 6 810 de entrada, 1 821 de salida |
| Costo recalculado de Console (USD 1 / 5 por millón) | USD 0.0159 |
| Diferencia ledger vs Console | menos de 1 % |
| Saldo en Console | USD 19.98 (antes 20.00) |
| Tokens medios por llamada | ≈ 1 362 de entrada, ≈ 364 de salida (estimado: 1 500 / 500) |

El costo real es ≈ 20 % menor que el estimado de USD 0.0040. Proyección a 80 noticias: ≈ USD 0.25.

**Caché (CA2):** la repetición del sismo y la de cierres viales respondieron al instante con costo USD 0.000000 y
contenido idéntico; las cacheadas pasaron de 0 a 2.

**Calidad por noticia:**

| Noticia | Temas | Alcance | Importancia (IA vs editorial) | Sensacionalismo |
|---|---|---|---|---|
| Sismo (nacional) | clima-desastres 95 %, seguridad 65 % | nacional, GT, centroamérica: coherente | 2 vs 3 | sin alerta, correcto |
| Cierres viales (local) | sociedad 70 % | local, GT, Ciudad de Guatemala: coherente | 1 vs 2 | sin alerta, correcto |
| Haití (internacional) | salud 95 %, sociedad 60 % | **nacional**, HT, caribe: no coincide con internacional | **3 vs 1** | sin alerta, correcto |
| Cumbre climática (global) | clima-desastres 95 %, economía 60 %, política 55 % | global: coherente | 2 vs 3 | sin alerta, correcto |
| Cifras de retornados (disputada) | migración 95 %, sociedad 60 % | nacional, GT, centroamérica: coherente | 1 vs 2 | sin alerta, correcto |

Cumplen las reglas: temas del catálogo (1 a 3), afirmaciones por debajo de 8 (6, 3, 4, 3 y 3), resúmenes de 2
oraciones, sin intento de fijar certeza y cero falsos positivos de sensacionalismo. En la disputada, el modelo no decide
quién tiene razón.

**Hallazgos de calidad:**
1. La importancia sugerida difiere de la editorial en las 5 noticias (−1 en cuatro, +2 en Haití). El modelo parece no
   ponderar la cercanía al lector.
2. Haití: devolvió alcance `nacional` para un hecho con organismos internacionales.
3. La cumbre recibió `clima-desastres` en lugar de `medio-ambiente`, que es lo que eligió el editor.
4. Pendiente de verificar contra el cuerpo (no se pudo comprobar en la conversación): "incluye financiamiento para la
   transición energética" y "organizaciones ambientales piden plazos más estrictos" (cumbre); "ambas partes explican
   metodologías diferentes" (retornados); "se pide a conductores planificar sus desplazamientos" (cierres viales).
   Si no están en el texto, son datos añadidos y violan la regla de resumen sin datos nuevos.

**Alerta del panel:** "Último saldo real" salió en rojo (diferencia mayor al 10 %) porque el saldo registrado (20.00)
es anterior al gasto. Con la comparación por tokens la diferencia es menor al 1 %. Registrar el saldo real 19.98 queda
**pendiente**; con un gasto de USD 0.016 el redondeo a centavos de la consola puede mantener la alerta en rojo, y eso
no indica un error del ledger.

## Corrección / decisión
- Mantener `enrich.v1` sin cambios: cumple las reglas estructurales y el costo está por debajo de lo presupuestado.
- Importancia: seguir tratándola como sugerencia que la persona decide. Probar en una versión siguiente
  (`enrich.v2`) darle al prompt la rúbrica de importancia por zona del lector. **Pendiente** de decidir; no se ha
  hecho ningún cambio de prompt.
- Alcance: revisar en `enrich.v2` la regla que distingue `nacional` de `internacional`. **Pendiente.**
- Verificar las cuatro afirmaciones del hallazgo 4 contra el cuerpo y, si fallan, endurecer la instrucción de "solo lo
  que está en el texto". **Pendiente.**
- Worker devuelto a mock tras la prueba; no se deja en live de un día para otro.
- No hay ADR nuevo: la decisión de modelo sigue siendo ADR-009.

## Rol de la IA en este loop
Claude Code desplegó el Worker en live y de vuelta a mock, y guio la prueba. Armó la selección de 5 noticias (local,
nacional, internacional, global y disputada), la tabla de revisión y la comparación ledger contra Console. La revisión
de calidad se hizo sobre capturas de pantalla, no contra el texto de cada cuerpo, y por eso el hallazgo 4 queda abierto.
Lo ejecutó y observó el usuario: las cinco sugerencias, la prueba de caché y las capturas de Costos y Console.
Errores propios: se desplegó Hosting una vez desde un `main` local desactualizado (dejó prod sin el trabajo de F2-09 hasta
redesplegar desde `origin/main`) y se creó un commit duplicado de un formulario que el equipo ya tenía en `/costs`; se
detectó al fallar el push y se resolvió con un reset autorizado por el usuario. El comando `pnpm -F api deploy` falló
por chocar con el comando interno de pnpm; el correcto es `pnpm -F api run deploy`. Claude Code no pudo comprobar que
el secret del proveedor existiera (la consulta fue bloqueada) y no usó la key del proyecto en ningún momento.
