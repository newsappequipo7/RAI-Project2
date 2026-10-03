# LOOP-007 — Prueba de tiempo real del emulador intermitente
2026-10-02 · Daniel (con Claude Code) · Tareas: F2-01, F2-03

## Comprensión
La prueba `firebase-tests/newsList.test.ts` (F2-01 CA2: un borrador de otro admin llega a la lista abierta sin
recargar) pasó al escribirla y, más adelante, falló dos veces sin que el código del portal hubiera cambiado.

## Hipótesis
Un efecto de tiempos o de estado compartido entre archivos de prueba: el emulador conserva los documentos de otros
archivos y la prueba escribía sin esperar a que el listener estuviera listo.

## Construcción
Primera falla al sumar las pruebas del editor (F2-02): `snapshot timeout` de 10 s en CA2; no se reprodujo en 11
corridas seguidas. Segunda falla con la suite completa en paralelo (F2-03), con el mismo mensaje. Se reescribió la
prueba (commit `e77fb45`): limpia el emulador al inicio de cada archivo, abre el listener y espera su primer
snapshot **antes** de que el otro admin escriba, y el timeout informa cuántos documentos y cuáles ids veía.

## Prueba y observación
Tras el cambio: 3 de 3 corridas aisladas y 5 de 5 corridas completas en paralelo pasaron; desde entonces la suite
completa pasó en todas las verificaciones de F2-04 a F2-11. **No se confirmó la causa raíz**: las dos fallas no se
reprodujeron a voluntad.

Error de proceso propio en este mismo episodio: una cadena de comandos usaba `grep` para mostrar el resultado y su código
de salida (0) no reflejaba el fallo de la prueba, así que se creó un commit con una prueba en rojo. La suite completa
pasó justo después, pero el commit se hizo sin verificar de verdad.

## Corrección / decisión
- Las pruebas de tiempo real son deterministas: estado aislado por archivo y espera explícita de «listo» antes de actuar.
- Los fallos deben diagnosticarse solos: el mensaje de error dice qué se vio.
- La verificación antes de un commit usa el código de salida real del comando, no una búsqueda de texto en su salida.
- Si la falla reaparece, el mensaje nuevo debería indicar si es un problema de datos residuales o de entrega del listener.

## Rol de la IA en este loop
Claude Code detectó que dos fallas con el mismo síntoma no eran ruido, propuso las tres medidas de determinismo y midió
el antes y el después; reconoció que no encontró la causa en vez de darla por resuelta. Aceptado: el rediseño de la
prueba. Rechazado: subir el timeout, que habría ocultado el síntoma.
