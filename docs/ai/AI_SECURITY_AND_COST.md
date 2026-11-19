# AI SECURITY AND COST — SEGURIDAD, PRIVACIDAD Y CONTROL DE CONSUMO

## 1. Niveles de Autonomía
- **Nivel 1 (Autorizado — Fase 1 activa):** Consultas de solo lectura, resúmenes con fecha/fuente y enlaces para abrir edificios.
- **Nivel 2 (Confirmación explícita — Fase 2+):** Proponer tareas, guardar recursos o editar proyectos únicamente tras botón de confirmación humana.
- **Nivel 3 (Prohibido permanentemente para IA autónoma):** Pagos, transferencias, modificación directa de saldos COP, alteración arbitraria de GP/XP, borrado masivo, cambios de permisos o despliegues.

## 2. Controles Implementados en Fase 1
1. **Identidad en servidor:** `POST /api/ai/mayor/chat` usa `requireShortcutUser(req)`; jamás acepta `userId` arbitrario del cliente ni del modelo.
2. **Aislamiento RLS:** Todas las consultas a Supabase filtran explícitamente por `.eq("user_id", authenticatedUserId)` sobre el cliente autenticado del usuario (sin `supabaseAdmin` para saltarse RLS).
3. **Lista blanca de herramientas:** `executeMayorReadOnlyTool` bloquea cualquier herramienta fuera de las 9 funciones de solo lectura autorizadas.
4. **Defensa contra Prompt Injection y acciones prohibidas:** `detectUnsafeActionRequest` intercepta intentos de pagos, alteración de GP/XP o instrucciones de bypass antes de llamar a herramientas o a Gemini.
5. **Redacción en logs:** `redactSensitiveForLogs` oculta correos, números de tarjeta y tokens/claves antes de escribir en `console.error`.
6. **Control de costos y límites:**
   - Rate limiting por usuario (`checkAiQuotaAllowance`: 12 req/min y 150 req/día).
   - Máximo 600 caracteres por mensaje, máximo 10 turnos de historial, máximo 3 herramientas por consulta, máximo 25 registros por consulta.
   - Timeout estricto de 7 segundos a Gemini (`gemini-2.5-flash`, `maxOutputTokens: 450`, `temperature: 0.2`) con **fallback determinista grounded automático** si Gemini falla o está desactivado.
   - Interruptor global (`OAKHAVEN_AI_ENABLED=false` en servidor) + interruptor visual **"Pulido IA"** en la UI del Ayuntamiento.
7. **Retención de historial:** Conversación guardada únicamente en memoria temporal de la sesión actual del navegador (máx. 10 turnos, botón *Limpiar conversación*, sin escritura en BD).
