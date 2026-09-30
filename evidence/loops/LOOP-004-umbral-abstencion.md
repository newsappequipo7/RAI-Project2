# LOOP-004 — Primera medición para el umbral de abstención τ
2026-09-29 · Diego · Tareas: F1-09

## Comprensión
CHAT-RAG.md fija un τ inicial de 0.45 "a calibrar con el set dorado" y no había ningún puntaje medido.

## Hipótesis
Con `@cf/baai/bge-m3` las consultas con noticia relevante deben dar un coseno claramente mayor que las que no la tienen.

## Construcción
Índice en KV con coseno por fuerza bruta (ADR-005), endpoint `/admin/index/search` y página `/indice` del portal con
6 noticias de prueba. Commit `29cb7e5`.

## Prueba y observación
5 consultas en español con modelo real: la noticia esperada quedó primera en las 5, con puntajes 0.5585 a 0.6202.
Una consulta sobre una noticia retractada (excluida del índice buscable) dio 0.4053 con una noticia no relacionada.

## Corrección / decisión
Mantener τ = 0.45 como valor provisional y considerar 0.50. Solo hay 6 noticias y 6 consultas: la calibración real
queda para el set dorado de F4. Se documentó el endpoint de búsqueda en CONTRATOS-API.md.

## Rol de la IA en este loop
Claude Code no podía obtener un token de admin para llamar al Worker real; propuso construir la página de calibración
en el portal. El deploy a producción fue bloqueado por el clasificador de permisos y lo ejecutó el usuario.
