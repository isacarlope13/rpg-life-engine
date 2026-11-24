# Continuidad de OakHaven — Filet Crochet Studio (Módulo del Atelier de Clara)

**Rama dedicada:** `feat/oakhaven-filet-crochet-studio`
**Base limpia:** `origin/main @ cb06321` (Release 3.3 — independiente de la PR financiera #2)
**Estado de despliegue:** Local únicamente (sin `push`, sin `merge`, sin despliegue en Railway y sin migraciones SQL reales).

---

## Fase 1 — Completada (`f887342`, 2026-11-23)
- **Motor puro (`src/lib/sanctuary/filet-crochet-engine.ts`):** tipos de matrices binarias (`0`/`1`), glifos, colecciones de alfabeto, `originalReference.originalMatrix` inmutable, validación estricta, edición/redimensionamiento inmutables, Undo/Redo y 7 transformaciones puras sobre copias.
- **Persistencia privada (`src/lib/sanctuary/filet-crochet-store.ts` + `building-resources-engine.ts`):** almacenamiento local aislado por propietario (`isOfflineOwner`) y respaldo JSON en `/api/resources` (`buildingId: "atelier"`, `resourceType: "filet_crochet_studio"`).
- **UI en Atelier (`src/components/sanctuary/filet-crochet-studio.tsx` + `atelier-building.tsx`):** editor de cuadrícula numerada, pintura por puntero, zoom (`50%`–`200%`), deshacer/rehacer, creación manual de letras, referencia original intacta y estación integrada sin retirar funciones previas del Atelier.
- **QA Fase 1:** 357/357 pruebas aprobadas (7 nuevas en `tests/filet-crochet-studio.test.ts`), `npx tsc --noEmit` = 0 errores, `npm run build` = 35/35 rutas, `git diff --check` limpio.

---

## Fase 2 — Implementada y verificada en local (2026-11-23)
- **Bloque 0 (Validación previa):**
  - Cuotas de Codex: no consultables programáticamente desde Antigravity; confirmación humana explícita recibida para continuar.
  - Node: ejecutado con `C:\Program Files\nodejs\node.exe` (`v26.12.1`) bajo autorización humana explícita; pendiente confirmar paridad bajo **Node 22 (`22.x`)** en CI o terminal con Node 22 antes de merge.
  - Continuidad separada de `docs/continuity/CODEX_HANDOFF.md` (que conserva intacta la continuidad de la PR financiera #2).
- **Bloque 1 — Compositor visual (`filet-crochet-engine.ts` + `filet-composer-panel.tsx`):**
  - Lienzo configurable en cuadros (`width × height`), márgenes (`top/right/bottom/left`), borde perimetral (`none` / `open_frame` / `solid_frame`), selector de alfabetos y caracteres, composición automática de nombres/frases con separación configurable de letras, palabras y líneas.
  - Detección explícita de caracteres faltantes sin sustitución silenciosa (permite elegir alternativa explícita o crear la letra manualmente) y detección exacta de desbordamientos (`overflow`).
  - Selección individual de glifos, arrastre con ajuste exacto a cuadrícula entera, alineación/centrado/distribución, rotación y reflejo sobre copias, escalado discreto estrictamente entero (`scaleMatrixDiscrete`, sin interpolación), edición manual de celdas (`puntero` + `teclado`), Undo/Redo completo (`ComposerHistoryState`), perímetro numerado completo (arriba, abajo, izquierda, derecha), zoom (`25%`–`200%`), desplazamiento, borradores y versiones inmutables (`v1`, `v2`, ...).
- **Bloque 2 — Persistencia y recuperación (`filet-crochet-store.ts` + `filet-restore-panel.tsx` + `src/app/api/resources/route.ts`):**
  - Lectura privada acotada en `GET /api/resources?buildingId=atelier&id=<id>&includeContent=1` (estrictamente restringida a `user_id = userId`, `building_id = "atelier"`, `resource_type = "filet_crochet_studio"`, `Cache-Control: no-store`).
  - Validación de estructura y `schemaVersion === 1`, vista previa previa a restaurar, detección de conflictos contra cambios locales offline, confirmación obligatoria antes de sobrescribir, aislamiento por propietario y diferenciación explícita entre edición offline local y respaldo manual (NO sincronización automática).
- **Bloque 3 — Motor técnico (`filet-crochet-engine.ts` + `filet-composer-panel.tsx`):**
  - Separación estricta entre matriz visual (`BinaryMatrix`) y convención técnica de ejecución (`FiletTechnicalConvention`: malla de 3 con `1 cad` interior / paso `2`, malla de 4 con `2 cad` interiores / paso `3`, bordes compartidos `N * paso + 1`, cadenas de subida `3` para inicio lleno y `4`/`5` para inicio vacío).
  - Instrucciones deterministas por fila mediante secuencias consecutivas de cuadros llenos y vacíos en lectura normal (`ltr`) e invertida (`rtl`).
  - Prueba obligatoria verificada: `[11 vacíos, 2 llenos, 12 vacíos, 2 llenos]` = `27` cuadros (`55` puntos base en malla 3; `82` en malla 4) en lectura normal e invertida.
- **Bloque 4 — Pruebas de aceptación (`tests/filet-crochet-phase2.test.ts`, registrada en `package.json`):**
  - Alfabeto sintético exclusivo para pruebas (sin sustituir alfabetos históricos reales) componiendo `"Baby Lucio"` en lienzo de 80 cuadros, conservación de matrices originales, separación de caracteres/palabras, desbordamientos, caracteres faltantes, persistencia/conflictos/restauración, versionado inmutable, rendimiento en patrón `160×80` (`12.800` cuadros), controles de teclado/puntero y compatibilidad con las 5 estaciones previas del Atelier.
- **Resultados QA (Node `v26.12.1`):**
  - `npm test`: **363/363** pruebas aprobadas (20 suites, `0` fallos).
  - `npx tsc --noEmit`: `0` errores.
  - `npm run build`: aprobado (`35/35` rutas).
  - `git diff --check`: limpio.

---

## Fase 3 — Digitalizador de Alfabetos Históricos (`feat/oakhaven-filet-crochet-studio`, 2026-11-23)
- **Bloque 0 (Validación y dependencias):**
  - Dependencia evaluada e instalada: **`pdfjs-dist@6.5.438`** (`npm audit` = **0 vulnerabilidades**, parcha CVE-2024-4367 y CVE-2026-16633; `eval()` eliminado en core v6.5+).
  - Worker local servido desde `public/pdf.worker.min.mjs` (sin CDN externo, `useSystemFonts: false`, carga diferida con `import("pdfjs-dist")` para no inflar el bundle inicial de `/cozy`).
  - Paridad de Node: ejecutado con `C:\Program Files\nodejs\node.exe` (`v26.12.1`) bajo autorización explícita; pendiente confirmar paridad bajo **Node 22 (`22.x`)** en CI o terminal con Node 22 antes de merge.
  - Continuidad de PR financiera #2 protegida (`docs/continuity/CODEX_HANDOFF.md` no modificado ni incluido en el commit).
- **Bloque 1 — Biblioteca de Documentos Históricos (`building-resources-engine.ts` + `pdf-local-renderer.ts` + `filet-crochet-store.ts`):**
  - Nuevo tipo de recurso privado en Atelier: `historical_alphabet_document` (`pdf`, `png`, `jpg`, `jpeg`, `webp`) respetando el límite de **5 MB** del Atelier, validación real de magic bytes, prevención de path traversal, límites de dimensiones (`4096 px` / `16 MP`) y máximo `60` páginas PDF.
  - Renderizado local de PDF con miniaturas, navegación de páginas, zoom/pan, rotación de copia de trabajo (`0°/90°/180°/270°`) y selección de región rectangular sin modificar jamás el documento original.
- **Bloques 2 y 3 — Calibración Visual y Motor Determinista RGBA (`src/lib/sanctuary/filet-digitizer-engine.ts`):**
  - Editor de calibración de cuadrícula sobre copia derivada: filas, columnas, origen `X/Y`, ancho/alto de celda, desplazamiento `X/Y`, rotación fina, opacidad de superposición y margen interior de muestreo (`innerSampleMarginRatio`) para evitar líneas de cuadrícula.
  - Procesamiento determinista puro (sin Gemini, sin OCR externo, sin servicios pagos): escala de grises, contraste, binarización con umbral manual u Otsu automático (`autoSuggestThresholdOtsu`), inversión blanco/negro, detección asistida de líneas (`detectGridLinesAssisted`), clasificación lleno/vacío, detección explícita de celdas ambiguas y **modo 100 % manual** (`createManualEmptyDigitization`).
- **Bloques 4 y 5 — Revisión 4-en-1, Procedencia e Integración (`filet-crochet-engine.ts` + `filet-historical-digitizer.tsx`):**
  - Vista simultánea de región original, cuadrícula calibrada, matriz binaria editable y celdas ambiguas resaltadas.
  - Edición celda por celda, Undo/Redo, zoom, restablecimiento a detección inicial, cero suavizado/estilizado automático y **confirmación manual obligatoria** antes de guardar.
  - Trazabilidad histórica completa en `FiletGlyph.historicalProvenance` (documento, página, región, calibración, `initiallyDetectedMatrix`, fecha y referencia original), detección de duplicados con soporte de variantes y flujo continuo para digitalizar varias letras de la misma página sin reimportar, integradas de inmediato en el Compositor Visual (Fase 2).
- **Bloque 6 — UI Profesional de 3 Paneles (`src/components/sanctuary/filet-historical-digitizer.tsx` + `filet-crochet-studio.tsx`):**
  - Pestaña `4. Digitalizador Histórico (PDF/Img)` con diseño responsivo de 3 paneles (`lg:col-span-3`, `lg:col-span-5`, `lg:col-span-4` + pestañas móviles) en estética Cozy de OakHaven.
- **Bloque 7 — Pruebas y QA Final (Node `v26.12.1`):**
  - `tests/filet-crochet-phase3-digitizer.test.ts` (6 pruebas integrales con imágenes sintéticas RGBA: líneas 1px y 4px, detección asistida, Otsu/contraste bajo, inversión, celdas ambiguas, recorte de región, preservación del original, corrección manual, persistencia y recarga, duplicados/variantes, aislamiento por usuario, rechazos de seguridad, integración con Compositor + Motor Técnico, rendimiento `32×32` en `640×640 px` < 300 ms y auditoría de seguridad PDF.js).
  - `npm test`: **369/369** pruebas aprobadas (21 suites, `0` fallos).
  - `npx tsc --noEmit`: `0` errores.
  - `npm run build`: aprobado (`35/35` rutas; `/cozy` `93.4 kB`, First Load JS `351 kB`).
  - `git diff --check`: limpio.
  - **Prueba en navegador real (`http://localhost:3099/cozy`):** verificados los 3 paneles en escritorio sin solapamiento, modo manual, edición + Undo/Redo, confirmación obligatoria de revisión, guardado en biblioteca y disponibilidad inmediata del glifo `"Z"` en el Compositor Visual, con `0` errores de consola en Filet Crochet Studio (nota: persiste 1 advertencia preexistente de React `key` en `BentoDailyDashboard` al renderizar `/cozy`, fuera del alcance de Filet Studio).

---

## Fase 4 — Integración con Proyectos y Sesiones de Tejido Guiadas (`feat/oakhaven-filet-crochet-studio`, 2026-11-24)
- **Bloque 0 (Validación previa):**
  - Entorno local: `Node v26.12.1` (`npm 11.20.0`); **Node 22 (`22.x`) no disponible** en esta máquina — autorización humana explícita recibida para ejecutar e implementar bajo `v26.12.1` manteniendo pendiente la verificación de paridad con `Node 22.x` antes de merge.
  - Continuidad de PR financiera #2 protegida (`docs/continuity/CODEX_HANDOFF.md` intacto y excluido de commits).
- **Bloque 1 — Creación de proyecto desde versión inmutable (`rpg.ts`, `demo-store.ts`, `/api/shortcuts/skill-session`, `state-builder.ts`, `filet-composer-panel.tsx`, `atelier-building.tsx`):**
  - `KnittingProject` extendido con `created_at` y `linked_filet_pattern?: LinkedFiletPatternSnapshot | null` (100 % retrocompatible con proyectos antiguos sin patrón vinculado).
  - Acción **🧶 Crear proyecto de tejido (vN)** en `FiletComposerPanel`: congela una copia profunda inmutable de la matriz, dimensiones, convención de malla (`3` o `4`), orientación y dirección inicial. Modificaciones posteriores en el compositor o nuevas versiones `v2+` jamás alteran proyectos activos.
  - Hidratación verificada en `src/lib/state-builder.ts` (`GET /api/state`) conservando `linked_filet_pattern` desde `profiles.collections_state` sin requerir migración real en Supabase.
  - Tarjetas de proyectos en el Atelier muestran insignia `📐 Filet vN (W×H)` y botón directo `Tejer guiado ➜`.
- **Bloque 2 — Motor determinista de progreso y borrador SQL atómico (`filet-guided-engine.ts` + `supabase/drafts/20261124_filet_guided_progress_atomic.sql`):**
  - Motor puro (`src/lib/sanctuary/filet-guided-engine.ts`) que cumple las 10 reglas invariantes: completar segmentos no suma vueltas; confirmar fila exige todos sus segmentos; incremento exacto `+1`; idempotencia por `operationId` y `rowNumber`; prevención de doble confirmación entre dispositivos; pausa/reanudación inocua; recuperación y cierre de sesión sin duplicar filas ya acreditadas (`syncedConfirmedRows`); bloqueo por `PATTERN_VERSION_MISMATCH`; retroceso seguro sin contadores negativos.
  - Borrador SQL `supabase/drafts/20261124_filet_guided_progress_atomic.sql` (NO aplicado en Supabase real): tablas `filet_guided_progress` y `filet_guided_operation_receipts` con RLS, más RPCs atómicas `confirm_filet_row_atomic_v1` y `undo_filet_row_atomic_v1` con bloqueo `FOR UPDATE` sobre `knitting_projects` para actualizar progreso + `completed_rows` en una sola transacción.
- **Bloques 3, 4, 5 y 6 — Mesa de Tejido Guiada, Persistencia, Clara y Multidispositivo (`filet-guided-session.tsx`, `filet-guided-store.ts`, `clara-lyra-tools.ts`):**
  - Pestaña `5. Mesa de Tejido Guiada` reutilizando directamente `useUniversalSession("knitting", "atelier")` vía `sessionBridge` (cero cronómetros paralelos).
  - Tres vistas (`Gráfico`, `Instrucciones`, `Ambos`), resaltado de fila y segmento activos, zoom (`50%–200%`), desplazamiento con Pointer Events (compatible con S Pen / Galaxy Tab), navegación por teclado (`Espacio`/`Enter`, `Backspace`/`ArrowLeft`, `C`) y botones grandes de una mano para iPhone / Safari.
  - Persistencia local automática aislada por propietario (`filet-guided-store.ts`), recuperación tras recarga/cierre, detección y fusión segura de conflictos sin duplicar vueltas, estado visible (`Guardado localmente`, `Pendiente de sincronización`, `Confirmado por el servidor`, `Conflicto detectado`, `Error de red`) y reintento idempotente.
  - Herramienta determinista `getGuidedFiletProjectStatus` en `clara-lyra-tools.ts` + tarjeta de Clara en la Mesa Guiada + lectura opcional mediante `window.speechSynthesis` (100 % desacoplada de IA externa).
- **Bloques 7 y 8 — Pruebas obligatorias, PGlite SQL y Regresión del Digitalizador:**
  - `tests/filet-crochet-phase4-guided.test.ts` (4 pruebas integrales): prueba de aceptación principal de **80 cuadros** (`11 vacíos, 2 llenos, 12 vacíos, 2 llenos, 53 vacíos`), cierre/reapertura, confirmación repetida, inmutabilidad, proyectos antiguos, concurrencia de 2 dispositivos, conflictos, fallos de red, aislamiento de usuarios, retroceso, finalización, cero duplicación XP/GP/vueltas, Clara determinista y regresión Bloque 8 (PDF `%PDF-1.4`, worker local `public/pdf.worker.min.mjs`, recorte, calibración, glifo, original intacto, compositor y vigencia del límite de 5 MB del servidor).
  - Evaluación de PDFs > 5 MB (Bloque 8): se mantiene el límite de seguridad de **5 MB** en `/api/resources`; la extracción local de páginas individuales (renderizar localmente en Canvas/PNG una página seleccionada de un PDF grande sin subir el PDF completo al servidor) queda documentada como mejora segura opcional para fase posterior sin relajar los límites del servidor.
  - `tests/filet-crochet-phase4-sql.test.ts` (2 pruebas aisladas en **PGlite**): atomicidad de `confirm_filet_row_atomic_v1` y `undo_filet_row_atomic_v1`, replays, 2 dispositivos, conflicto de revisión optimista, aislamiento de propietario, rechazo de versión distinta y compatibilidad con proyectos antiguos.
- **Resultados QA (Node `v26.12.1`):**
  - `npm test`: **375/375** pruebas aprobadas (22 suites, `0` fallos, incluyendo PGlite SQL).
  - `npx tsc --noEmit`: `0` errores.
  - `npm run build`: aprobado (`35/35` rutas).
  - `git diff --check`: limpio.
  - **Prueba en navegador real (`http://localhost:3099/cozy`):** creación de proyecto desde versión inmutable `v1` (`POST /api/shortcuts/skill-session` `201`), recarga completa e hidratación en `5. Mesa de Tejido Guiada`, guardia de confirmación deshabilitada hasta completar segmentos, confirmación de Vuelta 1 (`Guardado localmente` → `Confirmado por el servidor`, `Confirmadas: 1 (4%)`, avance a `Vuelta 2 / 24`), tarjeta determinista de Clara y `0` errores de consola en Filet Crochet Studio.
