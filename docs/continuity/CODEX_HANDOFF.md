# CODEX HANDOFF — OAKHAVEN RELEASE 3.3 (FAIL-CLOSED & ZERO-WINDOW INVITE) (2026-11-20)

- **Estado**: **`GO — LISTO PARA APROVISIONAMIENTO PRIVADO CON AUTORIZACIÓN HUMANA`** en rama `feat/oakhaven-secure-personal-onboarding` (base `main` @ `c083a57`, Release 3.2). Sin `push`, sin `merge`, sin despliegue, sin SQL en producción, sin cuenta `isacarlope` creada.
- **Guía definitiva Zero-Window**: `docs/security/RELEASE_3_3_PRIVATE_SINGLE_USER_GUIDE.md`.
- **Endurecimiento final aplicado**:
  1. `src/lib/single-user-guard.ts` + `src/lib/auth-login.ts`: **FAIL-CLOSED** estricto en producción cuando `OAKHAVEN_OWNER_USER_ID` falta, está vacío o es inválido (`503 OWNER_NOT_CONFIGURED`, `isAuthorizedSupabaseUserId = false`, registro público cerrado por defecto).
  2. `src/app/page.tsx` + `src/app/login/page.tsx` + `src/app/api/auth/login/route.ts`: soporte nativo para Supabase `Send invitation` (`#access_token=...&type=invite`) y recuperación (`type=recovery`), validando dueño del token vía `GET /auth/v1/user` contra `OAKHAVEN_OWNER_USER_ID` antes de `PUT /auth/v1/user` (sin `service_role`, sin `email_confirm: true`).
  3. **Evaluación de rollback documentada**: volver ciegamente a Release 3.2 (`c083a57`) no borra datos, pero bloquearía temporalmente el login UI por el antiguo validador PIN 4–8 dígitos; el rollback debe preservar `/login` alfanumérico + `single-user-guard`.
- **Pendiente (E2E real)**: solo se considerará completado tras ejecutar `Send invitation`, configurar Railway con el UUID real, desplegar y probar correo + login + recuperación reales.
