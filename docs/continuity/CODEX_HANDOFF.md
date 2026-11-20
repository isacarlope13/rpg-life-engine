# CODEX HANDOFF — OAKHAVEN RELEASE 3.3 (PRE-RELEASE SECURITY GATE) (2026-11-20)

- **Estado**: **`BLOQUEADO — CORRECCIONES NECESARIAS`** (bloqueo externo de infraestructura: confirmar `Site URL`, `Redirect URLs` y envío SMTP real en Supabase Dashboard + E2E real de registro con cuenta de prueba desechable antes de crear `isacarlope`).
- **Rama**: `feat/oakhaven-secure-personal-onboarding` (base `main` @ `c083a57`, Release 3.2). Sin `push`, sin `merge`, sin despliegue, sin SQL en producción, sin cuenta personal creada.
- **Informe GO/NO-GO**: `docs/security/RELEASE_3_3_SECURITY_GATE.md`.
- **Hallazgos de código cerrados en este gate**:
  1. Borradores aislados por `userId` (`GET /api/onboarding` devuelve `user_id`), rechazando claves compartidas (`"active"`/`"anon"`), finanzas restringidas a `sessionStorage` + `clearAllOnboardingDrafts()`.
  2. RPC `fn_phase10_upsert_onboarding_treasury` endurecida con `ON CONFLICT DO UPDATE` (race-free) y probada en PostgreSQL real (`tests/phase10-onboarding-pglite.test.ts`).
  3. Purgados datos personales históricos de `src/lib/initial-financial-movements.ts` y `src/lib/onboarding-ai.ts`.
  4. Verificado en solo lectura en Supabase Auth: `mailer_autoconfirm: false` (Confirm email activado).
- **QA**: `npx tsc --noEmit` (`0` errores), `npm test` (**340/340 aprobadas**), `npm run build` (`exit code 0`, `35/35` rutas).
