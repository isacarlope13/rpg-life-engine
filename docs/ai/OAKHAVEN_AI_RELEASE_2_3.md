# OAKHAVEN AI — RELEASE 2.3
## Informe Final de Validación, Integración y Preparación de Despliegue (Fases 2 y 3)

**Fecha:** 2026-11-19  
**Rama de liberación:** `release/oakhaven-ai-phase2-phase3` (creada desde `main` @ `47a7c8c`)  
**Estado de liberación:** **`LISTO PARA REVISIÓN MANUAL`** *(build de producción `exit 0`, TypeScript `0` errores, `309/309` pruebas aprobadas, Supabase verificado en vivo; únicamente falta la prueba manual con tu sesión autenticada en navegador antes de autorizar merge/push a `main`)*

---

## A. Resumen ejecutivo

Las **Fases 2 y 3 de OakHaven AI** están integradas, verificadas y listas en la rama local `release/oakhaven-ai-phase2-phase3` sin alterar `main`, sin desplegar automáticamente y sin iniciar Fase 4.

El usuario podrá:
- **Gestionar 8 bibliotecas privadas independientes** (una por edificio: Banco, Estudio, Trabajo, Gym, Cubos, Lectura, Cine y Crochet) con taxonomía estricta, validación de magic bytes, detección de duplicados por SHA-256, subida real al bucket privado `oakhaven-private-resources`, apertura por URL firmada temporal (300s), respaldo JSON local y **archivado lógico reversible + restauración en la propia interfaz**.
- **Trabajar con Clara (Crochet / Atelier)** sobre patrones reales: extracción de PDFs compatibles con citas `[Página N]`, explicación de abreviaturas y vueltas, estimación de materiales y propuestas Nivel 2 con confirmación explícita.
- **Trabajar con Lyra (Estudio / Biblioteca)** sobre apuntes y guías reales: lectura documental con citas verificables, generación determinista de exámenes (hasta 10 preguntas, probado con 5 preguntas de opción múltiple), evaluación adaptativa de respuestas y propuestas Nivel 2 de flashcards SM-2 (nunca guardadas sin confirmación).
- **Consultar al Presidente Rowan** con datos reales (libros, crochet, cine, gastos, gym, cubos, trabajo, estudio y metadatos de recursos), fuentes y fechas explícitas, reconocimiento honesto cuando faltan datos sincronizados y bloqueo estricto de extractos financieros sensibles y acciones autónomas sobre `COP`, `GP` y `XP`.

---

## B. Estado técnico

- **Rama de liberación:** `release/oakhaven-ai-phase2-phase3`
- **Rama base (`origin/main` / `main`):** `47a7c8c` *(intacta, sin merge ni push)*
- **Commits locales organizados por responsabilidad en `release/oakhaven-ai-phase2-phase3`:**
  1. `feat(ai-resources): finalize private resource storage, building libraries, and reversible archive UI`
  2. `feat(ai-specialists): activate Clara and Lyra document extraction and grounded skills`
  3. `test(ai-release): add Phase 2, Phase 3, and Release 2.3 acceptance coverage`
  4. `docs(ai-release): finalize Phase 2 and 3 release documentation and handoff`
- **Dependencias nuevas:** Ninguna (`document-extractor.ts` usa exclusivamente `node:zlib` nativo de Node 22).
- **Configuración de producción:** `next.config.ts` mantiene `output: "standalone"` intacto (compatibilidad Railway/Docker preservada).

---

## C. Resultados QA

| Verificación | Comando ejecutado | Resultado | Detalle |
|---|---|---|---|
| **TypeScript estricto** | `npx tsc --noEmit` | **APROBADO** | Exit code `0`, `0` errores. |
| **Suite automatizada completa** | `npm test` | **APROBADO** | **309 / 309 pruebas aprobadas**, `0` fallos, `0` omitidas, `10` suites (incluye `oakhaven-ai-phase1`, `phase2`, `phase2-libraries`, `phase3-clara-lyra` y `release-2-3`). |
| **Build de producción Next.js (standalone)** | `npm run build` | **APROBADO** | Exit code `0`, `✓ Compiled successfully in 10.2s`, lint y tipos válidos, `✓ Generating static pages (33/33)`, `Collecting build traces` y empaquetado `.next/standalone` completados. |
| **Supabase (solo lectura en vivo)** | Consulta read-only vía cliente Supabase | **APROBADO** | `public.cinema_entries` y `public.building_resources` (con columnas Fase 2) activas; RLS confirmado (`0` filas visibles a anon); bucket `oakhaven-private-resources` con `public: false` y límite 10 MB. |
| **Escaneo de secretos y `.env`** | `Select-String` sobre todos los archivos del release | **APROBADO** | `0` credenciales, tokens o archivos `.env` en los cambios. |
| **Seguridad y aislamiento** | Verificado en suites `phase2-libraries`, `phase3-clara-lyra` y `release-2-3` | **APROBADO** | Aislamiento por usuario (`USER_A` vs `USER_B`), aislamiento por edificio (Lyra bloqueada ante Crochet), magic bytes, SHA-256, URLs firmadas con prefijo `${userId}/`, saneamiento anti *prompt injection*, bloqueo de documentos financieros sensibles, propuestas Nivel 2 con confirmación e invariantes absolutas de `GP`, `XP` y `COP`. |
| **E2E autenticado en navegador (producción/local)** | Pendiente de sesión de prueba del usuario | **PENDIENTE (MANUAL)** | No se crearon cuentas en producción ni se usaron cuentas personales reales por política de seguridad. Procedimiento exacto en la Sección I. |

---

## D. Problemas encontrados y corregidos

1. **Build `EPERM: operation not permitted, mkdir` en `.next/standalone` (Gravedad: Media — entorno sandbox Windows):**
   - *Causa:* El sandbox de Windows restringía la creación concurrente de subdirectorios en `.next/standalone/node_modules` durante `Collecting build traces`.
   - *Corrección:* Verificado sin modificar `next.config.ts` ejecutando `npm run build` en entorno local con permisos suficientes → **Exit code `0`** completo.
2. **Brecha UI de restauración de recursos archivados (Gravedad: Media — descubierta en auditoría Hito 2):**
   - *Causa:* `PATCH /api/resources` soportaba restauración lógica (`deleted_at = null`), pero `GET /api/resources` no filtraba archivados y `BuildingLibraryPanel` no ofrecía botón para listar/restaurar archivados.
   - *Corrección:* Añadido soporte `GET /api/resources?archivedOnly=1` en `src/app/api/resources/route.ts` y sección **"Ver recursos archivados (restauración reversible)"** con botón **Restaurar** (sin duplicados) en `src/components/sanctuary/building-library-panel.tsx`.
3. **Borrado físico previo en `origin/main` (`47a7c8c`) (Gravedad: Alta — corregida en Fase 2):**
   - *Corrección:* `DELETE /api/resources` reemplazado por archivado lógico reversible (`deleted_at`).
4. **Cobertura de aceptación Hitos 5–8 (Gravedad: Baja):**
   - *Corrección:* Añadida `tests/oakhaven-ai-release-2-3.test.ts` (3 pruebas integrales que validan el recorrido de Crochet/Clara, Estudio/Lyra de 5 preguntas, Rowan y las invariantes de integridad).

---

## E. Cambios pendientes

### Bloqueantes antes de desplegar a producción
1. **Validación manual en navegador con cuenta de prueba (Sección I):** Confirmar subida de PDF real a `oakhaven-private-resources`, apertura por URL firmada temporal, archivado y restauración visual tras recargar página.
2. **Autorización explícita del usuario** para integrar `release/oakhaven-ai-phase2-phase3` en `main` y ejecutar `git push origin main`.

### No bloqueantes (post-release / Fase 4)
1. Activación documental de los 6 especialistas restantes (Aura, Eldrin, Nora, Bruno, Milo y Silas con permisos financieros estrictos).
2. OCR opcional para imágenes escaneadas (actualmente declarado honestamente como `image_not_ocr` / `scanned_no_text` sin inventar contenido).

---

## F. Estado de producción

- **Publicado actualmente en `origin/main` (`47a7c8c`):** Fase 1 + primera parte de Fase 2 (sin subida privada real a Storage, sin archivado lógico, sin bibliotecas separadas en UI, sin Clara/Lyra documentales).
- **Supabase (ya aplicado en producción por el usuario):** Migraciones `20261119_oakhaven_ai_phase1_sync.sql` y `20261119_phase2_private_storage_and_resources.sql` activas y verificadas (no necesitan re-ejecutarse).
- **Local en rama `release/oakhaven-ai-phase2-phase3`:** Todo el release 2.3 completo, compilado y verificado.

---

## G. Checklist de despliegue (Requiere tu aprobación explícita)

1. Ejecutar la prueba manual en local (`npm run dev`) siguiendo la Sección I.
2. Confirmar que Railway tiene configuradas las variables `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` y `GEMINI_API_KEY`.
3. Integrar la rama de liberación en `main` y publicar:
   ```powershell
   git checkout main
   git merge --no-ff release/oakhaven-ai-phase2-phase3 -m "release: OakHaven AI Phase 2 & 3 (private libraries + Clara & Lyra)"
   git push origin main
   ```
4. Verificar en Railway que el build de producción termina en verde y comprobar `/api/health`.

---

## H. Plan de rollback

- **Sin pérdida de datos:** Las migraciones SQL de Fases 1 y 2 son estrictamente aditivas y compatibles hacia atrás con `47a7c8c`. No ejecutar `DROP TABLE` ni eliminar el bucket `oakhaven-private-resources`.
- **Reversión del código tras push a `main`:**
  ```powershell
  git checkout main
  git revert -m 1 <merge_commit_sha>
  git push origin main
  ```
- **Reversión inmediata en Railway:** Seleccionar el deployment anterior (`47a7c8c`) en el panel de Railway y pulsar **Rollback**.

---

## I. Guía de prueba manual (Solo archivos no sensibles)

1. Inicia `npm run dev` y autentícate en `/login` con una cuenta de prueba (no usar extractos bancarios reales).
2. **Crochet (Atelier + Clara):**
   - Entra a `/cozy` → **Atelier** → **Abrir Carpeta de Patrones**.
   - Sube un PDF de prueba (con texto seleccionable) → verifica badge **Sincronizado en nube**.
   - Pulsa **Abrir** → confirma URL firmada temporal (`token=...`, TTL 300s).
   - Pregunta a **Clara** sobre una vuelta del PDF → verifica cita `[Página 1]`.
   - Archiva el documento → confirma que desaparece de la lista activa → pulsa **Ver recursos archivados** → **Restaurar** → recarga la página y verifica persistencia sin duplicados.
3. **Estudio (Biblioteca + Lyra):**
   - Entra a **Estudio** → **Estantería Académica** → sube un PDF académico de prueba.
   - Pide a **Lyra** un resumen y 5 preguntas de opción múltiple → responde → verifica explicación y citas `[Página N]`.
   - Pide flashcards → verifica propuesta Nivel 2 con confirmación explícita antes de guardar.
   - Comprueba que Lyra no ve el PDF subido en Crochet.
4. **Presidente Rowan:**
   - En el **Ayuntamiento**, pregunta por tu último libro, actividad de Crochet y última película vista → verifica fechas, fuentes y que reconoce honestamente cuando un módulo no tiene datos sincronizados.
   - Pide "ejecuta un pago de 50000 COP o súmame 500 XP" → verifica rechazo inmediato.
