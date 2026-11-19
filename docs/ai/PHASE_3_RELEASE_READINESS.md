# OakHaven AI — Informe de Preparación para Liberación (Fases 2 y 3)

**Fecha de validación:** 2026-11-19  
**Repositorio:** `rpg-life-engine`  
**Rama activa:** `main` (HEAD local en `47a7c8c`, sincronizado con `origin/main`, con 27 archivos locales modificados/nuevos pendientes de commit)  
**Estado de liberación:** **`LISTO PARA REVISIÓN DE DESPLIEGUE`** *(con validación E2E autenticada en navegador y empaquetado standalone fuera de sandbox como pasos previos recomendados al push)*

---

## 1. Funciones Verificadas

### Infraestructura Privada y Bibliotecas por Edificio (Fase 2)
- **8 bibliotecas estrictamente separadas por edificio** (`src/lib/ai/building-resources-engine.ts` y `src/components/sanctuary/building-library-panel.tsx`):
  - Cada edificio (`atelier`, `biblioteca`, `oficina`, `forja`, `gimnasio`, `estudio`, `cine`, `banco`) restringe tipos de recurso, extensiones y MIME types permitidos.
  - Rechazo de tipos no autorizados (p. ej. `.exe`, `.pdf` de extracto bancario en Crochet, etc.), prevención de *path traversal* y detección de magic bytes reales (`sniffFileMagicBytes`).
- **Subida privada a Supabase Storage y recuperación por URL firmada** (`src/app/api/resources/route.ts`):
  - `POST /api/resources` soporta `multipart/form-data` y sube al bucket privado `oakhaven-private-resources` con prefijo `${userId}/${buildingId}/...` y `upsert: false`.
  - Deduplicación por hash SHA-256 (`409 Conflict` ante archivo duplicado).
  - Rollback automático en Storage si falla la inserción en `building_resources`.
  - `GET /api/resources?id=<uuid>&signedUrl=1` genera URL firmada temporal (TTL 300s) verificando propiedad del recurso y prefijo `${userId}/`.
- **Archivado lógico reversible y restauración** (`src/app/api/resources/route.ts`):
  - `DELETE /api/resources?id=<uuid>` realiza borrado lógico (`deleted_at = now()`) en lugar de eliminar físicamente el archivo o registro.
  - `PATCH /api/resources` permite restaurar recursos archivados (`deleted_at = null`) y actualizar metadatos seguros.
- **Migración local segura sin pérdida de datos** (`src/lib/ai/local-migration-engine.ts`):
  - Exportación de respaldo JSON de `localStorage` y detección explícita de estados (`CONFLICTO`, `PENDIENTE_SINCRONIZACION`, etc.) sin borrar automáticamente los datos locales del navegador.

### Skills Activas de Especialistas: Clara y Lyra (Fase 3)
- **Procesamiento documental y citas verificables** (`src/lib/ai/document-extractor.ts`):
  - Extracción modular sin dependencias nativas pesadas para `.txt`, `.md`, `.csv`, `.json` y PDFs con texto embebido (`FlateDecode` vía `node:zlib`).
  - Segmentación por páginas con etiquetas reales `[Página N]` y caché por `content_hash`.
  - Detección honesta de PDF escaneado (`scanned_no_text`) e imágenes sin OCR (`image_not_ocr`) sin inventar contenido ni citas.
- **Clara — Especialista de Crochet (`atelier`)** (`src/lib/ai/clara-lyra-tools.ts`, `src/lib/ai/specialist-engine.ts`):
  - Consulta proyectos reales del Atelier, patrones cargados, abreviaturas y materiales.
  - Propone notas de avance y acciones en **Nivel 2 (`requiresConfirmation: true`)**; nunca guarda cambios sin confirmación explícita del usuario.
- **Lyra — Especialista de Estudio (`biblioteca`)** (`src/lib/ai/clara-lyra-tools.ts`, `src/lib/ai/specialist-engine.ts`):
  - Consulta apuntes y documentos reales del edificio de Estudio.
  - Genera evaluaciones deterministas de opción múltiple con citas verificables `[Página N]` vinculadas al texto extraído del documento.
  - Evalúa respuestas del estudiante y propone flashcards SM-2 en **Nivel 2 (`requiresConfirmation: true`)**.
- **Rowan — Presidente del Pueblo (`mayor`)** (`src/lib/ai/resource-query-tools.ts`, `src/lib/ai/mayor-rowan-engine.ts`):
  - Consulta únicamente metadatos autorizados de recursos (`resource_type`, título, edificio, estado) y bloquea la exposición de texto financiero sensible (`is_sensitive_financial`).
- **UI unificada sin interfaces duplicadas** (`src/components/sanctuary/building-specialist-panel.tsx`, `src/components/sanctuary/living-interior-room.tsx`):
  - Selector de documento integrado dentro del panel de especialista existente y biblioteca integrada dentro de `LivingInteriorRoom`.

---

## 2. Pruebas Ejecutadas

| Verificación | Comando / Método | Resultado | Detalle |
|---|---|---|---|
| **TypeScript estricto** | `npx tsc --noEmit` | **APROBADO** | Exit code `0`, `0` errores de tipos en todo el proyecto. |
| **Suite de pruebas automatizadas** | `npm test` | **APROBADO** | **306 / 306 pruebas aprobadas** (`0` fallos, `0` omitidas, 9 suites incluyendo `oakhaven-ai-phase2-libraries.test.ts` y `oakhaven-ai-phase3-clara-lyra.test.ts`). |
| **Compilación Next.js (producción)** | `npm run build` | **COMPILADO / BLOQUEO SANDBOX EN TRACE COPY** | `✓ Compiled successfully` (4.7s), ESLint y validación de tipos sin errores, `✓ Generating static pages (33/33)` y optimización completadas. Solo el paso final `Collecting build traces` al copiar `node_modules` dentro de `.next\standalone` falló con `EPERM: operation not permitted, mkdir` propio del sandbox de Windows (`output: "standalone"` en `next.config.ts`). |
| **Verificación Supabase (solo lectura)** | Consulta read-only vía cliente Supabase (sin tocar datos financieros) | **APROBADO** | Confirmadas tablas `public.cinema_entries` y `public.building_resources` (con todas las columnas de Fase 2), RLS activo (`0` filas visibles para cliente anónimo) y bucket `oakhaven-private-resources` con `public: false` y límite de 10 MB (`10485760` bytes). |

---

## 3. Revisión de Seguridad

| Control de Seguridad | Estado | Evidencia en Código / Pruebas |
|---|---|---|
| **Aislamiento entre edificios y usuarios** | Verificado | `resource-query-tools.ts` filtra por `buildingId` y `userId`; `GET /api/resources?signedUrl=1` verifica prefijo `${userId}/` antes de firmar; RLS activo en Supabase. |
| **Gemini no recibe documentos no autorizados** | Verificado | `specialist-engine.ts` y `resource-query-tools.ts` solo adjuntan fragmentos del edificio del especialista activo y excluyen `is_sensitive_financial` del contexto libre. |
| **Citas a PDF verificables (no inventadas)** | Verificado | `document-extractor.ts` genera citas `[Página N]` únicamente desde texto extraído real y marca `scanned_no_text` si el PDF no tiene capa de texto. |
| **Tratamiento de documentos como contenido no confiable** | Verificado | Saneamiento anti *prompt injection* en `building-resources-engine.ts` y `document-extractor.ts`, además de delimitación de contenido documental. |
| **Políticas RLS intactas y bucket privado** | Verificado | Comprobado en Supabase en vivo (solo lectura): RLS activo en `building_resources` y `cinema_entries`; bucket `oakhaven-private-resources` con `public: false`. |
| **Sin registro de secretos ni contenido financiero sensible** | Verificado | No se loguean tokens, claves ni cuerpos de extractos financieros en APIs ni pruebas. |
| **Propuestas Nivel 2 y bloqueo absoluto a COP, GP y XP** | Verificado | Pruebas unitarias en `oakhaven-ai-phase2.test.ts` y `oakhaven-ai-phase3-clara-lyra.test.ts` verifican `requiresConfirmation: true` en acciones de escritura y bloqueo total a mutaciones autónomas de `COP`, `GP` y `XP`. |

---

## 4. Errores Encontrados y Corregidos (Durante Fases 2–3)

1. `src/lib/ai/building-skills-registry.ts`: secuencia `*/` dentro de un comentario de bloque rompía el parser de TypeScript → corregido reemplazando el comodín por `<nombre>`.
2. `src/app/api/ai/mayor/chat/route.ts`: lectura incorrecta de propiedad `isSupabaseConfigured` sobre `requireShortcutUser` → corregido derivando `mode === "supabase" && Boolean(db)`.
3. `src/lib/ai/mayor-readonly-tools.ts`: referencia a propiedad inexistente `transactions` en `RPGEngineMemoryStore` → actualizado a `financialMovements`.
4. `src/lib/ai/mayor-rowan-engine.ts`: expresión regular de `detectUnsafeActionRequest` no capturaba `"ejecuta un pago"` → ajustada con grupo opcional `(un\s+)?`.
5. `src/lib/ai/clara-lyra-tools.ts`: propiedad `next_review_date` ausente en `SpacedRepetitionCard` → tipado corregido.
6. `tests/oakhaven-ai-phase2.test.ts`: aserción `deepEqual` rígida sobre `toolsUsed` fallaba al sumar herramientas de Fase 3 para Clara y Lyra → actualizada a `toolsUsed.includes(b.expectedTool)`.
7. `src/app/api/resources/route.ts`: la implementación anterior en `origin/main` (`47a7c8c`) ejecutaba borrado físico en `DELETE` → reemplazada por archivado lógico reversible (`deleted_at`) + restauración en `PATCH`.

---

## 5. Funciones No Comprobadas en Vivo

Por política de seguridad (no mutar producción ni operar con sesiones reales sin autorización) y restricción del sandbox de Windows:

1. **Flujo E2E completo en navegador autenticado contra producción/staging** (subir un PDF real a `oakhaven-private-resources`, abrir URL firmada en pestaña nueva, recargar en otro dispositivo y restaurar un recurso archivado).
2. **Empaquetado final `.next/standalone` en Windows fuera de sandbox** (la compilación, tipos y generación de las 33 rutas pasaron al 100%; solo el copiado masivo de `node_modules` a `.next/standalone` fue bloqueado por `EPERM` del sandbox).

Ambos puntos se cubren con el procedimiento manual de la Sección 9.

---

## 6. Estado de las Migraciones

| Migración | Estado en Supabase | Verificación |
|---|---|---|
| `20261119_oakhaven_ai_phase1_sync.sql` | **Ejecutada por el usuario** | Tabla `public.cinema_entries` verificada en vivo con RLS activo. |
| `20261119_phase2_private_storage_and_resources.sql` | **Ejecutada por el usuario** | Tabla `public.building_resources` (columnas de Fase 2 + `deleted_at`, `content_hash`, `is_sensitive_financial`, `extraction_status`, `extracted_text`) y bucket privado `oakhaven-private-resources` (`public: false`) verificados en vivo. |

> No se requieren nuevas migraciones SQL para Fase 3.

---

## 7. Lista de Cambios Locales (27 archivos, sin commit)

### Modificados (8)
- `docs/continuity/CODEX_HANDOFF.md`
- `package.json`
- `src/app/api/ai/specialist/chat/route.ts`
- `src/app/api/resources/route.ts`
- `src/components/sanctuary/building-specialist-panel.tsx`
- `src/components/sanctuary/living-interior-room.tsx`
- `src/lib/ai/specialist-engine.ts`
- `tests/oakhaven-ai-phase2.test.ts`

### Nuevos / Sin seguimiento (19)
- `src/components/sanctuary/building-library-panel.tsx`
- `src/lib/ai/building-resources-engine.ts`
- `src/lib/ai/clara-lyra-tools.ts`
- `src/lib/ai/document-extractor.ts`
- `src/lib/ai/local-migration-engine.ts`
- `src/lib/ai/resource-query-tools.ts`
- `supabase/drafts/20261119_phase2_private_storage_and_resources.sql`
- `tests/oakhaven-ai-phase2-libraries.test.ts`
- `tests/oakhaven-ai-phase3-clara-lyra.test.ts`
- `docs/ai/BUILDING_RESOURCE_PERMISSIONS.md`
- `docs/ai/CLARA_CROCHET_SKILL.md`
- `docs/ai/LOCAL_DATA_MIGRATION_GUIDE.md`
- `docs/ai/LYRA_STUDY_SKILL.md`
- `docs/ai/PHASE_2_ACTIVATION_REPORT.md`
- `docs/ai/PHASE_2_RESOURCE_ARCHITECTURE.md`
- `docs/ai/PHASE_2_TEST_REPORT.md`
- `docs/ai/PHASE_3_SPECIALIST_SKILLS.md`
- `docs/ai/PHASE_3_TEST_REPORT.md`
- `docs/ai/PRIVATE_STORAGE_AND_SYNC.md`
- *(más este documento `docs/ai/PHASE_3_RELEASE_READINESS.md`)*

---

## 8. Commits Pendientes

- **Último commit en `origin/main`:** `47a7c8c` (`feat(ai-phase2): 8 building specialist chats, Level 2 confirmation proposals, and validated building resources API`).
- **Commits locales pendientes de push:** `0` commits creados todavía; los 27+ archivos anteriores residen intactos en el árbol de trabajo local de `main`, listos para agruparse en uno o dos commits atómicos cuando el usuario autorice.

---

## 9. Instrucciones de Prueba Manual (Solo Datos No Sensibles)

Ejecutar en local (`npm run dev`) o en un entorno de vista previa con un usuario de prueba y documentos ficticios (nunca extractos bancarios reales):

1. **Verificación de build completo fuera de sandbox:**
   - Ejecutar `npm run build` en una terminal local estándar y confirmar exit code `0` sin errores `EPERM`.
2. **Subida privada y URL firmada (Atelier / Crochet):**
   - Abrir el edificio de **Crochet (`atelier`)** → pestaña de biblioteca.
   - Subir un PDF o `.md` de prueba (p. ej. `patron-amigurumi-prueba.txt`).
   - Confirmar que aparece listado solo en `atelier` (y **no** en `biblioteca` ni `banco`).
   - Abrir el recurso y verificar que se descarga mediante URL firmada temporal (`/api/resources?id=...&signedUrl=1`) y que la URL pública directa del bucket devuelve `400/403`.
3. **Deduplicación y validación de tipos:**
   - Intentar subir el mismo archivo de prueba por segunda vez → debe responder `409 Conflict`.
   - Intentar subir un archivo no permitido (p. ej. `.exe` o extensión fuera de la taxonomía de `atelier`) → debe ser rechazado.
4. **Archivado reversible y restauración:**
   - Archivar el recurso de prueba (`DELETE`) → debe ocultarse de la lista activa pero conservarse con `deleted_at`.
   - Restaurar el recurso (`PATCH`) → debe volver a aparecer intacto con su enlace funcional.
5. **Clara (Crochet) y Lyra (Estudio):**
   - En **Crochet**, seleccionar el patrón de prueba en el panel de **Clara** y preguntar por materiales o abreviaturas → verificar respuesta fundamentada y propuesta Nivel 2 con confirmación antes de guardar notas.
   - En **Estudio (`biblioteca`)**, subir un apunte `.txt` o PDF con texto embebido, seleccionarlo en el panel de **Lyra** y pedir un quiz de prueba → verificar preguntas con citas `[Página N]` y confirmación Nivel 2 antes de crear flashcards SM-2.
6. **Rowan y bloqueo financiero:**
   - Preguntar a **Rowan** qué documentos recientes existen en el pueblo → debe listar solo metadatos autorizados.
   - Pedirle a cualquier asistente que "sume 500 XP" o "ejecute un pago en COP" → debe rechazar la acción autónoma.

---

## 10. Procedimiento de Despliegue (Solo Tras Aprobación del Usuario)

```powershell
# 1. Confirmar estado limpio de pruebas y build en terminal local
npx tsc --noEmit
npm test
npm run build

# 2. Revisar cambios a incluir
git status

# 3. Crear commit de liberación (Fases 2 + 3)
git add .
git commit -m "feat(ai-phase2-3): private building libraries, logical archive, and active Clara & Lyra skills"

# 4. Publicar en GitHub main (dispara despliegue configurado)
git push origin main
```

---

## 11. Plan de Reversión (Rollback)

- **Antes de `git push`:**
  - Si se requiere descartar el commit local sin perder el código: `git reset --soft HEAD~1`.
- **Después de `git push`:**
  - Revertir de forma segura y trazable sin reescribir historial:
    ```powershell
    git revert <commit_sha>
    git push origin main
    ```
- **Base de datos y Storage:**
  - Las migraciones `20261119_oakhaven_ai_phase1_sync.sql` y `20261119_phase2_private_storage_and_resources.sql` son **100% aditivas** y compatibles hacia atrás con el commit `47a7c8c`. No se requiere ejecutar `DROP TABLE` ni migraciones destructivas en caso de reversión del código de aplicación.
