# OAKHAVEN RELEASE 3.3 — APROVISIONAMIENTO PRIVADO ZERO-WINDOW (`isacarlope`)

**Fecha:** 2026-11-20  
**Rama:** `feat/oakhaven-secure-personal-onboarding`  
**Clasificación:** **`GO — LISTO PARA APROVISIONAMIENTO PRIVADO CON AUTORIZACIÓN HUMANA`**  
*(Pendiente ejecución real en producción + prueba E2E real de correo y login tras autorización humana)*

---

## 1. Comportamiento Fail-Closed Verificado
1. **`src/lib/single-user-guard.ts`:**
   - En producción (`NODE_ENV === "production"`), el registro público está **siempre cerrado por defecto** (`publicSignupEnabled = false`).
   - Si `OAKHAVEN_OWNER_USER_ID` no existe, está vacío o no es un UUID válido, el sistema opera en modo **FAIL-CLOSED**:
     - `isAuthorizedSupabaseUserId(...)` devuelve `false` → `resolveAuthenticatedUser` y `resolveShortcutRequestUser` rechazan toda sesión y API token en todas las rutas privadas (`/api/state`, `/api/sync`, `/api/onboarding`, `/api/resources`, `/api/cinema`, `/api/ai/*`, `/api/shortcuts/*`).
     - `POST /api/auth/login` (tanto `login` como `update_password`) devuelve `HTTP 503 OWNER_NOT_CONFIGURED` y emite **cero cookies**.
2. **Compatibilidad con `Send invitation` de Supabase (`type=invite`):**
   - `src/app/page.tsx` detecta `#access_token=...&type=invite` o `type=recovery` si Supabase redirige al root `Site URL` y reenvía limpiamente a `/login?mode=reset#...`.
   - `src/app/login/page.tsx` captura el token en memoria React, limpia el hash de la URL con `window.history.replaceState(null, "", "/login?mode=reset")` y solicita establecer una contraseña robusta (10+ caracteres, letras + números).
   - `POST /api/auth/login` (`action: "update_password"`) verifica primero el dueño del token vía `GET /auth/v1/user` contra `isAuthorizedSupabaseUserId` (rechazando con `403 OWNER_ONLY_ACCESS` cualquier otro usuario) y solo entonces actualiza la contraseña con `PUT /auth/v1/user` (sin `service_role` ni `email_confirm: true`).

---

## 2. Procedimiento Zero-Window (Cero Ventana de Registro Público)

### Fase A — Preparar Supabase Dashboard (ANTES de desplegar Release 3.3)
1. **Authentication → Providers → Email:**
   - **Confirm email:** `ON`
   - **Allow new users to sign up:** `OFF` *(cierra el registro público desde el minuto cero)*.
2. **Authentication → URL Configuration:**
   - **Site URL:** `https://rpg-life-engine-production.up.railway.app`
   - **Redirect URLs:** añadir:
     - `https://rpg-life-engine-production.up.railway.app/login`
     - `https://rpg-life-engine-production.up.railway.app/login?mode=login`
     - `https://rpg-life-engine-production.up.railway.app/login?mode=reset`
3. **Authentication → Users → Invite user → `Send invitation`:**
   - Introducir **tu correo real personal** y pulsar **Send invitation** (NO usar `Create new user` con auto-confirmación).
   - Supabase genera inmediatamente el registro en `auth.users` con su **UUID real** y `email_confirmed_at = NULL`, y envía el correo real de invitación.
   - **Copiar tu User UID (`UUID` real)** desde la tabla de usuarios de Supabase. *(No abrir todavía el enlace del correo hasta completar la Fase B).*

### Fase B — Configurar Railway y Desplegar Release 3.3 (con autorización humana)
1. En **Railway → servicio `rpg-life-engine` → Variables**, configurar:
   - `OAKHAVEN_OWNER_USER_ID=<UUID_REAL_COPIADO_DE_SUPABASE>`
   - `OAKHAVEN_PUBLIC_SIGNUP_ENABLED=false`
2. Con tu autorización explícita, integrar `feat/oakhaven-secure-personal-onboarding` en `main` (`--no-ff`) y publicar en Railway.
3. Verificar `GET https://rpg-life-engine-production.up.railway.app/api/health` (`200`) y `GET /api/auth/login` (`{ privateMode: true, publicSignupEnabled: false, ownerConfigured: true }`).

### Fase C — Activar `isacarlope`, Confirmar Correo y Verificar Recuperación
1. Abrir el correo de invitación de Supabase y hacer clic en el enlace de activación:
   - Esto verifica realmente la propiedad de tu correo en Supabase Auth y te lleva a `/login?mode=reset` (sin exponer el token en el historial de URL).
2. Introducir tu **contraseña robusta personal** (12+ caracteres, letras y números, guardada en tu gestor de contraseñas) y pulsar **Guardar Nueva Contraseña**.
3. Iniciar sesión en `/login`, completar `/onboarding` con alias `isacarlope` y entrar a `/cozy`.
4. Verificar desde computador y celular, y confirmar que una prueba de `POST /api/auth/login` con `action: "signup"` devuelve `HTTP 403 PUBLIC_SIGNUP_DISABLED`.
5. Probar el flujo `¿Olvidaste tu contraseña?` → `/login?mode=reset` *(limitación documentada: el correo predeterminado de Supabase tiene límite bajo de envíos/hora y restricción a destinatarios autorizados; como contingencia ante agotamiento de cuota SMTP, la propietaria siempre puede enviar una recuperación desde Supabase Dashboard)*.

---

## 3. Evaluación Honesta de Rollback (Release 3.3 → Release 3.2)
- **Integridad de datos:** Un rollback de código a Release 3.2 (`c083a57`) **NO elimina ningún dato** en Supabase (no hay migraciones destructivas).
- **Riesgo de acceso temporal detectado:** En Release 3.2 (`c083a57`), la pantalla `/login` imponía validación cliente `!/^\d{4,8}$/` (PIN numérico de 4–8 dígitos). Si `isacarlope` ya tiene contraseña robusta alfanumérica de 12+ caracteres, **un rollback ciego a `c083a57` impediría temporalmente iniciar sesión desde la UI de `/login`** (aunque los datos permanecen intactos en Supabase).
- **Procedimiento seguro de rollback:** Si surgiera un fallo tras desplegar Release 3.3, aplicar un **hotfix o revert selectivo que conserve `src/app/login/page.tsx`, `src/lib/auth-login.ts` y `src/lib/single-user-guard.ts`** (nunca revertir `/login` al formulario de PIN de 4–8 dígitos).
