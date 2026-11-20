# CODEX HANDOFF — OAKHAVEN RELEASE 3.3 (PRIVATE SINGLE-USER MODE) (2026-11-20)

- **Estado**: **`PRIVATE SINGLE-USER MODE — LISTO PARA REVISIÓN`** en rama `feat/oakhaven-secure-personal-onboarding` (base `main` @ `c083a57`, Release 3.2). Sin `push`, sin `merge`, sin despliegue, sin SQL en producción, sin cuenta `isacarlope` creada.
- **Guía paso a paso y arquitectura**: `docs/security/RELEASE_3_3_PRIVATE_SINGLE_USER_GUIDE.md` y `docs/security/RELEASE_3_3_SECURITY_GATE.md`.
- **Controles de Propietario Único implementados (defensa en profundidad)**:
  1. `src/lib/single-user-guard.ts`: `OAKHAVEN_OWNER_USER_ID` (UUID de Supabase) y `OAKHAVEN_PUBLIC_SIGNUP_ENABLED=false`.
  2. `src/lib/auth-login.ts` + `src/app/api/auth/login/route.ts` + `src/app/login/page.tsx`: bloquea `signup` con `403 PUBLIC_SIGNUP_DISABLED`, bloquea cualquier segundo UUID con `403 OWNER_ONLY_ACCESS` sin emitir cookies, oculta registro en UI (`GET /api/auth/login` sin exponer secretos) y mantiene `/login?mode=reset` + `action: "update_password"`.
  3. `src/lib/auth.ts`: `resolveAuthenticatedUser` y `resolveShortcutRequestUser` aplican `isAuthorizedSupabaseUserId` en todas las APIs y tokens personales.
  4. `supabase/drafts/20261120_phase10_single_user_rls_template.sql`: plantilla opcional de políticas RLS `AS RESTRICTIVE` por UUID (NO ejecutada).
- **QA**: `npx tsc --noEmit` (`0` errores), `npm test` (**346/346 aprobadas**, incluye `tests/single-user-private-mode.test.ts`), `npm run build` (`exit code 0`, `35/35` rutas).
