# LOOP-009 — Conservar cuotas y separadores al diversificar

Fecha: 2026-10-09 · Persona: Nelson (implementación asistida por Codex) · Tarea: F3-02

## Comprensión

El ranking debe incluir noticias del país y de fuera del país en las primeras diez y evitar tres temas
principales consecutivos iguales. El corpus fijo permite probar las nueve propiedades iniciales, pero no
cubre todos los desequilibrios de temas que puede producir el portal.

## Hipótesis

Promover las cuotas y elegir en cada posición la primera noticia que no repita tres veces el tema sería
suficiente. Se reservó además espacio en las diez primeras para las cuotas pendientes.

## Construcción

Se escribieron primero las nueve pruebas de `RELEVANCIA.md` sobre las cuatro personas y el corpus fijo.
Con el motor vacío fallaron las nueve (131 pruebas anteriores pasaban). El primer motor hizo pasar las
140 pruebas, con typecheck verde. Se añadieron casos de borde en
[`edgeCases.test.ts`](../../packages/shared/src/ranking/edgeCases.test.ts).

## Prueba y observación

La suite ampliada tuvo **2 fallos y 180 pruebas correctas**, con typecheck verde:

- Tres noticias de política con mayor puntaje y seis de deportes: el algoritmo consumía pronto los
  separadores de política y dejaba una cola de deportes, aunque existía un orden sin triples.
- Una cuota extranjera entre noticias concentradas en economía: el ordenamiento podía dejar la cuota
  pendiente hasta una posición donde chocaba con el tema de las dos anteriores.

Tras la corrección pasaron **182 pruebas**. Una prueba adicional recorrió 100 variaciones reproducibles
de 18 noticias con un orden válido conocido: conserva todas las noticias, cuota y diversidad. Total final
de shared: **183 pruebas**, incluidas las nueve propiedades obligatorias.

## Corrección / decisión

La selección comprueba que el resto conserve suficientes separadores por tema y que no se deje una cuota
sin separador en el último espacio del top 10. Conserva desempates deterministas y las marcas de promoción.
Cuando no existe diversidad suficiente (p. ej., todo del mismo tema), conserva las noticias y las cuotas
disponibles. Se aclaró este límite y el contrato en [`RELEVANCIA.md`](../../docs/domain/RELEVANCIA.md).

Se aclararon también dos puntos antes de integrar UI: desactivar personalización ignora las noticias leídas,
y `mustKnow` devuelve todas las esenciales para permitir cinco visibles más «ver todas».

## Rol de la IA en este loop

Codex propuso el primer algoritmo y los casos adicionales. Las pruebas demostraron que su selección local
era insuficiente; Codex corrigió el algoritmo y mantuvo los casos como regresiones. Nelson autorizó F3-02;
la revisión humana de este cambio y la medición en teléfono están pendientes. No hubo llamadas a modelos
del proyecto, cambios editoriales, push ni despliegues.
