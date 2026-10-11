# Recorrido del handoff F3 → F4 (Joaquín)

Fecha: 2026-10-11 · Responsable: Joaquín · Rama: `fase-4/f4-01-chat-pipeline`

Recorrido de [`docs/handoffs/FASE-3.md`](../docs/handoffs/FASE-3.md) §2 desde un clon limpio de `main`
(`9b42806`), siguiendo solo el handoff. Máquina: Arch Linux. El commit `a4def8a` (handoff actualizado por
Nelson) no estaba en GitHub al hacer el recorrido; se usó la versión de `main`.

## 1. Pasos de línea de comandos

| Paso del handoff | Resultado | Nota |
|---|---|---|
| `git clone …` | OK | `9b42806` |
| `nvm use 24` | OK tras `nvm install 24` | El handoff ya indica instalarlo si falta. Node 24.21.0 |
| `corepack enable`; `node --version && pnpm --version` | OK | Node 24.21.0, pnpm 11.6.0 |
| `pnpm install --frozen-lockfile` | OK | |
| `pnpm lint && pnpm typecheck` | OK | |
| `pnpm test` | **Falla en clon limpio** | `firebase: command not found`; con Java 17 el emulador se niega (`firebase-tools no longer supports Java version before 21`). Con `firebase-tools` global y `JAVA_HOME` en JDK 21+: shared 259, Firestore 60, admin 71, Worker 145 (535 pruebas) |
| `pnpm seed --target=emulator` | OK | Dentro de `firebase emulators:exec --only firestore`: 40 noticias validadas con zod y escritas; conteo REST del emulador = 40. Índice omitido (sin `SEED_ID_TOKEN`), como dice el script. `--target=emulator` solo escribe en `127.0.0.1:8080` |
| `pnpm -F mobile start --tunnel` | OK | «Tunnel ready» (`exp.direct`). Bundles Metro iOS y Android: HTTP 200 (~11 MB). Expo sugiere `expo` 57.0.25 → ~57.0.27 |
| `pnpm -F admin dev` | OK | `http://localhost:5173/` |

**Corrección propuesta al handoff §2:** repetir los requisitos de F1/F2 que faltan en F3: Java 21+ para el
emulador de Firestore y `firebase-tools` global (`npm i -g firebase-tools`). Están en
[FASE-1](../docs/handoffs/FASE-1.md) y [FASE-2](../docs/handoffs/FASE-2.md), y el CI los instala, pero el §2
de F3 no los menciona y `pnpm test` falla sin ellos.

## 2. Comparador `/compare` (portal, Firestore de producción)

Sesión admin iniciada por Joaquín en Chrome; navegación y capturas con Claude in Chrome. Solo se cambiaron
los selectores de la vista; no se escribió nada.

| Revisión | Resultado | Captura |
|---|---|---|
| Ocho ciudades, posición, nivel y `E` | OK: columnas Ciudad de Guatemala … Madrid; `E1…E4` y niveles hero/grande/mediana/compacta | [sin historial](captures/F3-11-compare-sin-historial.jpg) |
| Perfil «Interés en deportes» | Cambia el orden: «Posible lesión del delantero…» pasa de 14 a 2 (grande) en Ciudad de México y de 21 a 8 en Nueva York | [deportes](captures/F3-11-compare-deportes.jpg) |
| Perfil «Interés en economía» | Cambia el orden: noticias no económicas bajan (Sismo en CDMX 2 → 6; Cierres viales GT se mantiene hero) | [economía](captures/F3-11-compare-economia.jpg) |
| Perfil «Tecnología; política silenciada» | **Idéntico a «Sin historial»** en las 24 filas (comparado por texto de página) | [tecnología](captures/F3-11-compare-tecnologia.jpg) |
| Destacar noticia y seguirla entre ciudades | OK: fila resaltada y «Abrir en el portal» | capturas anteriores |
| Panel de diversidad (top 10) | OK: 5–8 temas distintos por ciudad; conteo por alcance | [diversidad](captures/F3-11-compare-diversidad.jpg) |
| Retractadas | Aparecen marcadas «Retractada» y con «—» en todas las ciudades | [diversidad](captures/F3-11-compare-diversidad.jpg) |

Corpus visible: **41 noticias publicadas**; **24** entran al ranking y **17** tienen «—» en las ocho ciudades
(3 retractadas y 14 fuera de la ventana de 72 h).

### Observaciones

1. **Perfil de tecnología sin efecto (no es bug de código).** Según [RELEVANCIA](../docs/domain/RELEVANCIA.md)
   §66, un tema silenciado da `A = 0`, igual que un tema sin interés cuando el perfil tiene intereses. Las dos
   noticias de tecnología («Japón presenta un nuevo chip…», «Feria de tecnología en San Salvador…») están fuera
   de la ventana, así que las 24 visibles quedan con `A = 0` y el orden coincide con el neutro. Para la demo,
   publicar o refrescar una noticia de tecnología dentro de la ventana o cambiar la persona.
2. **Ventana de 72 h.** Confirma la deuda alta del handoff §5: 14 de 38 noticias no retractadas ya no se
   rankean. Afecta al digest y a la demo de Fase 4.
3. **Corpus por debajo de F2-11:** 41 publicadas frente a ≥ 55 requeridas (las 16 editoriales siguen sin
   publicar).
4. Al pulsar `End` con el foco en un selector se cambia la noticia destacada; comportamiento nativo del
   `<select>`, sin impacto.

## 3. App móvil en Expo Go

Pendiente: requiere teléfono de Joaquín (modelo, sistema, versión de Expo Go y resultado por paso).
