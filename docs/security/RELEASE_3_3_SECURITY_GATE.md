# OAKHAVEN — RELEASE 3.3: PRE-RELEASE SECURITY GATE (GO / NO-GO)

**Fecha:** 2026-11-20  
**Rama:** `feat/oakhaven-secure-personal-onboarding` (base `main` @ `c083a57`, Release 3.2)  
**Clasificación Final:** **`BLOQUEADO — CORRECCIONES NECESARIAS`** *(específicamente: pendiente verificación humana de `Site URL`/`Redirect URLs` + envío real de correo SMTP en Supabase Dashboard y prueba E2E visual en navegador del flujo completo de registro/onboarding antes de crear la cuenta real `isacarlope`)*

> **Transparencia QA:** Todos los defectos de código detectados en el gate (aislamiento de borradores financieros, RPC race-free y purga de datos históricos en `initial-financial-movements.ts`) fueron corregidos y probados en PostgreSQL real (PGlite). Se clasifica como `BLOQUEADO` únicamente porque las verificaciones de infraestructura de correo real (SMTP / `Site URL` / `Redirect URLs` / token de recuperación) y la prueba E2E de registro con correo real no pueden completarse ni simularse desde el entorno local sin intervención en Supabase Dashboard.

---

## 1. Correcciones Realizadas en este Security Gate
1. **GATE 2 — Aislamiento y separación de borradores financieros (`src/lib/onboarding/personal-onboarding-engine.ts`, `src/app/onboarding/page.tsx`, `src/app/api/onboarding/route.ts`):**
   - `GET /api/onboarding` ahora devuelve `user_id` verificado en servidor.
   - `saveOnboardingDraft` / `loadOnboardingDraft` rechazan claves compartidas (`"active"`, `"anon"`), guardan configuración no financiera por `userId` en `localStorage`, y restringen cifras financieras privadas **exclusivamente a `sessionStorage`** (volátil por pestaña; nunca persiste finanzas en `localStorage`).
   - Añadido `clearAllOnboardingDrafts()` ejecutado al recibir `401`, al completar el onboarding o al cambiar de identidad.
   - *Recomendación futura:* si se requiere retomar borradores financieros entre dispositivos, crear una tabla `public.onboarding_drafts` con RLS `auth.uid() = user_id` y TTL automático (sin inventar cifrado manual en frontend).
2. **GATE 3 — Persistencia atómica en PostgreSQL (`supabase/drafts/20261120_phase10_secure_onboarding_rpc.sql` + `tests/phase10-onboarding-pglite.test.ts`):**
   - `fn_phase10_upsert_onboarding_treasury` endurecida con `INSERT ... ON CONFLICT (user_id, billing_period) DO UPDATE` (100% libre de race conditions en guardados simultáneos), preservando `wallet_gp`, `player_level`, `current_xp`, `current_streak_days` y `spent_cop`.
   - Probado en PostgreSQL real aislado (PGlite) con `USER_A`, `USER_B`, `authenticated` y `anon`.
   - *Consistencia multi-tabla documentada:* `POST /api/onboarding` escribe cada sección (`profile`, `treasury`, `fixed_costs`, `bosses`, `skills`, `quests`, `wishlist`) de forma idempotente sin `DELETE` masivo y reporta `partialErrors` (`HTTP 207`) si una sección falla, permitiendo reintento seguro sin duplicados ni pérdida de progreso.
3. **GATE 4 — Sanitización de datos personales en fixtures de prueba (`src/lib/initial-financial-movements.ts`, `src/lib/onboarding-ai.ts`):**
   - Eliminados nombres personales reales (`Juanma`, `Saris`, `Somos`) del fixture de modo demo/pruebas `src/lib/initial-financial-movements.ts` y de `src/lib/onboarding-ai.ts`.
   - Confirmado que `initial-financial-movements.ts` solo se importa en `demo-store.ts` (modo demo en memoria) y **nunca** inicializa cuentas reales en Supabase ni se incluye en `/onboarding` o `/login`.

## 2. Resultados de Autenticación Real (GATE 1 — Supabase Auth)
- **Verificado directamente vía `GET /auth/v1/settings` (solo lectura):**
  - `email: true`
  - `disable_signup: false`
  - **`mailer_autoconfirm: false`** (**Confirm email ACTIVADO** en Supabase Auth).
  - `passkeys_enabled: false` (contraseñas robustas administradas por Supabase Auth es la credencial correcta).
- **Bloqueos pendientes de verificación humana en Supabase Dashboard (no accesibles por API pública anon):**
  - Confirmar `Site URL` = `https://rpg-life-engine-production.up.railway.app`.
  - Confirmar `Redirect URLs` incluye `https://rpg-life-engine-production.up.railway.app/login` y `https://rpg-life-engine-production.up.railway.app/login?mode=login`.
  - Confirmar entrega real de correo SMTP de confirmación y de recuperación de contraseña (token de un solo uso y caducidad) con una cuenta de prueba desechable (nunca cuenta personal real).

## 3. Resultados de Pruebas y Build (GATE 6)
- `npx tsc --noEmit`: **0 errores**.
- `npm test`: **340 / 340 pruebas aprobadas** (`17` suites, incluye `tests/phase10-onboarding-pglite.test.ts` en PostgreSQL real).
- `npm run build`: **APROBADO (exit code `0`, `35/35` rutas)**.
- **E2E visual en navegador del flujo completo con correo real (GATE 5):** Pendiente de ejecutar tras validar SMTP/`Redirect URLs` en Supabase Dashboard y desplegar la rama.

## 4. Plan de Despliegue y Rollback (solo tras resolver el bloqueo de Supabase Dashboard y autorización humana)
1. Verificar `Site URL`, `Redirect URLs` y SMTP en Supabase Dashboard.
2. Integrar `feat/oakhaven-secure-personal-onboarding` en `main` (`git merge --no-ff`) y publicar en Railway.
3. Probar registro + confirmación de correo + recuperación + onboarding con una cuenta de prueba desechable.
4. Una vez confirmado, la propietaria crea manualmente `isacarlope` desde `/login?mode=signup`.
5. **Rollback sin pérdida de datos:** `git revert -m 1 <merge_sha> && git push origin main` (sin SQL ejecutado en producción).
