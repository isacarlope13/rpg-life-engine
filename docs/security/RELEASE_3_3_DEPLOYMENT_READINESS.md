# OAKHAVEN RELEASE 3.3 — DEPLOYMENT READINESS

**Fecha:** 2026-11-20  
**Proyecto:** OakHaven / RPG Life-Engine (`isacarlope13/rpg-life-engine`)  
**Rama local:** `feat/oakhaven-secure-personal-onboarding`  
**Base publicada en producción (`main`):** `c083a57` (Release 3.2)  
**Clasificación Final:** **`READY FOR HUMAN PROVISIONING`**  
*(Preparación técnica y de seguridad completada y verificada en local. Pendiente de acciones humanas en Supabase Dashboard, Railway y autorización explícita para publicar y ejecutar E2E real. NO desplegado, NO live, NO E2E verificado).*

---

## 1. Tabla de Control Obligatoria

| Control | Estado | Evidencia | Acción pendiente |
| :--- | :--- | :--- | :--- |
| **Código** | ✅ Listo (local) | `feat/oakhaven-secure-personal-onboarding` sobre `main @ c083a57`; `tsc --noEmit` = 0 errores; `npm test` = 348/348 aprobadas; `npm run build` aprobado; cero fallbacks a `demoStore` en `src/app/api/**`. | Autorización humana para `git push`, integración controlada (`--no-ff`) en `main` y despliegue en Railway. |
| **Auth** | ✅ Verificado (fail-closed) | 9/9 escenarios fail-closed auditados y cubiertos por tests (`tests/single-user-private-mode.test.ts` y `tests/oakhaven-phase10-secure-onboarding.test.ts`), incluyendo `widget-summary` sin `demoStore`, evaluación previa a `profiles`, `legacy_secret` protegido y UI fail-closed en `/login`. | Ninguna corrección de código pendiente; validar en vivo tras despliegue. |
| **Supabase URLs** | ⏳ Pendiente humano | `GET /auth/v1/settings` confirmó `email: true`, `mailer_autoconfirm: false`, `disable_signup: false`, pero sin Management Token no es posible leer `Site URL` ni `Redirect URLs`. | Confirmar en Supabase Dashboard `Site URL` y añadir `/login`, `/login?mode=login` y `/login?mode=reset` en `Redirect URLs`, y cambiar `Allow new users to sign up` a `OFF`. |
| **Email** | ⏳ Pendiente prueba real | `mailer_autoconfirm: false` confirmado; flujos `Send invitation` (`type=invite`) y recuperación (`type=recovery`) implementados sin `service_role` ni auto-confirmación. Correo predeterminado de Supabase tiene cuota baja/hora y restricción de destinatarios autorizados. | Enviar invitación real (`Send invitation`) al correo personal de la propietaria y comprobar recepción real (invitación + recuperación). |
| **Owner UUID** | ⏳ Pendiente aprovisionamiento | `GET /rest/v1/profiles?display_name=ilike.isacarlope` = `0` registros; cuenta `isacarlope` aún no creada. Sin `OAKHAVEN_OWNER_USER_ID`, producción bloquea todo acceso en modo fail-closed (`503 OWNER_NOT_CONFIGURED`). | Ejecutar `Invite user` en Supabase Dashboard y copiar el `User UID` real generado. |
| **Railway** | ⏳ Pendiente variables y deploy | Inspección de solo lectura (solo nombres de variables, sin valores) en proyecto `independent-fascination` / servicio `rpg-life-engine` (`production`): 15 variables presentes, cero secretos con prefijo `NEXT_PUBLIC_`; `OAKHAVEN_OWNER_USER_ID` y `OAKHAVEN_PUBLIC_SIGNUP_ENABLED` aún no configuradas. | Crear `OAKHAVEN_OWNER_USER_ID=<UUID_REAL>` y `OAKHAVEN_PUBLIC_SIGNUP_ENABLED=false` en Railway ANTES de desplegar Release 3.3. |
| **E2E** | ⏳ No ejecutado (requiere prod) | Ninguna cuenta personal real creada ni correo real enviado en pruebas automatizadas. | Ejecutar Plan E2E Real (Sección 7) tras desplegar Release 3.3 en producción. |
| **Rollback** | ✅ Estrategia documentada | Auditado conflicto crítico en Release 3.2 (`c083a57`): `/login` exigía PIN numérico de 4–8 dígitos (`!/^\d{4,8}$/`). Un rollback ciego no borra datos pero bloquearía temporalmente la UI para contraseñas de 12+ caracteres. | Aplicar únicamente rollback selectivo / hotfix que preserve `/login` alfanumérico, `auth-login.ts` y `single-user-guard.ts` (Sección 8). |

---

## 2. Estado Actual de Git

- **Repositorio:** `isacarlope13/rpg-life-engine`
- **Rama actual:** `feat/oakhaven-secure-personal-onboarding`
- **Base remota/publicada (`main`):** `c083a57` (Release 3.2 — despliegue vivo actual en Railway: `b8d94dce-f304-4bef-b86b-d5b3700bd08d`)
- **Restricciones respetadas:**
  - Sin `git push`, sin `git merge`, sin despliegue en Railway.
  - Sin SQL aplicado en producción (borradores permanecen únicamente en `supabase/drafts/`).
  - Sin cuenta personal `isacarlope` creada y sin modificación de datos reales.
  - Fuera de alcance (NO implementados): OakHaven Ink (Galaxy Tab S Pen), OakHaven Wrist (Apple Watch) y Rowan Everywhere.

---

## 3. Auditoría de Seguridad Fail-Closed (9 Escenarios — Frontend y Backend)

### Hallazgos corregidos durante esta auditoría final
1. **P0 cerrado — Eliminado el único fallback restante a `demoStore` en APIs:**
   - En `src/app/api/shortcuts/widget-summary/route.ts`, una petición no autenticada caía en `const store = authCtx.ok ? authCtx.store : demoStore;` devolviendo HTTP `200` con datos demo.
   - **Corrección aplicada:** se eliminó `demoStore` y ahora retorna `if (!authCtx.ok) return authCtx.response;` (`401` sin credenciales, `403` si el token pertenece a una identidad no autorizada). Una búsqueda recursiva sobre `src/app/api/**/*.ts` confirma **0 referencias a `demoStore`**.
2. **Defensa en profundidad en `src/lib/auth.ts`:**
   - `isAuthorizedSupabaseUserId(sbUser.id)` se movió **antes** de crear `userClient` y consultar `public.profiles`, evitando cualquier lectura de base de datos para UUIDs no autorizados.
   - Se añadió `isAuthorizedSupabaseUserId(String(legacyOwnerId))` también en la rama de compatibilidad `SHORTCUTS_API_SECRET`.
3. **UI Fail-Closed en `src/app/login/page.tsx`:**
   - `publicSignupEnabled` inicia en `false` y `privateMode` en `true` hasta consultar `GET /api/auth/login`, evitando cualquier parpadeo del botón de registro público o acceso visual a `/login?mode=signup` en producción. Si `ownerConfigured === false`, muestra aviso neutro de cierre preventivo sin exponer UUIDs ni detalles internos.

### Matriz verificada de los 9 escenarios

| # | Escenario | Backend (`single-user-guard.ts`, `auth-login.ts`, `auth.ts`, `api/**`) | Frontend (`login/page.tsx`, `page.tsx`, `onboarding/page.tsx`) | Estado |
| :-: | :--- | :--- | :--- | :---: |
| 1 | `OAKHAVEN_OWNER_USER_ID` ausente en producción | `ownerConfigInvalid = true`, `publicSignupEnabled = false`, `POST /api/auth/login` → `503 OWNER_NOT_CONFIGURED` (0 cookies), `isAuthorizedSupabaseUserId` → `false` en todas las APIs. | `GET /api/auth/login` reporta `ownerConfigured: false`; `/login` oculta registro y muestra aviso de cierre preventivo. | ✅ |
| 2 | `OAKHAVEN_OWNER_USER_ID` vacío (`""`) en producción | Idéntico comportamiento fail-closed (`503 OWNER_NOT_CONFIGURED`, 0 cookies, APIs bloqueadas). | Idéntico cierre visual en `/login`. | ✅ |
| 3 | `OAKHAVEN_OWNER_USER_ID` inválido (no UUID) en cualquier entorno | `ownerConfigInvalid = true` incluso fuera de producción (`503 OWNER_NOT_CONFIGURED`, `isAuthorizedSupabaseUserId = false`). | `ownerConfigured: false` y sin botón de registro. | ✅ |
| 4 | Sesión con UUID distinto al propietario | `POST /api/auth/login` → `403 OWNER_ONLY_ACCESS` (0 cookies). `resolveAuthenticatedUser` rechaza antes de leer `profiles`; tokens personales/legacy devuelven `403`. | Muestra mensaje de acceso denegado sin establecer sesión ni redirigir a `/cozy`. | ✅ |
| 5 | Sesión no autenticada en rutas privadas | Todas las rutas privadas (`/api/state`, `/api/sync`, `/api/onboarding`, `/api/resources`, `/api/cinema`, `/api/ai/*`, `/api/shortcuts/*` incluido `widget-summary`) devuelven `401 Unauthorized`. `POST /api/auth/demo` devuelve `403` en producción. | `/onboarding` redirige a `/login` ante `401`; ningún endpoint entrega datos demo como respaldo. | ✅ |
| 6 | Intento de registro público (`action: "signup"`) | `POST /api/auth/login` → `403 PUBLIC_SIGNUP_DISABLED` sin contactar a Supabase. | Botón de registro reemplazado por `🔒 Registro público cerrado`; `/login?mode=signup` revierte a `login`. | ✅ |
| 7 | Token de invitación/recuperación de otro usuario | `POST /api/auth/login` (`action: "update_password"`) valida `GET /auth/v1/user` contra `isAuthorizedSupabaseUserId` ANTES de `PUT /auth/v1/user` → `403 OWNER_ONLY_ACCESS` (0 cookies). | Muestra error `403`, no guarda contraseña y limpia el hash de la URL (`history.replaceState`). | ✅ |
| 8 | Token de invitación/recuperación expirado o inválido | `GET /auth/v1/user` falla → `401` genérico + rate limiter, 0 cookies. | Deshabilita envío sin token y muestra aviso claro para solicitar nuevo enlace. | ✅ |
| 9 | Propietaria autorizada (`UUID` coincide) | `POST /api/auth/login` → `200` + cookies `HttpOnly; SameSite=Lax; Secure`; acceso completo a todas las rutas privadas y onboarding no destructivo. | Acceso limpio a `/login?mode=reset` (invitación/recuperación), `/onboarding` y `/cozy`. | ✅ |

---

## 4. Verificación de Supabase Auth (Solo Lectura)

- **Comprobado sin modificar nada en producción:**
  - `GET /auth/v1/settings`:
    - Proveedor Email: `true`
    - `mailer_autoconfirm`: `false` *(Confirm email activado ✅)*
    - `disable_signup`: `false` *(requiere cambiar **Allow new users to sign up → OFF** en Supabase Dashboard antes del alta).*
  - `GET /rest/v1/profiles?display_name=ilike.isacarlope&select=id&limit=1`: HTTP `200`, `count = 0` *(alias `isacarlope` libre ✅)*.
  - Esquema Release 3.1 (`gym_workout_sets`, `work_projects`, `work_project_tasks`, `rubik_cubes.sync_version`): HTTP `200` en sondeo de solo lectura.
- **No legible por API pública (requiere verificación humana en Supabase Dashboard):**
  - `Site URL`
  - `Redirect URLs`
  - Cuota exacta y estado de entrega del correo predeterminado de Supabase (sin Management Token).
- **Límites conocidos del correo predeterminado de Supabase (sin Resend/SMTP propio para el MVP privado):**
  - Tasa baja de envíos por hora y restricción a direcciones autorizadas del proyecto/organización.
  - **Contingencia documentada:** si se agota temporalmente la cuota durante pruebas, esperar la ventana de restablecimiento o reenviar la recuperación directamente desde Supabase Dashboard.

---

## 5. Verificación de Railway (Solo Lectura — Sin Exponer Valores)

- **Proyecto:** `independent-fascination`
- **Servicio:** `rpg-life-engine` · **Entorno:** `production`
- **URL pública:** `https://rpg-life-engine-production.up.railway.app`
- **Despliegue actual en vivo:** `main @ c083a57` (Release 3.2)
- **Variables existentes verificadas (solo nombres, 15 en total):**
  - Aplicación: `GEMINI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
  - Plataforma Railway: `RAILWAY_ENVIRONMENT*`, `RAILWAY_PROJECT*`, `RAILWAY_SERVICE*`, `RAILWAY_PUBLIC_DOMAIN`, `RAILWAY_PRIVATE_DOMAIN`, `RAILWAY_STATIC_URL`.
- **Auditoría de exposición `NEXT_PUBLIC_`:** ✅ Ningún secreto (`SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, ni futuro `OAKHAVEN_OWNER_USER_ID`) lleva prefijo `NEXT_PUBLIC_`.
- **Variables requeridas para Release 3.3 (a crear por la propietaria en Etapa B):**

| Variable (Railway · `production`) | Valor requerido | Visibilidad | Propósito |
| :--- | :--- | :--- | :--- |
| `OAKHAVEN_OWNER_USER_ID` | `<UUID_REAL_DE_SUPABASE>` | Solo servidor (NO `NEXT_PUBLIC_`) | Habilita exclusivamente la identidad propietaria `isacarlope`. |
| `OAKHAVEN_PUBLIC_SIGNUP_ENABLED` | `false` | Solo servidor | Cierre explícito del registro público (respaldado además por fail-closed en producción). |

---

## 6. Procedimiento Zero-Window (Etapas A–E)

Este orden garantiza **0 segundos de ventana con registro público abierto** y **0 riesgo de auto-bloqueo**.

### Etapa A — Preparación e Invitación en Supabase Dashboard (Acción Humana)
1. Ir a **Supabase Dashboard → Authentication → Providers → Email**:
   - Verificar **Confirm email = ON**.
   - Cambiar **Allow new users to sign up = OFF** y guardar.
2. Ir a **Authentication → URL Configuration**:
   - **Site URL:** `https://rpg-life-engine-production.up.railway.app`
   - **Redirect URLs:** verificar/añadir exactamente:
     - `https://rpg-life-engine-production.up.railway.app/login`
     - `https://rpg-life-engine-production.up.railway.app/login?mode=login`
     - `https://rpg-life-engine-production.up.railway.app/login?mode=reset`
3. Ir a **Authentication → Users → Add user → `Invite user` (`Send invitation`)**:
   - Ingresar tu **correo personal real** y pulsar **Send invitation**.
   - **NO** usar `Create new user` con auto-confirmación.
   - **NO abrir todavía** el enlace del correo recibido (esperar a completar las Etapas B y C para que el enlace aterrice ya en Release 3.3).
4. En la tabla de **Users**, copiar el **User UID (`UUID` real)** recién generado para tu cuenta.

### Etapa B — Configurar Variables en Railway (Acción Humana)
1. Abrir **Railway → `independent-fascination` → servicio `rpg-life-engine` → Variables (`production`)**.
2. Agregar las dos variables:
   - `OAKHAVEN_OWNER_USER_ID=<UUID_REAL_COPIADO_EN_ETAPA_A>`
   - `OAKHAVEN_PUBLIC_SIGNUP_ENABLED=false`
3. Verificar que no existan espacios en blanco al inicio o final del UUID.

### Etapa C — Publicación Controlada de Release 3.3 (Comandos listos — NO EJECUTADOS)
Ejecutar **únicamente cuando las Etapas A y B estén confirmadas y la propietaria autorice el despliegue**:

```powershell
# 1. Subir la rama auditada de Release 3.3
git push -u origin feat/oakhaven-secure-personal-onboarding

# 2. (Recomendado) Crear PR en GitHub de feat/oakhaven-secure-personal-onboarding -> main
#    o integrar localmente con merge commit explícito sin squash:
git checkout main
git pull --ff-only origin main
git merge --no-ff feat/oakhaven-secure-personal-onboarding -m "release(3.3): private single-user fail-closed auth and secure personal onboarding"
git push origin main

# 3. Esperar despliegue automático de Railway desde main y verificar estado del servicio
```

### Etapa D — Smoke Check Técnico Inmediato Post-Despliegue
1. `GET https://rpg-life-engine-production.up.railway.app/api/health` → esperar HTTP `200`.
2. `GET https://rpg-life-engine-production.up.railway.app/api/auth/login` → esperar exactamente:
   `{ "privateMode": true, "publicSignupEnabled": false, "ownerConfigured": true }`.
3. `GET https://rpg-life-engine-production.up.railway.app/api/shortcuts/widget-summary` (sin cookies ni token) → esperar HTTP `401`.
4. `POST https://rpg-life-engine-production.up.railway.app/api/auth/login` con `action: "signup"` → esperar HTTP `403` (`PUBLIC_SIGNUP_DISABLED`).

### Etapa E — Activación de `isacarlope` y Cierre E2E Real
Ejecutar el Plan E2E Real de la Sección 7.

---

## 7. Plan de Pruebas E2E Reales (Post-Despliegue)

| Paso | Prueba real | Criterio de aceptación |
| :-: | :--- | :--- |
| 1 | Abrir el correo de invitación de Supabase y pulsar el enlace | Redirige a `/login?mode=reset`, limpia `#access_token=...` del historial de URL y confirma el correo en Supabase (`email_confirmed_at` poblado). |
| 2 | Guardar contraseña personal robusta (12+ caracteres, letras y números) | Responde éxito sin cookies automáticas inseguras y regresa a modo `login`. |
| 3 | Iniciar sesión en `/login` con correo real y nueva contraseña | Emite cookies `HttpOnly; SameSite=Lax; Secure` y abre la sesión de la propietaria. |
| 4 | Completar `/onboarding` con alias `isacarlope` y finanzas reales | Persiste sin pérdida de datos; `localStorage` no contiene montos financieros y el borrador se limpia al finalizar. |
| 5 | Verificar `/cozy` en computador y celular | Sesión consistente, sin datos piloto ni de terceros. |
| 6 | Probar rechazo de registro público (`signup`) y acceso sin sesión | `signup` → `403 PUBLIC_SIGNUP_DISABLED`; APIs privadas sin sesión → `401`. |
| 7 | Probar flujo `¿Olvidaste tu contraseña?` | Envía correo real, permite cambiar contraseña una sola vez en `/login?mode=reset` y el token no es reutilizable. |

---

## 8. Estrategia de Rollback Seguro (Selectivo)

- **Integridad de datos:** Release 3.3 **no aplica migraciones SQL destructivas** en producción. Los borradores SQL (`supabase/drafts/`) no se han aplicado todavía y son aditivos/idempotentes.
- **Peligro documentado de un rollback ciego a Release 3.2 (`c083a57`):**
  - En Release 3.2 (`c083a57`), `src/app/login/page.tsx` aplicaba la validación cliente `!/^\d{4,8}$/` (solo PIN numérico de 4 a 8 dígitos).
  - Si `isacarlope` ya activó una contraseña alfanumérica de 12+ caracteres, **revertir completamente a `c083a57` bloquearía temporalmente el inicio de sesión en la UI** (sin dañar los datos de Supabase).
- **Procedimiento seguro de rollback si ocurre un incidente post-despliegue:**
  1. **NO** hacer redeploy ciego del commit `c083a57`.
  2. Crear una rama `hotfix/release-3.3-rollback` desde `main` y revertir **únicamente** los módulos problemáticos (p. ej. vistas de onboarding o motores adaptativos), **conservando intactos**:
     - `src/app/login/page.tsx` (soporte de contraseña alfanumérica + `mode=reset`),
     - `src/app/page.tsx` (redirección de `#access_token` `invite`/`recovery`),
     - `src/lib/auth-login.ts`,
     - `src/lib/single-user-guard.ts`,
     - `src/lib/auth.ts` y `src/app/api/auth/login/route.ts`.
  3. Validar `tsc --noEmit`, `npm test` y `npm run build` antes de publicar el hotfix en Railway.

---

## 9. Resultados QA Reproducibles (Ejecutados en Local)

- **TypeScript (`tsc -p tsconfig.json --noEmit`):** ✅ 0 errores.
- **Suite de pruebas (`npm test`):** ✅ **348/348 pruebas aprobadas** (18 suites, 0 fallos), incluyendo:
  - `tests/single-user-private-mode.test.ts` (7/7 — fail-closed, `OWNER_NOT_CONFIGURED`, `OWNER_ONLY_ACCESS`, `PUBLIC_SIGNUP_DISABLED`, `update_password` de otro usuario → `403`, ausencia de `demoStore` en `widget-summary`, evaluación previa a `profiles`).
  - `tests/oakhaven-phase10-secure-onboarding.test.ts` y `tests/phase10-onboarding-pglite.test.ts`.
- **Build de producción (`npm run build`):** ✅ Compilado y verificado sin errores.
- **Auditoría estática de APIs:** ✅ `0` referencias a `demoStore` en `src/app/api/**/*.ts`.

---

## 10. Riesgos y Bloqueos Reales Restantes

1. **Configuración manual en Supabase Dashboard aún no aplicada** (`Allow new users to sign up = OFF`, `Site URL`, `Redirect URLs` y `Send invitation`).
2. **Variables de Railway aún no configuradas** (`OAKHAVEN_OWNER_USER_ID` y `OAKHAVEN_PUBLIC_SIGNUP_ENABLED=false`) porque dependen del UUID real emitido en la Etapa A.
3. **Límites del correo predeterminado de Supabase:** cuota baja de envíos por hora y restricción a correos autorizados; suficiente para MVP privado de un solo propietario, pero debe validarse en la prueba E2E real (Etapa E).
4. **E2E real pendiente:** solo tras completar Etapas A–E podrá declararse Release 3.3 como `LIVE` y `E2E VERIFIED`, habilitando después el inicio de OakHaven Ink / OakHaven Wrist.
