# OAKHAVEN RELEASE 3.3 — GUÍA DE MODO PRIVADO DE PROPIETARIO ÚNICO (`isacarlope`)

**Fecha:** 2026-11-20  
**Rama:** `feat/oakhaven-secure-personal-onboarding`  
**Clasificación:** **`PRIVATE SINGLE-USER MODE — LISTO PARA REVISIÓN`**  
**Costo de correo:** `$0` (no requiere Resend, SMTP propio ni dominio personalizado para uso personal de 1 propietario).

---

## 1. Defensa en Profundidad Implementada
1. **Guardia central (`src/lib/single-user-guard.ts`):**
   - `OAKHAVEN_OWNER_USER_ID=<UUID>`: restringe toda autenticación y sesión de Supabase exclusivamente al UUID del propietario autorizado.
   - `OAKHAVEN_PUBLIC_SIGNUP_ENABLED=false` (también automático cuando `OAKHAVEN_OWNER_USER_ID` está configurado): cierra el registro público devolviendo `HTTP 403 PUBLIC_SIGNUP_DISABLED` sin contactar Supabase.
2. **Protección en todas las capas (no solo UI):**
   - **Frontend (`/login`):** consulta `GET /api/auth/login` (solo booleans, cero UUIDs ni secretos) y oculta `"Crear cuenta nueva"` mostrando `"🔒 Registro público cerrado"`.
   - **Endpoint de login (`src/lib/auth-login.ts`):** bloquea `signup` con `403` y bloquea cualquier segundo UUID de Supabase con `403 OWNER_ONLY_ACCESS` sin emitir cookies.
   - **Todas las APIs y tokens personales (`src/lib/auth.ts`):** `resolveAuthenticatedUser` y `resolveShortcutRequestUser` verifican `isAuthorizedSupabaseUserId(...)`, bloqueando automáticamente `/api/state`, `/api/sync`, `/api/onboarding`, `/api/resources`, `/api/cinema`, `/api/ai/*`, `/api/shortcuts/*` y `/api/gamemaster/*` para cualquier otra identidad.
   - **Aislamiento de Demo:** el modo Demo corre aislado en memoria (`local_engine`) y nunca accede ni modifica las tablas Supabase del propietario.
   - **Cero puertas traseras administrativas:** `allowDemoBootstrap` es `false` en producción y `signup` nunca invoca `service_role`.

---

## 2. Procedimiento Paso a Paso para Crear `isacarlope` y Cerrar el Registro
*(Ejecutar manualmente SOLO después de revisar, aprobar y desplegar esta rama en Railway)*:

### Paso 1 — Configurar URLs en Supabase Dashboard (1 vez, gratis)
1. Abrir **Supabase Dashboard → Authentication → URL Configuration**:
   - **Site URL:** `https://rpg-life-engine-production.up.railway.app`
   - **Redirect URLs:** añadir:
     - `https://rpg-life-engine-production.up.railway.app/login`
     - `https://rpg-life-engine-production.up.railway.app/login?mode=login`
     - `https://rpg-life-engine-production.up.railway.app/login?mode=reset`
2. Confirmar en **Authentication → Providers → Email** que **Confirm email** está activado (`ON`).

### Paso 2 — Aprovisionar tu única cuenta `isacarlope`
Tienes dos opciones igualmente seguras:
- **Opción A (Registro con correo predeterminado de Supabase):**
  1. Abrir `https://rpg-life-engine-production.up.railway.app/login?mode=signup`.
  2. Crear tu cuenta con tu correo real, alias `isacarlope` y una contraseña robusta única (12+ caracteres en tu gestor de contraseñas).
  3. Confirmar el enlace que llega a tu correo.
- **Opción B (Creación administrativa directa desde Supabase Dashboard si el SMTP predeterminado limita entrega):**
  1. Ir a **Supabase Dashboard → Authentication → Users → Add user → Create new user**.
  2. Introducir tu correo real y tu contraseña robusta personal (marcando *Auto Confirm User* únicamente porque eres tú autenticada en tu propio panel de Supabase).

### Paso 3 — Copiar tu UUID y Activar el Candado de Propietario Único
1. En **Supabase Dashboard → Authentication → Users**, copiar tu **User UID** (`UUID`).
2. En **Supabase Dashboard → Authentication → Providers → Email**, desactivar **Allow new users to sign up** (`OFF`).
3. En **Railway → Variables** del servicio `rpg-life-engine`, añadir:
   - `OAKHAVEN_OWNER_USER_ID=<TU_UUID_DE_SUPABASE>`
   - `OAKHAVEN_PUBLIC_SIGNUP_ENABLED=false`
4. *(Opcional, refuerzo a nivel de base de datos)*: aplicar las políticas `AS RESTRICTIVE` de `supabase/drafts/20261120_phase10_single_user_rls_template.sql` sustituyendo `<OWNER_UUID_REAL>`.

### Paso 4 — Entrar desde Computador y Celular + Completar Onboarding
1. Iniciar sesión en `https://rpg-life-engine-production.up.railway.app/login` desde computador y celular.
2. Completar `/onboarding` con tus 8 áreas, rutina `07:00–23:00` / trabajo `08:00–17:00` y cifras reales en COP.

---

## 3. Recuperación de Acceso y Limitaciones sin SMTP Personalizado
- La aplicación incluye pantalla funcional `/login?mode=reset` + `action: "update_password"` (`PUT /auth/v1/user` con el token de recuperación, sin `service_role`).
- **Limitación documentada sin SMTP propio:** El correo predeterminado de Supabase tiene límite bajo de envíos/hora y solo garantiza entrega a direcciones autorizadas del equipo del proyecto. Si alguna vez no llegara el correo de recuperación, la propietaria siempre puede restablecer su contraseña directamente desde **Supabase Dashboard → Authentication → Users** (con su propio acceso autenticado a Supabase).
