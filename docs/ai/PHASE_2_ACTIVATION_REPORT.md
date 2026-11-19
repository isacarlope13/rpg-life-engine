# OAKHAVEN AI — INFORME DE ACTIVACIÓN DE FASE 2 Y PREPARACIÓN DE FASE 3

**Fecha:** 2026-11-19  
**Rama local:** `main` (con cambios de activación de Fase 2 pendientes de revisión y aprobación antes de `commit`/`push`).

---

## 1. Reconciliación: Qué estaba en GitHub (`origin/main`) vs Qué estaba solo en local
- **En `origin/main` (`47a7c8c`):**
  - Fase 1 completa (`962b5ba`): Presidente Rowan, registro de 8 especialistas, `/api/ai/mayor/chat`, `/api/cinema`, `cinema-store.ts`, `atelier-patterns-store.ts` y `20261119_oakhaven_ai_phase1_sync.sql`.
  - Fase 2 parte 1 (`47a7c8c`): `specialist-engine.ts`, `/api/ai/specialist/chat`, `building-specialist-panel.tsx` y la versión inicial de `/api/resources` (que usaba borrado físico `.delete()` en `DELETE`).
- **Únicamente en entorno local (pendiente de subir a `origin/main` cuando autorices):**
  - `src/lib/ai/building-resources-engine.ts` (taxonomía de 8 edificios, magic bytes, path traversal, prompt-injection sanitizer).
  - `src/lib/ai/local-migration-engine.ts` (respaldo JSON y detección de conflictos).
  - `src/lib/ai/resource-query-tools.ts` (6 herramientas de consulta con aislamiento entre especialistas).
  - `src/components/sanctuary/building-library-panel.tsx` + montaje en `src/components/sanctuary/living-interior-room.tsx`.
  - Versión reforzada de `src/app/api/resources/route.ts` con **subida real a Supabase Storage**, **URL firmada temporal (300s)**, **deduplicación SHA-256**, **archivado lógico (`deleted_at`)** y **restauración (`PATCH`)**.
  - `supabase/drafts/20261119_phase2_private_storage_and_resources.sql` y `tests/oakhaven-ai-phase2-libraries.test.ts`.

---

## 2. Estado Real de Supabase (Verificación de solo lectura ejecutada en vivo)
- **`public.cinema_entries`:** ✅ EXISTE y accesible (`cinemaTableOk: true`).
- **`public.building_resources`:** ✅ EXISTE con todas las columnas de Fase 2 (`resource_type`, `original_filename`, `storage_path`, `deleted_at`, `content_hash`, `is_sensitive_financial`, `extraction_status`, `extracted_text`).
- **RLS activo:** ✅ Comprobado con cliente anónimo (`rlsAnonCinemaRowsReturned: 0`, `rlsAnonResourcesRowsReturned: 0`). No se consultaron ni expusieron datos financieros personales.

---

## 3. Estado Real de Supabase Storage
- **Bucket `oakhaven-private-resources`:** ✅ ENCONTRADO (`found: true`).
- **Privacidad:** ✅ **`public: false`** (sin URLs públicas permanentes).
- **Límite de tamaño:** ✅ `10485760` bytes (10 MB).
- **Aislamiento de rutas:** `${userId}/${buildingId}/${resourceId}_${safeName}` + validación de prefijo `${userId}/` antes de emitir `createSignedUrl(..., 300)`.

---

## 4. Qué archivos se pueden subir
- Subida real `multipart/form-data` en `POST /api/resources` validada en servidor por **magic bytes**, extensión, MIME, path traversal, tamaño y propietario:
  - **Crochet (`atelier`):** PDF, PNG, JPG, WebP, TXT, MD (`crochet_pattern`, `stitch_diagram`, `progress_photo`, `yarn_reference`, `material_list`, máx. 5 MB).
  - **Estudio (`biblioteca`):** PDF, MD, TXT, CSV, imágenes (`study_notes`, `lecture_pdf`, `assignment`, `course_resource`, `flashcards_source`, máx. 10 MB).
  - **Trabajo (`oficina`):** PDF, MD, TXT, JSON, imágenes (`project_document`, `technical_spec`, `source_file`, `task_attachment`, `deliverable`, máx. 10 MB).
  - **Banco (`banco_oakhaven`):** PDF, CSV, imágenes (`receipt`, `bank_statement`, `budget`, `financial_document`, máx. 8 MB, marcados `is_sensitive_financial: true` y excluidos de lectura automática por IA).
  - **Gym, Cubos, Lectura, Cine:** sus tipos específicos en `BUILDING_LIBRARY_CONFIG` (máx. 5 MB).

---

## 5. Qué bibliotecas funcionan
- **Los 8 edificios definitivos** (`Banco`, `Estudio`, `Trabajo`, `Gym`, `Cubos`, `Lectura`, `Cine`, `Crochet`) tienen su propia biblioteca temática en `LivingInteriorRoom`, con subida real `FormData`, botón **`Abrir`** por URL firmada temporal, respaldo JSON y archivado lógico con confirmación.

---

## 6. Qué puede consultar Rowan y los 8 especialistas
- **Rowan:** las 9 herramientas históricas (libros, crochet, cine multidispositivo en Supabase, gastos COP, gym, cubos, trabajo, estudio, resumen) + metadatos de `building_resources` del propietario, bloqueando siempre lectura automática de texto de documentos financieros sensibles.
- **8 especialistas (`Silas`, `Lyra`, `Aura`, `Bruno`, `Milo`, `Eldrin`, `Nora`, `Clara`):** acceso estricto únicamente a su edificio asignado (aislamiento verificado en pruebas).

---

## 7. Errores corregidos en esta sesión
1. **Reemplazado borrado físico en `DELETE /api/resources`** por **archivado lógico (`deleted_at`)** + endpoint `PATCH /api/resources` (`action: "restore"`) para recuperación segura.
2. **Validación real de contenido en servidor:** lectura de bytes binarios reales en `POST /api/resources` (magic bytes + SHA-256 `content_hash` + `upsert: false` + rollback automático en Storage si falla la inserción en BD).
3. **Subida real a Supabase Storage** (`oakhaven-private-resources`) y descarga mediante **URL firmada temporal de 5 minutos (`GET /api/resources?id=...&signedUrl=1`)**.

---

## 8. Pruebas ejecutadas y resultados

| Verificación | Estado | Resultado |
|---|---|---|
| `npx tsc --noEmit` | **PASÓ** | 0 errores de TypeScript. |
| `npm test` (suite completa) | **PASÓ** | **303 / 303 pruebas aprobadas**, 0 fallos, 0 omitidas (8 suites). |
| Verificación en vivo Supabase (solo lectura) | **PASÓ** | `cinema_entries`, `building_resources`, RLS y bucket `oakhaven-private-resources` (`public: false`) verificados. |
| Prueba funcional E2E en navegador con PDF real | **NO EJECUTADO** | Requiere sesión autenticada real del usuario (ver sección 10). |
| `npm run build` | **NO EJECUTADO** en esta iteración | Evitado para no repetir `EPERM` local transitorio de Windows en `.next/standalone`; se recomienda correr en CI/Vercel al autorizar push. |

---

## 9. Pendientes para Fase 3
1. Activar análisis documental bajo demanda con Gemini sobre texto extraído no financiero (Clara leyendo patrones, Lyra leyendo apuntes, Aura leyendo specs).
2. Extracción determinista de texto de PDFs no sensibles (si decides incorporar una librería ligera de parsing PDF en servidor).
3. UI de recuperación de archivos archivados (`deleted_at IS NOT NULL` → botón *Restaurar*).

---

## 10. Instrucciones de revisión manual (Prueba Piloto Crochet — Hito 5)
1. Inicia local: `npm run dev` en `C:\Users\isaca_6khxtdy\.gemini\antigravity\scratch\rpg-life-engine`.
2. Inicia sesión con tu cuenta en `/login` y abre `/cozy` → entra al **Atelier (Crochet)**.
3. Pulsa **`🧶 Abrir Carpeta de Patrones`** → elige `Patrón de crochet` → sube un **PDF de prueba no sensible** → pulsa **`Guardar en Biblioteca`**.
4. Verifica el badge **`Sincronizado en nube`** y pulsa **`Abrir`** para comprobar que abre mediante URL firmada temporal (`token=...`).
5. Intenta subir el mismo PDF otra vez y verifica que bloquea el duplicado (`409`).
6. Abre el **Ayuntamiento** → pregunta a **Rowan** sobre tus proyectos de crochet y comprueba que responde con tus datos reales.
7. Cuando todo se vea bien, autorízame a hacer `commit` y `push` a `origin/main` para desplegarlo a producción.
