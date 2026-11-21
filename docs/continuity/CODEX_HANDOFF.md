# CODEX HANDOFF — OAKHAVEN RELEASE 3.3 (PRE-DEPLOY CHECK READY FOR APPROVAL) (2026-11-20)

- **Estado:** **`RELEASE 3.3 — PRE-DEPLOY CHECK READY FOR APPROVAL`** en rama `feat/oakhaven-secure-personal-onboarding` (base `main` @ `c083a57`, Release 3.2). Sin `push`, sin `merge`, sin aplicar variables pendientes, sin despliegue y sin abrir enlace de invitación.
- **Documento maestro actualizado:** `docs/security/RELEASE_3_3_DEPLOYMENT_READINESS.md`.
- **Verificaciones completadas en Pre-Deploy Check:**
  1. **Git:** `HEAD` base `68b2ebc`, `0 behind / 10 ahead` de `main @ c083a57`, `27 files changed (+4856/-3060)`, **0 secretos / 0 PII / 0 credenciales** en el diff.
  2. **Railway (solo lectura):** servicio `rpg-life-engine` (`production`) conectado únicamente a `isacarlope13/rpg-life-engine@main` (`RAILPACK`, `iad`, 1 réplica, 5/5 deploys desde `main`); patch staged `97e4c584-8815-4223-b9f9-da46a0c10649` confirmado con exactamente 2 variables pendientes (`OAKHAVEN_OWNER_USER_ID` y `OAKHAVEN_PUBLIC_SIGNUP_ENABLED`, valores redactados), 0 secretos en `NEXT_PUBLIC_*`.
  3. **SQL:** 0 migraciones bloqueantes requeridas para login u onboarding (`onboarding-persistence.ts` usa tablas existentes + fallback en `profiles`; `supabase/drafts/` no se invoca en runtime).
  4. **QA re-verificado:** `tsc --noEmit` = 0 errores · `npm test` = 348/348 · `npm run build` = aprobado (`35/35`).
- **Secuencia Zero-Window lista (esperando aprobación humana):**
  1. Verificar `PR Environments = OFF` en Railway.
  2. Registrar/aplicar las 2 variables staged en `production` **ANTES** del merge a `main` (`--skip-deploys` / `skipDeploys: true` o apply sobre Release 3.2) para garantizar `0 staged changes`.
  3. `git push` → PR → `merge --no-ff` a `main` → deploy único de Release 3.3 con `ownerConfigured: true` desde el arranque.
  4. Ejecutar smoke tests (`200`, `401`, `403`) y solo entonces abrir el enlace de invitación de `isacarlope`.
