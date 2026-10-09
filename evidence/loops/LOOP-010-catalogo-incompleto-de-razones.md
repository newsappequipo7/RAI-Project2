# LOOP-010 — El catálogo original no explica todas las noticias

Fecha: 2026-10-09 · Persona: Nelson (implementación asistida por Codex) · Tarea: F3-03

## Comprensión

Cada noticia del feed de las cuatro personas debe tener al menos una razón que corresponda a sus
componentes, con máximo tres razones ordenadas por contribución. El catálogo de RELEVANCIA §6 contiene
diez condiciones: garantías, algunas proximidades y umbrales de afinidad, recencia e importancia.

## Hipótesis

Aplicar esas diez condiciones al resultado de `rankFeed` después de las cuotas cubriría el corpus fijo.
Las garantías reservarían un espacio, con aporte numérico cero: no suman puntos al score.

## Construcción

Se añadieron `explain/reasons.ts`, pruebas de cada condición y pruebas de aceptación dentro de
`ranking/rankFeed.test.ts`, que usan exactamente las cuatro personas de F3-02. Se integraron las razones
al terminar el ranking para contar con los marcadores de cuota definitivos.

## Prueba y observación

Con las diez condiciones implementadas pasaron las pruebas de catálogo, pero fallaron los **cuatro**
casos de aceptación por noticia sin razones: 198 pruebas correctas y 4 fallidas.

- Persona de deportes: `n-gt-003` quedó sin razón.
- Personas sin historial y de tecnología: `n-es-002` quedó sin razón.
- Persona de economía: `n-int-005` quedó sin razón.

No eran errores de los datos: una noticia puede ser antigua, lejana o de importancia baja y aun así
formar parte del feed. No se puede llamarla «reciente» o «importante» para llenar el arreglo.

## Corrección / decisión

Si no aplica una condición del catálogo ni hay garantía, se explica el componente con el mayor aporte
positivo real. Si todos los aportes son cero, se indica solo que la noticia forma parte de las publicadas
disponibles. Los cinco códigos adicionales están en tipos, esquema zod y RELEVANCIA §6.

Tras la corrección: 209 pruebas verdes. Se agregaron además pruebas de promociones de ambas cuotas y
pesos personalizados normalizados junto con historial de lectura: **212 pruebas verdes en shared**.
La evidencia y validación final están en [F3-03-explanations.md](../F3-03-explanations.md).

## Rol de la IA en este loop

Codex implementó la hipótesis y escribió pruebas que la refutaron. Corrigió el catálogo guiándose por
los componentes calculados, sin cambiar la puntuación para hacer pasar las pruebas. Typecheck detectó
también un fixture cuyo literal de importancia se había ensanchado a `number`; se corrigió con el tipo
`RankedItem`. Nelson autorizó continuar con F3-03; la revisión humana del cambio sigue disponible en la rama.
No se invocaron proveedores de IA del proyecto ni se hicieron publicaciones editoriales.
