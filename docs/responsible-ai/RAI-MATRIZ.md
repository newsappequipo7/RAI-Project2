# Matriz de Responsible AI

Cada pregunta del enunciado → decisión → dónde se ve en el producto → cómo se prueba. Si una celda de "Dónde se ve" o
"Prueba" está vacía, la respuesta es solo una política escrita y **no cumple** el enunciado.

| Pregunta | Decisión | Dónde se ve | Prueba / evidencia | Fase |
|---|---|---|---|---|
| **Importancia y relevancia:** ¿cómo decide qué mostrar, en qué orden y con qué prominencia? | Fórmula explícita (importancia, proximidad, afinidad, recencia) calculada por código | Tiers del feed; panel "¿Por qué veo esto?" con barras por componente | Tests de ranking 1–9 (RELEVANCIA.md §8); comparador por ubicación | F3 |
| ¿Cómo evita que preferencia o ubicación oculte lo importante? | Bloque "Lo que debes saber" no personalizado; cuotas nacional/internacional; diversidad de temas; silenciar no oculta esenciales; toggle "ver sin personalizar" | Bloque superior del feed; chips "Para que no te pierdas…"; toggle en perfil | Tests 1, 2, 4, 5, 6; métrica de diversidad por usuario en comparador | F3 |
| **Fuentes:** ¿qué procedencia se conserva y muestra? | Fuentes estructuradas (organización, tipo, URL, fecha, si confirma o contradice) | Sección "Cómo se hizo esta noticia"; chips de fuente en chat | Reglas del portal impiden publicar sin fuentes; captura de lectura | F2, F3 |
| ¿Cómo distinguir original, resumen e IA? | `ContentOrigin` y `ImageKind` obligatorios con etiqueta visible | Chips "Resumen generado con IA · revisado por…", pie del chat, pies de imagen | Revisión de pantallas contra VERIFICACION §4; test de componente que falla si falta etiqueta | F2, F3, F4 |
| **Validación:** ¿qué proceso reduce noticias falsas? | Workflow + checklist + reglas de certeza por número/independencia de fuentes | Formulario del portal con validaciones y botón Publicar bloqueado | Tests de validación del formulario (casos: 1 fuente, fuentes misma organización, contradicción) | F2 |
| ¿Qué pasa si una fuente no basta, se contradicen o no está confirmada? | `en_desarrollo` / `disputada` con nota obligatoria; retractación con corrección visible | Banners en lectura; chip en feed; notice en chat | Demo en vivo de retractación; eval del chat "menciona incertidumbre" | F2, F3, F4 |
| **Límites de la IA:** ¿qué decisiones requieren criterio humano? | Humano decide certeza, importancia final, publicación, imagen; IA solo sugiere | Sugerencias IA marcadas como tales en el portal, con registro de aceptadas/rechazadas | `aiSuggestions` guardadas vs valores finales (tabla en presentación: % de sugerencias cambiadas) | F2 |
| ¿Cómo evitar tratar una respuesta del modelo como prueba? | El chat solo cita noticias del corpus; certeza heredada de BD; abstención por umbral; validación de citas en código | Chips de certeza heredada; "No encontré noticias…"; "¿Cómo se generó?" | Set dorado: abstención correcta, citas válidas, casos de inyección | F4 |
| **Imágenes:** ¿cómo identificar contenido generado o alterado? | Jerarquía foto → libre → portada código → IA etiquetada; IA no fotorrealista, sin personas | Pies obligatorios; sello incrustado; hoja de detalle de imagen | Checklist `imagen_etiquetada`; captura de cada tipo | F2, F3 |

## Riesgos de personalización que reconocemos (sección 7)

| Riesgo | Mitigación | Límite que queda |
|---|---|---|
| Burbuja temática | Diversidad + cuotas + esenciales | La afinidad sigue influyendo en el orden medio |
| Sesgo geográfico (lo lejano parece irrelevante) | Cuota internacional; `global` con G = 0.60 | Pocas noticias internacionales en el corpus → cuota vacía |
| Aprendizaje por clics premia lo llamativo | Peso de afinidad 0.20; alerta de sensacionalismo en el portal | No medimos calidad de lectura real |
| Inferencia de intereses sensibles | Solo temas generales; perfil visible y reiniciable | — |
| Idioma: modelos rinden mejor en inglés | Evals en español; umbral calibrado con preguntas en español | Variaciones regionales del español no evaluadas a fondo |
