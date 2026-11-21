# OAKHAVEN — FASE 10: IDENTIDAD SEGURA, ONBOARDING PERSONAL Y LIFE OS

**Fecha:** 2026-11-20  
**Rama:** `feat/oakhaven-secure-personal-onboarding` (base `main` @ `c083a57`, Release 3.2)  
**Estado:** **`OAKHAVEN — IDENTIDAD SEGURA Y ONBOARDING PERSONALIZADO IMPLEMENTADOS. LISTO PARA REVISIÓN HUMANA.`** *(sin `push`, sin `merge`, sin despliegue, sin ejecutar SQL en producción, sin crear cuenta real ni contraseñas)*

---

## 1. Hallazgos de Seguridad (Auditoría P0) y Soluciones

| Hallazgo P0 | Archivo Afectado | Causa Raíz | Solución Implementada |
|---|---|---|---|
| **Confirmación automática de correo vía `service_role`** | `src/lib/auth-login.ts` | El registro público invocaba `supabaseAdmin.auth.admin.createUser({ email_confirm: true })`, omitiendo la verificación real del correo. | Eliminado `admin.createUser` del flujo público `signup`. Ahora usa exclusivamente `supabaseAnon.auth.signUp` exigiendo confirmación real por correo (`needs_confirmation: true`, sin cookies hasta confirmar). |
| **PIN numérico débil (4–8 dígitos) y cuenta maestra embebida** | `src/app/login/page.tsx`, `src/lib/auth-login.ts` | El login imponía PIN de 4–8 dígitos y exponía credenciales piloto (`player1@rpg-life-engine.local` / `202611`) en el bundle público; faltaba recuperación y rate limiting. | Política de contraseña robusta en `signup` (`validateSignupPassword`: mínimo 10 caracteres, letras + números, rechaza PIN solo numérico), compatibilidad en `login` para usuarios existentes, flujo `recover` anti-enumeración (`resetPasswordForEmail`), rate limiter en memoria (`HTTP 429` + `Retry-After`) y eliminación de la tarjeta maestra del login público. |
| **Datos financieros personales del piloto precargados** | `src/app/onboarding/page.tsx` | El componente cliente contenía historial real Sep–Nov (`$2.415.000`, `Clases Juanma`, `Somos`, `Natillera`, `ADDI`, `Préstamo Nequi`). | Reemplazado por un wizard Cozy de 7 etapas que inicia **100% vacío** (`createEmptyOnboardingDraft`), con ejemplos claramente marcados como ilustrativos y confirmación humana explícita antes de persistir. |
| **Pérdida destructiva de progreso al repetir onboarding** | `src/app/api/onboarding/route.ts` | `player_treasury.upsert` reiniciaba `wallet_gp: 0`, `player_level: 1`, `current_xp: 0` y rachas; `fixed_costs`, `debt_bosses`, `user_skills`, `quest_catalog` y `wishlist_items` ejecutaban `DELETE` masivo antes de `INSERT`. | Creado `src/lib/onboarding/onboarding-persistence.ts`: separa modo `initial` vs `edit`, preserva `wallet_gp`/`player_level`/`current_xp`/`rachas`/`spent_cop`, aplica diffs idempotentes sin `DELETE` (salvo `confirm_destructive_replace: true`), reporta `partialErrors` (`HTTP 207`) y filtra por `.eq("user_id", userId)` incluso bajo `service_role`. |

### Nota sobre Remanentes Históricos en Git y Fixtures Demo
- Los commits previos en la historia compartida de Git y el fixture de demostración (`src/lib/initial-financial-movements.ts`, usado solo por `demo-store.ts`) conservan referencias históricas. **No** se reescribió la historia compartida de Git automáticamente; el bundle público de `/login` y `/onboarding` queda 100% libre de datos personales precargados.

---

## 2. Explicación Pedagógica de los Módulos Modificados y su Comunicación con Supabase

1. **`src/lib/auth-login.ts` + `src/app/login/page.tsx` (Backend Auth + UI):**
   - El frontend envía `{ email, password, action: "login" | "signup" | "recover", data_privacy_accepted }` a `POST /api/auth/login`.
   - El backend valida formato, aplica rate limiting por IP+correo y delega exclusivamente a `supabaseAnon.auth` (`signUp`, `signInWithPassword`, `resetPasswordForEmail`). Las cookies `HttpOnly` solo se emiten cuando Supabase devuelve una sesión verificada.
2. **`src/lib/onboarding/onboarding-persistence.ts` + `src/app/api/onboarding/route.ts`:**
   - `GET /api/onboarding` consulta en solo lectura disponibilidad del nombre (`check_name`) y si existe `player_treasury` para el periodo actual (`initial` vs `edit`).
   - `POST /api/onboarding` valida propiedad del usuario (`resolveAuthenticatedUser`), preserva progreso previo en `player_treasury` mediante `UPDATE` selectivo de presupuestos y sincroniza colecciones por clave normalizada sin borrados masivos ciegos.
3. **`src/lib/onboarding/personal-onboarding-engine.ts`:**
   - Centraliza las **8 áreas reales** (`Trabajo`, `Estudio`, `Gym`, `Lectura`, `Crochet`, `Cubos de Rubik`, `Cine y series` mediante su módulo `cinema` sin romper el enum `SkillDomain`, y `Journaling`), la ficha de personaje (`buildCharacterSheet`), el cálculo financiero real en COP separado de GP (`computeRealFinanceSummary`) y el guardado local de borradores.
   - Verificación solo lectura en Supabase: el alias **`isacarlope`** se encuentra **disponible** (`profiles count = 0`). No se creó ninguna cuenta ni contraseña.
4. **`src/lib/planner/adaptive-calendar-engine.ts`:**
   - Modela la rutina `America/Bogota` (`07:00–23:00`, trabajo `08:00–17:00`), protege comidas/descansos, diferencia bloques `confirmed` de `estimated` y sugiere micro-actividades para espacios libres (20–30 min) requiriendo confirmación humana (`autoStarted: false`).
5. **`src/lib/ai/rowan-decision-engine.ts`:**
   - Motor determinista de decisiones de Rowan (`usedGemini: false` por defecto) que coordina a los 8 especialistas entregando siempre los 7 campos obligatorios (acción, motivo, tiempo, datos usados, fecha de actualización, alternativa y controles aceptar/modificar/rechazar), con aislamiento financiero estricto y bloqueo Nivel 3 sobre dinero real.
6. **`supabase/drafts/20261120_phase10_secure_onboarding_rpc.sql`:**
   - Borrador opcional de función PostgreSQL transaccional (`SECURITY INVOKER`, `REVOKE ALL FROM PUBLIC, anon`, `GRANT EXECUTE TO authenticated`) para futura ejecución tras aprobación humana. **NO ejecutado en producción.**

---

## 3. Pruebas, Compatibilidad, Migración y Rollback
- **Pruebas:** `npx tsc --noEmit` (`0` errores), `npm test` (335 previas + nuevas pruebas Fase 10), `npm run build` (`exit code 0`).
- **Compatibilidad:** 100% compatible con Release 3.1 (`/api/sync` CAS + kill-switch) y Release 3.2 (Pueblo Vivo 5.0), sin cambios destructivos en base de datos.
- **Plan de migración:** El código funciona inmediatamente sin migraciones obligatorias; la función RPC en `supabase/drafts/20261120_phase10_secure_onboarding_rpc.sql` es opcional y aditiva.
- **Plan de rollback:** `git revert` del merge en `main` sin impacto en tablas ni registros financieros.
- **Riesgos pendientes:** Verificar el flujo real de correo de confirmación de Supabase SMTP en entorno productivo y la creación manual de la cuenta personal `isacarlope` directamente por la propietaria.
