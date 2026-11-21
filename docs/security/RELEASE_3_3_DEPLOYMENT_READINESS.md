# OAKHAVEN RELEASE 3.3 — DEPLOYMENT READINESS & PR #1 STATUS

- **Fecha:** 2026-11-20
- **Proyecto:** OakHaven / RPG Life-Engine (`isacarlope13/rpg-life-engine`)
- **Pull Request:** https://github.com/isacarlope13/rpg-life-engine/pull/1 *(Draft — pendiente de revisión y aprobación humana)*
- **Rama de trabajo:** `feat/oakhaven-secure-personal-onboarding`
- **Base publicada en producción (`main`):** `c083a57` (Release 3.2 — Pueblo Vivo 5.0)
- **Estado:** **`GO — PR #1 READY FOR HUMAN REVIEW`**
*(Correcciones de PR #1 aplicadas y verificadas en local. Sin merge a `main`, sin despliegue nuevo en Railway, sin modificar Supabase y sin abrir la invitación de propietaria).*

---

## 1. Tabla de Control Obligatoria

| Control | Estado | Evidencia | Acción pendiente |
| :--- | :--- | :--- | :--- |
| **Código** | ✅ Listo en rama PR #1 | `feat/oakhaven-secure-personal-onboarding` sobre `main @ c083a57`; `tsc --noEmit` = 0 errores; `npm test` = **350/350**; `npm run build` aprobado (`35/35`); `git diff --check` limpio; 0 secretos/PII en el diff. | Revisión y aprobación humana independiente en PR #1 (permanece en **Draft**). |
| **Auth** | ✅ Verificado (fail-closed) | 9/9 escenarios fail-closed auditados y cubiertos en `tests/single-user-private-mode.test.ts` y `tests/oakhaven-phase10-secure-onboarding.test.ts`; **0 referencias a `demoStore`** en `src/app/api/**`; UI fail-closed en `/login`. | Validar en vivo mediante smoke tests tras el despliegue autorizado de Release 3.3. |
| **Widget iOS (Hallazgo B)** | ✅ Corregido (PR #1) | `GET /api/shortcuts/widget-summary` exige `requireShortcutUser` (`401`/`403`, `Cache-Control: no-store`, sin `demoStore`), elimina el snippet anónimo incompatible, no expone datos financieros ni secretos y documenta la integración autenticada futura (OakHaven Wrist + Apple Shortcuts). | Implementar emisión/rotación de token personal `rpg_usr_...` en iOS Keychain en la fase OakHaven Wrist + Apple Shortcuts. |
| **Supabase URLs** | ✅ Completado por propietaria | Propietaria confirmó `Site URL`, las 3 `Redirect URLs` (`/login`, `/login?mode=login`, `/login?mode=reset`) y registro público desactivado (`Allow new users to sign up = OFF`). | Verificar redirección real al abrir la invitación tras desplegar Release 3.3. |
| **Email & Invitación** | ✅ Enviada (sin abrir) | Propietaria envió invitación privada (`Send invitation`) y conservó su `User UID` real sin abrir todavía el enlace. | Abrir el enlace de invitación **únicamente después** de confirmar Release 3.3 live con `ownerConfigured: true`. |
| **Railway (Hallazgo A)** | ✅ Variables aplicadas · Release 3.2 activa | Inspección de solo lectura confirmada: servicio `rpg-life-engine` (`production`) conectado exclusivamente a `main`, **PR Environments = OFF**, **0 cambios pendientes (`No staged changes`)**, `OAKHAVEN_OWNER_USER_ID` y `OAKHAVEN_PUBLIC_SIGNUP_ENABLED` (valor esperado `false`) ya registradas en el inventario live de producción. Despliegue activo sigue siendo **Release 3.2** (`b8d94dce` @ `c083a57`). *Advertencia: los valores privados están ocultos en Railway y no fueron verificados directamente por el agente.* | Tras aprobación humana del merge a `main`, confirmar despliegue automático de Release 3.3 y verificar `ownerConfigured: true` y `publicSignupEnabled: false` vía `GET /api/auth/login`. |
| **SQL / Esquema** | ✅ Sin migraciones bloqueantes | `persistOnboardingSafely` usa tablas existentes de Release 3.1/3.2 con fallback automático en `profiles`. Los borradores en `supabase/drafts/` no se invocan en runtime. | Ninguna migración SQL requerida para desplegar Release 3.3. |
| **E2E** | ⏳ Pendiente post-despliegue | Ninguna cuenta personal activada ni correo de recuperación probado todavía en producción. | Ejecutar Smoke Tests (Sección 7) + Plan E2E Real (Sección 8) tras el despliegue autorizado. |
| **Rollback** | ✅ Compatible con contraseñas modernas | Conflicto de Release 3.2 (`c083a57` exigía PIN numérico de 4–8 dígitos) auditado; estrategia de rollback selectivo/hotfix documentada (Sección 9). | Aplicar únicamente hotfix selectivo si ocurriera un incidente post-despliegue. |

---

## 2. Estado Real de Infraestructura Railway (Solo Lectura)

Verificado mediante acceso de solo lectura (`describe-service`, `get-staged-changes`, `list-deployments`), **sin imprimir ni inferir valores privados**:

- **Proyecto:** `independent-fascination` · **Entorno único:** `production`
- **Servicio:** `rpg-life-engine` · **Dominio:** `https://rpg-life-engine-production.up.railway.app` (puerto `8080`, `RAILPACK`, `iad`, 1 réplica)
- **Rama conectada:** `isacarlope13/rpg-life-engine@main` (`checkSuites: false`)
- **PR Environments:** `OFF` (confirmado por la propietaria; 0 despliegues preview iniciados al publicar la rama feature)
- **Estado de cambios pendientes:** **0 cambios pendientes (`No staged changes`)** — configuración live sincronizada.
- **Inventario de variables definidas en producción (6 de usuario):**
  - Privadas (solo servidor): `GEMINI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `OAKHAVEN_OWNER_USER_ID`, `OAKHAVEN_PUBLIC_SIGNUP_ENABLED` *(valor esperado `false`)*.
  - Públicas (`NEXT_PUBLIC_`, no secretas): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
  - **Cero secretos con prefijo `NEXT_PUBLIC_*`.**
- **Advertencia explícita sobre valores privados:** los valores reales de `OAKHAVEN_OWNER_USER_ID` y `OAKHAVEN_PUBLIC_SIGNUP_ENABLED` están ocultos en Railway y **no fueron leídos ni verificados directamente** por el agente. Su validez de formato UUID y el cierre de registro se confirmarán indirectamente al desplegar Release 3.3 mediante `GET /api/auth/login` (`{ "privateMode": true, "publicSignupEnabled": false, "ownerConfigured": true }`).
- **Despliegue activo actual:** `b8d94dce-f304-4bef-b86b-d5b3700bd08d` (`[SUCCESS]`, `branch main · commit c083a57`, **Release 3.2**). Ningún despliegue nuevo ha sido iniciado.

---

## 3. Resolución de Hallazgos de Pull Request #1

### Hallazgo A — Documentación de Railway actualizada
- Se retiraron las instrucciones ya ejecutadas sobre variables *staged* y se documentó el estado real actual: `OAKHAVEN_OWNER_USER_ID` y `OAKHAVEN_PUBLIC_SIGNUP_ENABLED` ya figuran en el inventario de `production` con **0 cambios pendientes**, PR Environments en `OFF` y Release 3.2 todavía activa en producción.
- Se mantiene explícita la advertencia de privacidad sobre valores ocultos y se preservan íntegros los smoke tests, la activación de `isacarlope` y el rollback selectivo.

### Hallazgo B — Widget iOS (`GET /api/shortcuts/widget-summary`) y Hoja de Ruta Segura
- **Análisis de autenticación actual (`requireShortcutUser` en `src/lib/request-auth.ts` y `src/lib/auth.ts`):**
  - Todos los endpoints `/api/shortcuts/*` exigen `requireShortcutUser`, que soporta:
    1. Token personal por usuario (`x-api-key: rpg_usr_...` o `Authorization: Bearer rpg_usr_...`) validado por hash SHA-256 contra `public.api_tokens` y restringido por `isAuthorizedSupabaseUserId`.
    2. Sesión autenticada del navegador (cookies `HttpOnly`, no utilizables por un widget externo de iOS Scriptable).
    3. Secreto legacy `SHORTCUTS_API_SECRET` (no configurado en producción e inseguro para incrustar en un script cliente).
  - Aunque las funciones auxiliares de tokens personales (`createPersonalTokenForUser`, `listPersonalTokensForUser`, `revokePersonalTokenForUser`) existen en `src/lib/auth.ts`, **todavía no existe un endpoint `/api/*` ni flujo de interfaz para emitir/rotar/revocar tokens `rpg_usr_...`**.
- **Corrección aplicada en Release 3.3 (`src/lib/widget-summary.ts` + `src/app/api/shortcuts/widget-summary/route.ts`):**
  - Se mantiene el cierre estricto `requireShortcutUser` (`401 Unauthorized` sin credenciales, `403 Forbidden` para identidades no autorizadas, `Cache-Control: no-store`, **sin fallback a `demoStore`**).
  - Se eliminó el snippet ejecutable anónimo (`new Request("https://TU-DOMINIO.vercel.app/api/shortcuts/widget-summary")`) que habría fallado con `401`, y se reemplazó por un bloque de instrucciones no ejecutable explicando que el widget externo requiere integración autenticada pendiente.
  - Se retiró la exposición de información financiera (`wallet_gp`, `vault_remaining_gp`, `active_boss`) del payload del widget (`financial_data_exposed: false`) para evitar fugas de saldos o deudas en pantalla bloqueada, y no se incluye ningún token, UUID ni contraseña.
- **Integración segura futura (OakHaven Wrist + Apple Shortcuts — fuera del alcance de Release 3.3):**
  1. Exponer un flujo autenticado en Perfil/Ajustes para generar, rotar y revocar tokens personales `rpg_usr_...` (almacenados solo como hash SHA-256 en `public.api_tokens` y restringidos al UUID propietario).
  2. Configurar Apple Shortcuts / Scriptable guardando el token exclusivamente en **iOS Keychain** (nunca en código plano compartido) y enviándolo por cabecera `x-api-key` sobre HTTPS.
  3. Mantener una proyección mínima libre de montos financieros para widgets de pantalla bloqueada y complicaciones de Apple Watch.
- **Observación menor no bloqueante (documentada para la fase Wrist/Shortcuts):** `src/app/quick/page.tsx` conserva texto descriptivo heredado junto a la tarjeta del widget (`ADDI / Nequi`); no expone datos reales ni afecta seguridad de Release 3.3 y se actualizará al implementar el panel de tokens personales de OakHaven Wrist.

---

## 4. Verificación de Compatibilidad SQL y Regresiones

- **SQL sin bloqueos:** `persistOnboardingSafely` (`src/lib/onboarding/onboarding-persistence.ts`) opera solo sobre tablas existentes de Release 3.1/3.2 con fallback automático en `profiles`. `supabase/drafts/` no se invoca en runtime.
- **Revisión focalizada de regresiones (todas verificadas):**
  - Login privado, activación `Send invitation` (`type=invite`) y recuperación (`/login?mode=reset` + `GET /auth/v1/user` previo a `PUT /auth/v1/user`).
  - Restricción fail-closed por `OAKHAVEN_OWNER_USER_ID` (`503 OWNER_NOT_CONFIGURED` sin config, `403 OWNER_ONLY_ACCESS` para otro UUID).
  - Registro público cerrado en producción (`403 PUBLIC_SIGNUP_DISABLED` + UI fail-closed en `/login`).
  - Onboarding idempotente no destructivo, separación COP vs GP intacta, ausencia de datos financieros piloto y **0 referencias a `demoStore`** en `src/app/api/**`.

---

## 5. Resultados de Calidad Reproducibles

- **TypeScript (`npx tsc --noEmit`):** ✅ `0` errores.
- **Pruebas (`npm test`):** ✅ **350/350 aprobadas** (18 suites, `0` fallos).
- **Build (`npm run build`):** ✅ Aprobado (`35/35` rutas generadas).
- **Formato de diff (`git diff --check`):** ✅ Sin errores de espacios/conflictos.
- **Auditoría de secretos y PII (`main..HEAD`):** ✅ **0 secretos, 0 credenciales y 0 datos personales reales**.

---

## 6. Operaciones Completadas vs Pendientes

### Ya completado
- [x] Configuración de `Site URL`, las 3 `Redirect URLs` y registro público `OFF` en Supabase Dashboard.
- [x] Envío de invitación privada para la propietaria y resguardo del `User UID` real (sin abrir aún).
- [x] `OAKHAVEN_OWNER_USER_ID` y `OAKHAVEN_PUBLIC_SIGNUP_ENABLED` registradas en Railway `production` con **0 cambios pendientes** y **PR Environments = OFF**.
- [x] Rama `feat/oakhaven-secure-personal-onboarding` publicada en GitHub y **PR #1** abierta en **Draft**.
- [x] Correcciones de Hallazgo A y Hallazgo B verificadas y publicadas en la rama de PR #1.

### Pendiente (requiere aprobación humana independiente)
- [ ] Revisión humana de PR #1 y cambio de **Draft** a listo para merge cuando la propietaria lo decida.
- [ ] Merge controlado (`--no-ff` / Create a merge commit) de `feat/oakhaven-secure-personal-onboarding` en `main` para disparar el despliegue automático único de Release 3.3 en Railway (con las variables privadas ya presentes desde el arranque).
- [ ] Ejecución de Smoke Tests (Sección 7) y Plan E2E Real (Sección 8).

---

## 7. Smoke Tests Post-Despliegue (`200`, `401`, `403`, `503`, Login Privado y Onboarding)

Ejecutar sobre `https://rpg-life-engine-production.up.railway.app` inmediatamente después de que Railway complete el despliegue de Release 3.3 desde `main`:

```powershell
$BASE = "https://rpg-life-engine-production.up.railway.app"

# 1. Salud del servicio -> Esperado: HTTP 200
Invoke-WebRequest "$BASE/api/health" -UseBasicParsing | Select-Object StatusCode, Content

# 2. Estado fail-closed / propietario configurado -> Esperado: HTTP 200
#    {"privateMode":true,"publicSignupEnabled":false,"ownerConfigured":true}
#    (Si ownerConfigured fuera false, login devolvería 503 OWNER_NOT_CONFIGURED)
Invoke-WebRequest "$BASE/api/auth/login" -UseBasicParsing | Select-Object StatusCode, Content

# 3. Smoke 401 — APIs privadas sin sesión (incluye widget-summary, sin fallback a demoStore)
foreach ($ep in @("/api/state", "/api/onboarding", "/api/shortcuts/widget-summary")) {
  try {
    Invoke-WebRequest "$BASE$ep" -UseBasicParsing | Out-Null
    Write-Output "$ep -> INESPERADO 200"
  } catch {
    Write-Output "$ep -> HTTP $($_.Exception.Response.StatusCode.value__)" # Esperado: 401
  }
}

# 4. Smoke 403 — Registro público cerrado (PUBLIC_SIGNUP_DISABLED) y modo demo bloqueado en prod
try {
  Invoke-WebRequest "$BASE/api/auth/login" -Method POST -ContentType "application/json" `
    -Body '{"action":"signup","email":"probe@example.invalid","password":"ProbePassword2026","data_privacy_accepted":true}' `
    -UseBasicParsing | Out-Null
} catch {
  Write-Output "signup -> HTTP $($_.Exception.Response.StatusCode.value__)" # Esperado: 403
}

try {
  Invoke-WebRequest "$BASE/api/auth/demo" -Method POST -UseBasicParsing | Out-Null
} catch {
  Write-Output "demo -> HTTP $($_.Exception.Response.StatusCode.value__)" # Esperado: 403
}
```

- **Smoke `503 OWNER_NOT_CONFIGURED`:** en producción **NO debe ocurrir** si el valor privado de `OAKHAVEN_OWNER_USER_ID` es un UUID válido (`ownerConfigured: true`). La respuesta `503` queda cubierta en pruebas deterministas (`tests/single-user-private-mode.test.ts`).

---

## 8. Activación de Cuenta `isacarlope` y Plan E2E Real (Post-Smoke)

1. Solo después de confirmar `ownerConfigured: true` y `publicSignupEnabled: false`, abrir el enlace de invitación recibido por correo:
   - Confirmar aterrizaje en `/login?mode=reset` y limpieza automática de `#access_token=...` en la URL.
2. Guardar contraseña robusta personal (12+ caracteres alfanuméricos, almacenada en gestor de contraseñas).
3. Iniciar sesión en `/login`, confirmar cookies `HttpOnly; SameSite=Lax; Secure` y acceso a `/cozy`.
4. Completar `/onboarding` con alias `isacarlope` y datos reales; verificar que `localStorage` no contiene montos financieros y que el borrador se limpia al finalizar.
5. Verificar sesión desde computador y celular, y probar el flujo real `¿Olvidaste tu contraseña?` (confirmando un solo uso del token).

---

## 9. Procedimiento de Rollback Selectivo (Compatible con Contraseñas Modernas)

- **Regla crítica:** **NUNCA** hacer rollback ciego ni redeploy directo al commit `c083a57` (Release 3.2) una vez que `isacarlope` tenga contraseña alfanumérica de 12+ caracteres, porque Release 3.2 exigía PIN numérico de 4–8 dígitos (`!/^\d{4,8}$/`) en `src/app/login/page.tsx` y bloquearía temporalmente la UI (sin dañar los datos de Supabase).
- **Procedimiento seguro:**
  ```powershell
  git checkout main
  git pull --ff-only origin main
  git checkout -b hotfix/release-3.3-selective-rollback

  # Revertir únicamente el módulo con incidente, CONSERVANDO INTACTOS:
  # - src/app/login/page.tsx
  # - src/app/page.tsx
  # - src/app/api/auth/login/route.ts
  # - src/app/api/shortcuts/widget-summary/route.ts
  # - src/lib/widget-summary.ts
  # - src/lib/auth-login.ts
  # - src/lib/single-user-guard.ts
  # - src/lib/auth.ts
  git checkout c083a57 -- <ruta/del/modulo/a/revertir>

  npx tsc --noEmit
  npm test
  npm run build
  ```

---

## 10. Riesgos Restantes

- **Bloqueantes pendientes:** ninguno en código ni en configuración de pre-despliegue.
- **Riesgos aceptables:**
  - Los valores exactos de `OAKHAVEN_OWNER_USER_ID` y `OAKHAVEN_PUBLIC_SIGNUP_ENABLED` en Railway están ocultos y se verificarán indirectamente en el primer smoke test (`GET /api/auth/login`).
  - El correo predeterminado de Supabase tiene cuota baja por hora y restricción a destinatarios autorizados (suficiente para MVP privado de propietario único; validar entrega de recuperación en E2E).
  - El widget externo de Scriptable queda temporalmente deshabilitado hasta implementar el flujo de tokens personales en OakHaven Wrist + Apple Shortcuts.
