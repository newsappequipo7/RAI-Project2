# F3-12 — Registro de prueba manual y pendientes de cierre

Fecha: 2026-10-10 · Responsable: Nelson · Estado: **en curso**

Nelson informó en la conversación: «ya hice las pruebas y todo funciona bien». Antes también había informado que probó la app en Expo Go en su teléfono. Se registra como **reporte del responsable**, sin atribuirle un modelo, sistema, versión de Expo Go, lista de recorridos, tiempos ni capturas que aún no constan. Las pruebas automatizadas de F3-01 a F3-11 se enlazan en las respectivas filas de [`PLAN.md`](../docs/PLAN.md).

Para completar la evidencia del cierre, registrar los datos que correspondan a las pruebas realmente realizadas:

| Criterio pendiente | Registro necesario |
|---|---|
| F3-02 | Modelo de teléfono de gama media; 200 noticias; tiempo de `rankFeed` medido en Expo Go, meta <20 ms. |
| F3-04/05/06/07/08 | Teléfono/SO y capturas o videos de feed, pies/procedencia, «¿Por qué?», cuatro certezas, tres lecturas y modo sin personalizar. |
| F3-09 | Tiempo desde toque de ciudad hasta feed actualizado en teléfono, meta <300 ms. |
| F3-10 | Dos teléfonos identificados y tiempo desde publicación hasta indicador en cada uno, meta <5 s. |
| F3-11 | Captura y resultado visual de `/compare` en el navegador, con cuatro perfiles. |
| F3-12 | Modo oscuro, texto dinámico, contraste AA, videos de demo y recorrido de Joaquín siguiendo solo el handoff. |

Los archivos de captura y video se guardan en `evidence/captures/` y `evidence/demo-videos/`. No se han añadido aquí archivos nuevos de esos tipos ni se ha creado el tag `fase-3-done`. El código de F3-01 a F3-11 está integrado; el pendiente es evidencia y cualquier ajuste que revele el pulido de F3-12.
