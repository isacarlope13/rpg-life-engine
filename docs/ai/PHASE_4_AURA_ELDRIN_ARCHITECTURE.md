# OAKHAVEN AI FASE 4 — Arquitectura de Aura (Trabajo) y Eldrin (Lectura)

**Fecha:** 2026-11-19  
**Rama:** `feat/oakhaven-ai-phase4-aura-eldrin`

## 1. Evolución del Motor de Especialistas (`specialist-engine.ts`)

Antes de Fase 4, cada especialista ejecutaba siempre una sola herramienta principal. En Fase 4 se introdujo el planificador determinista **`selectAuthorizedToolsForIntent(skill, question, hasSelectedResource)`**:

1. **El servidor decide permisos, nunca el modelo:** el planificador selecciona herramientas únicamente dentro de la lista autorizada del edificio (`oficina` o `libreria`).
2. **Límite estricto por consulta (`MAX_TOOLS_PER_SPECIALIST_REQUEST = 4`):** evita consultar todas las herramientas en cada pregunta y reduce latencia y consumo de tokens.
3. **Flujo determinista primero, Gemini después:** primero se consultan datos reales (Supabase / estado de sesión / `building_resources`), se construye una respuesta verificada con citas y origen, y solo si `GEMINI_API_KEY` está activo y permitido se redacta el toque conversacional.

```text
Usuario pregunta en Oficina o Librería
   ↓
POST /api/ai/specialist/chat (autenticación + rate limit)
   ↓
askBuildingSpecialist()
   ├─ Defensa Nivel 3 (detectUnsafeActionRequest: bloquea pagos, COP, GP, XP)
   ├─ selectAuthorizedToolsForIntent() (máx. 4 herramientas del edificio)
   ├─ Ejecuta herramientas Nivel 1 + lectura segura de building_resources
   ├─ Construye propuesta Nivel 2 (requiresConfirmation: true + idempotencyKey)
   └─ Pulido opcional con Gemini (fallback determinista si falla o hay timeout)
```

## 2. Servicios Reutilizados (Sin Duplicación)

- **`building_resources` + `/api/resources`:** almacenamiento privado, validación por edificio, magic bytes, SHA-256, URL firmada temporal y archivado lógico reversible.
- **`src/lib/ai/resource-query-tools.ts`:** aislamiento estricto por `userId` y `buildingId`, saneamiento anti *prompt injection* y bloqueo de documentos financieros sensibles.
- **`src/lib/ai/document-extractor.ts`:** extracción de texto de `.txt`, `.md`, `.csv`, `.json` y PDFs compatibles con citas `[Página N]` y caché por `content_hash`.
- **`src/components/sanctuary/building-specialist-panel.tsx`:** un único panel reutilizado ahora con selector de documento para los 4 especialistas documentales activos (Clara, Lyra, Aura y Eldrin).

## 3. Autonomía Controlada y Persistencia Real

- **Nivel 1 (solo lectura):** consultas, análisis técnico, explicación de código, citas literarias y recomendaciones.
- **Nivel 2 (confirmación explícita):** cuando el usuario pulsa **Confirmar**, `BuildingSpecialistPanel` persiste la propuesta de Aura (plan de sprint / cierre de jornada) o Eldrin (reseña/nota literaria) mediante `POST /api/resources` con autenticación real. Cada propuesta incluye un `idempotencyKey` determinista para evitar duplicados.
- **Nivel 3 (bloqueado):** pagos, movimientos COP, alteración directa de GP/XP o modificación automática de archivos del repositorio.

## 4. Integración con Presidente Rowan

- `getPendingWorkProjects` consulta `activity_logs` (`domain = 'work'`) en Supabase y excluye estrictamente plantillas demostrativas (`demo-*` / `template-*`).
- `getLastReadBook` añade `currentlyReadingBook`, `pagesReadLast7Days` y `currentBookQuotes`, permitiendo a Rowan responder sobre libro actual, último terminado, páginas de la semana y citas guardadas con fecha y fuente reales.
