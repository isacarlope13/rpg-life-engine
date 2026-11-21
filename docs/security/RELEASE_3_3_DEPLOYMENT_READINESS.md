# OAKHAVEN RELEASE 3.3 — DEPLOYMENT READINESS & PRE-DEPLOY CHECK

**Fecha:** 2026-11-20  
**Proyecto:** OakHaven / RPG Life-Engine (`isacarlope13/rpg-life-engine`)  
**Rama local:** `feat/oakhaven-secure-personal-onboarding` (verificado sobre commit base `68b2ebc`)  
**Base publicada en producción (`main`):** `c083a57` (Release 3.2 — Pueblo Vivo 5.0)  
**Estado de cierre:** **`RELEASE 3.3 — PRE-DEPLOY CHECK READY FOR APPROVAL`**  
*(Verificaciones técnicas de Git, seguridad, SQL, QA y Railway en modo solo lectura completadas satisfactoriamente. Sin `push`, sin `merge`, sin aplicar variables pendientes, sin deploy y sin abrir enlace de invitación).*

---

## 1. Tabla de Control Obligatoria

| Control | Estado | Evidencia | Acción pendiente |
| :--- | :--- | :--- | :--- |
| **Código** | ✅ Listo (local) | `feat/oakhaven-secure-personal-onboarding` (`0 behind, 10 ahead` de `main @ c083a57`, `27 files changed, +4856/-3060`); auditoría de diff = **0 secretos / 0 PII / 0 credenciales**; `tsc --noEmit` = 0 errores; `npm test` = **348/348**; `npm run build` = aprobado (`35/35`). | Aprobación humana para `git push`, PR y `merge --no-ff` en `main`. |
| **Auth** | ✅ Verificado (fail-closed) | 9/9 escenarios fail-closed auditados y cubiertos por tests (`tests/single-user-private-mode.test.ts` + `tests/oakhaven-phase10-secure-onboarding.test.ts`); cero fallbacks a `demoStore` en `src/app/api/**`; UI fail-closed en `/login`. | Ejecutar smoke tests en vivo post-despliegue (Sección 8). |
| **Supabase URLs** | ✅ Configurado por propietaria | Propietaria confirmó `Site URL`, las 3 `Redirect URLs` (`/login`, `/login?mode=login`, `/login?mode=reset`) y registro público desactivado (`Allow new users to sign up = OFF`). | Verificar redirección real al abrir invitación tras desplegar Release 3.3. |
| **Email** | ✅ Invitación enviada (sin abrir) | Propietaria envió invitación privada (`Send invitation`) y conservó el `User UID` real sin abrir aún el enlace. | Abrir enlace de invitación **solo después** de confirmar Release 3.3 live con `ownerConfigured: true`. |
| **Owner UUID** | ✅ Staged en Railway | Confirmado vía `get-staged-changes` (solo nombres, valores redactados): `+ OAKHAVEN_OWNER_USER_ID` presente en patch staged `97e4c584-8815-4223-b9f9-da46a0c10649`. | Registrar/aplicar variables en `production` **ANTES** del merge a `main` (Sección 7). |
| **Railway** | ✅ Auditado (solo lectura) | Servicio `rpg-life-engine` (`production`) conectado únicamente a `isacarlope13/rpg-life-engine@main`; 5/5 despliegues recientes desde `main`; 2 variables staged (`OAKHAVEN_OWNER_USER_ID`, `OAKHAVEN_PUBLIC_SIGNUP_ENABLED`), 0 secretos en `NEXT_PUBLIC_*`, 0 cambios destructivos. | Verificar *PR Environments = OFF*, aplicar las 2 variables pendientes sin crear ventana de código nuevo sin config, y desplegar `main`. |
| **SQL / Esquema** | ✅ Sin bloqueos | `persistOnboardingSafely` usa solo tablas existentes de Release 3.1/3.2 con fallback automático en `profiles`. Borradores en `supabase/drafts/` NO se invocan en runtime. | Ninguna migración SQL requerida para desplegar Release 3.3. |
| **E2E** | ⏳ Post-despliegue | Pendiente publicación de Release 3.3 y activación real de `isacarlope`. | Ejecutar Smoke Tests (Sección 8) + E2E real (Sección 9). |
| **Rollback** | ✅ Compatible con contraseñas modernas | Auditado bloqueo de PIN 4–8 dígitos en Release 3.2 (`c083a57`); estrategia de rollback selectivo/hotfix documentada preservando `/login` alfanumérico y guardias de seguridad (Sección 10). | Usar únicamente hotfix selectivo si surgiera un incidente post-despliegue. |

---

## 2. Estado Real de Git y Auditoría de Commits

- **Rama actual:** `feat/oakhaven-secure-personal-onboarding`
- **Commit verificado en pre-deploy check:** `68b2ebca594f111b4640a1f156c8b995fc61d8e5` (`68b2ebc`) *(más el commit documental local de esta actualización si se confirma árbol limpio).*
- **Base `main` / `origin/main`:** `c083a5768a030744416f782e14d18bed14833b6f` (`release: OakHaven 3.2 (Pueblo Vivo 5.0 — World Experience)`).
- **Relación con `main`:** `0 behind, 10 ahead` (historia completamente lineal sobre Release 3.2, cero conflictos de merge).
- **Resumen del diff completo (`git diff --stat main..HEAD`):**
  - `27 files changed, 4856 insertions(+), 3060 deletions(-)`
  - Áreas tocadas: autenticación privada fail-closed (`single-user-guard.ts`, `auth-login.ts`, `auth.ts`, `api/auth/login/route.ts`, `login/page.tsx`, `page.tsx`), eliminación de fallback `demoStore` (`api/shortcuts/widget-summary/route.ts`), onboarding personal seguro e idempotente (`api/onboarding/route.ts`, `onboarding-persistence.ts`, `personal-onboarding-engine.ts`, `onboarding/page.tsx`), motores locales de calendario y decisiones (`adaptive-calendar-engine.ts`, `rowan-decision-engine.ts`), saneamiento de fixtures (`initial-financial-movements.ts`, `onboarding-ai.ts`), borradores SQL no aplicados (`supabase/drafts/`), tests (`tests/*`) y documentación (`docs/security/*`, `docs/continuity/*`).
- **Auditoría de secretos, PII y credenciales sobre `git diff main..HEAD`:**
  - Escaneo de patrones de JWT (`eyJhbGciOi`), API keys (`sk-`, `AIzaSy`, `sbp_`, `re_`), `service_role_key`, correos personales (`@gmail.com`, `@hotmail.com`, `@outlook.com`, `@icloud.com`), UUIDs reales y nombres personales: **0 hallazgos reales**.
  - Únicas coincidencias: UUIDs sintéticos de prueba (`11111111-...`, `22222222-...`, `20000000-...`), el ID público de despliegue de Railway (`b8d94dce-...`) y aserciones negativas de tests que garantizan la eliminación permanente de datos piloto heredados.

---

## 3. Configuración de Despliegue de Railway (Verificada en Solo Lectura)

Inspección realizada exclusivamente con llamadas de solo lectura (`list-projects`, `describe-environment`, `describe-service`, `get-staged-changes`, `list-deployments`), **sin imprimir ni modificar valores**:

- **Proyecto:** `independent-fascination` (`59fd93f8-fd72-4b44-9ad4-26cc718a6402`)
- **Entorno único existente:** `production` (`d09d64e1-ab8b-4292-baed-575b3b41ca46`)
- **Servicio:** `rpg-life-engine` (`4e5c7acf-d169-429a-bce3-77c6c5d1e5e0`)
- **Dominio público:** `https://rpg-life-engine-production.up.railway.app` (puerto `8080`)
- **Mecanismo de despliegue:**
  - **Repositorio conectado:** `isacarlope13/rpg-life-engine`
  - **Rama conectada:** `main`
  - **Check Suites requeridos:** `false`
  - **Builder:** `RAILPACK` (`buildEnvironment: V3`), **Runtime:** `V2`, **Región:** `iad` (`1` réplica)
  - **Configuración en repo (`railway.json`):** `startCommand: "npm run start"`, `restartPolicyType: "ON_FAILURE"`, `restartPolicyMaxRetries: 5`.
- **Despliegue activo actual:** `b8d94dce-f304-4bef-b86b-d5b3700bd08d` (`[SUCCESS]`, `branch main · commit c083a57`, Release 3.2). Los últimos 5/5 despliegues provinieron exclusivamente de `branch main`.
- **Estado de cambios pendientes (patch `97e4c584-8815-4223-b9f9-da46a0c10649`):**
  - Estado del servicio: `live-with-staged-changes` (`2` cambios pendientes, no destructivos):
    - `+ OAKHAVEN_OWNER_USER_ID: <redacted>`
    - `+ OAKHAVEN_PUBLIC_SIGNUP_ENABLED: <redacted>`
  - **Inventario total de variables de usuario (con patch aplicado = 6):**
    - Servidor (privadas): `GEMINI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `OAKHAVEN_OWNER_USER_ID`, `OAKHAVEN_PUBLIC_SIGNUP_ENABLED`.
    - Cliente (`NEXT_PUBLIC_`, no secretas): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
  - **Verificación `NEXT_PUBLIC_`:** ✅ Ningún secreto ni el UUID propietario lleva prefijo `NEXT_PUBLIC_`.

### Evaluación de Preview Deployments al hacer `push` de la rama feature
- **Push directo a `feat/oakhaven-secure-personal-onboarding`:** NO dispara despliegues en `production`, porque el servicio `rpg-life-engine` escucha exclusivamente `branch: "main"`.
- **Al abrir un Pull Request en GitHub:** El API de solo lectura (`describe-service`) no expone el interruptor de *PR Environments* del proyecto. Aunque no existen otros entornos ni despliegues previos fuera de `main`, se recomienda que la propietaria verifique en **Railway → Project Settings → Environments → PR Environments = OFF** antes de abrir el PR.
- **Defensa adicional:** Incluso si un entorno preview se creara por error sin `OAKHAVEN_OWNER_USER_ID`, el código de Release 3.3 arrancaría en modo **fail-closed** (`503 OWNER_NOT_CONFIGURED`, registro público cerrado), sin exponer datos ni permitir registros.

---

## 4. Verificación de Compatibilidad SQL (Sin Migraciones Bloqueantes)

Auditados [src/app/api/onboarding/route.ts](file:///C:/Users/isaca_6khxtdy/.gemini/antigravity/scratch/rpg-life-engine/src/app/api/onboarding/route.ts) y [src/lib/onboarding/onboarding-persistence.ts](file:///C:/Users/isaca_6khxtdy/.gemini/antigravity/scratch/rpg-life-engine/src/lib/onboarding/onboarding-persistence.ts):
- **Login, activación por invitación (`type=invite`) y recuperación (`type=recovery`):** dependen únicamente de Supabase Auth (`/auth/v1/user`, `signInWithPassword`, `resetPasswordForEmail`) y de `OAKHAVEN_OWNER_USER_ID`. **0 migraciones SQL requeridas.**
- **Onboarding (`GET/POST /api/onboarding`):** opera sobre tablas ya activas en producción (`profiles`, `player_treasury`, `fixed_costs`, `debt_bosses`, `user_skills`, `quest_catalog`, `wishlist_items`). En `profiles`, las líneas 294–307 incluyen un **fallback automático** al conjunto base de columnas (`id`, `email`, `display_name`, `character_class`, `avatar_url`, `updated_at`) si faltara alguna columna extendida.
- **Borradores en `supabase/drafts/`:** `20261120_phase10_secure_onboarding_rpc.sql` y `20261120_phase10_single_user_rls_template.sql` son mejoras opcionales futuras y **NO son invocados por el runtime actual**.

---

## 5. Comprobaciones de Seguridad Fail-Closed (9/9 Escenarios) y QA

### Seguridad verificada
- `OAKHAVEN_OWNER_USER_ID` ausente, vacío o no-UUID → `503 OWNER_NOT_CONFIGURED`, 0 cookies, `isAuthorizedSupabaseUserId = false` en todas las rutas privadas.
- Sesión o token de un UUID distinto al propietario → `403 OWNER_ONLY_ACCESS`, 0 cookies, evaluación en `auth.ts` ANTES de leer `public.profiles`, y también en la ruta legacy `SHORTCUTS_API_SECRET`.
- Rutas privadas sin sesión (incluyendo `GET /api/shortcuts/widget-summary`) → `401 Unauthorized`, **0 referencias a `demoStore`** en `src/app/api/**`.
- Intento de registro público (`action: "signup"`) → `403 PUBLIC_SIGNUP_DISABLED` sin contactar Supabase; `/login` inicia fail-closed (`publicSignupEnabled = false`).
- Token de invitación/recuperación de otro usuario → verificado con `GET /auth/v1/user` antes de `PUT /auth/v1/user` → `403 OWNER_ONLY_ACCESS`.
- Borradores de onboarding aislados por `user_id` real, finanzas únicamente en `sessionStorage`, limpieza automática al finalizar.

### Resultados QA Re-ejecutados en Pre-Deploy Check
- **TypeScript (`tsc -p tsconfig.json --noEmit`):** ✅ `0` errores.
- **Tests (`npm test`):** ✅ **348/348 aprobadas** (18 suites, `0` fallos).
- **Build de producción (`npm run build`):** ✅ Compilado (`6.7s`, `35/35` páginas generadas, exit code `0`).

---

## 6. Riesgos Restantes (Honestos)

1. **Orden de aplicación de variables staged en Railway (riesgo operativo mitigable a cero):** actualmente `OAKHAVEN_OWNER_USER_ID` y `OAKHAVEN_PUBLIC_SIGNUP_ENABLED` están en el patch staged `97e4c584-8815-4223-b9f9-da46a0c10649`, NO en las variables live. Si se hiciera merge a `main` antes de registrar/aplicar las variables en `production`, Release 3.3 arrancaría brevemente en fail-closed (`503 OWNER_NOT_CONFIGURED`) hasta commitear el patch. La Secuencia Exacta de la Sección 7 elimina este riesgo por completo.
2. **PR Environments en Railway:** verificar manualmente que esté `OFF` antes de abrir el PR en GitHub.
3. **Límites del correo predeterminado de Supabase:** cuota baja por hora y restricción a direcciones autorizadas (ya funcionó para la invitación; probar también recuperación en E2E).
4. **Certificado TLS en el sandbox local:** `git ls-remote` falló dentro del sandbox por `SEC_E_UNTRUSTED_ROOT`; el `git push` deberá ejecutarse con acceso de red normal aprobado por la propietaria.

---

## 7. Secuencia Exacta de Operaciones (Cero Ventana Sin Configuración)

> **Regla de oro:** Las 2 variables (`OAKHAVEN_OWNER_USER_ID` y `OAKHAVEN_PUBLIC_SIGNUP_ENABLED=false`) deben quedar **registradas como LIVE en `production` ANTES** de que el commit de Release 3.3 llegue a `main`.

### Fase 1 — Registrar variables en Railway `production` SIN desplegar Release 3.3 todavía (Requiere aprobación/acción humana)
- **Opción A — Sin redepliegue de Release 3.2 (preferida):**
  - En Railway Dashboard: descartar el banner de cambios staged **o** usar Railway CLI / API con `--skip-deploys` (`skipDeploys: true`) para registrar `OAKHAVEN_OWNER_USER_ID` y `OAKHAVEN_PUBLIC_SIGNUP_ENABLED=false` directamente como variables **live** en `production` sin disparar redeploy de Release 3.2 (`c083a57`):
    ```powershell
    # Ejemplo conceptual en Railway CLI (NO ejecutar sin sustituir el UUID real de forma privada):
    railway variable set --service rpg-life-engine --environment production --skip-deploys "OAKHAVEN_OWNER_USER_ID=<UUID_REAL>" "OAKHAVEN_PUBLIC_SIGNUP_ENABLED=false"
    ```
  - Si se usó el CLI con `--skip-deploys`, descartar el patch staged redundante en la UI de Railway para confirmar `0 staged changes`.
- **Opción B — Alternativa 100% segura desde la UI de Railway (si prefieres no usar CLI):**
  - Pulsar **Deploy / Apply changes** sobre el patch staged `97e4c584-8815-4223-b9f9-da46a0c10649` mientras `main` sigue en Release 3.2 (`c083a57`). Release 3.2 **ignora** ambas variables nuevas (0 impacto) y deja ambas variables live y confirmadas (`0 staged changes`).
- **Verificación de compuerta antes de Fase 2:** `get-staged-changes` / Railway UI muestra **0 cambios pendientes** y ambas variables aparecen en la pestaña **Variables** (live) de `production`.

### Fase 2 — Subir rama y abrir Pull Request (NO ejecutado)
1. Verificar en Railway que **PR Environments = OFF**.
2. Ejecutar (con aprobación humana):
   ```powershell
   git push -u origin feat/oakhaven-secure-personal-onboarding
   ```
3. Crear Pull Request en GitHub (`feat/oakhaven-secure-personal-onboarding` → `main`):
   - **Título sugerido:** `Release 3.3: Private Single-User Fail-Closed Auth & Secure Personal Onboarding`
   - **Descripción del PR:**
     - Modo privado de propietario único (`OAKHAVEN_OWNER_USER_ID` + `OAKHAVEN_PUBLIC_SIGNUP_ENABLED=false`) con cierre fail-closed (`503 OWNER_NOT_CONFIGURED`, `403 OWNER_ONLY_ACCESS`, `403 PUBLIC_SIGNUP_DISABLED`).
     - Eliminación de auto-confirmación `service_role`, política de contraseña robusta (10+ caracteres alfanuméricos), rate limit `429`, soporte `Send invitation` (`type=invite`) y recuperación dedicada `/login?mode=reset`.
     - Eliminación del último fallback a `demoStore` (`widget-summary`), aislamiento estricto de borradores financieros en `sessionStorage` y onboarding idempotente no destructivo sin migraciones SQL bloqueantes.
     - QA local: `tsc --noEmit` (0 errores), `npm test` (348/348), `npm run build` (35/35).

### Fase 3 — Merge controlado a `main` y Deploy único de Release 3.3 (NO ejecutado)
Una vez aprobado el PR y confirmada Fase 1 (`0 staged changes`, ambas variables live):
- En GitHub: **Create a merge commit** (NO squash, para preservar el historial de auditoría) **o** localmente:
  ```powershell
  git checkout main
  git pull --ff-only origin main
  git merge --no-ff feat/oakhaven-secure-personal-onboarding -m "release(3.3): private single-user fail-closed auth and secure personal onboarding"
  git push origin main
  ```
- Railway construirá y desplegará automáticamente `main` (Release 3.3) **con `OAKHAVEN_OWNER_USER_ID` y `OAKHAVEN_PUBLIC_SIGNUP_ENABLED=false` inyectadas desde el primer milisegundo**.

---

## 8. Smoke Tests Listos Post-Despliegue (`401`, `403`, `503`, Login Privado y Onboarding)

Ejecutar sobre `https://rpg-life-engine-production.up.railway.app` inmediatamente después de que Railway marque el despliegue de `main` como `SUCCESS`:

```powershell
$BASE = "https://rpg-life-engine-production.up.railway.app"

# 1. Salud del servicio -> Esperado: HTTP 200
Invoke-WebRequest "$BASE/api/health" -UseBasicParsing | Select-Object StatusCode, Content

# 2. Estado fail-closed / propietario configurado -> Esperado: HTTP 200
#    {"privateMode":true,"publicSignupEnabled":false,"ownerConfigured":true}
#    (Si ownerConfigured fuera false, el servidor respondería 503 OWNER_NOT_CONFIGURED en login)
Invoke-WebRequest "$BASE/api/auth/login" -UseBasicParsing | Select-Object StatusCode, Content

# 3. Smoke 401 — APIs privadas sin sesión (cero fallback a demoStore)
foreach ($ep in @("/api/state", "/api/onboarding", "/api/shortcuts/widget-summary")) {
  try {
    Invoke-WebRequest "$BASE$ep" -UseBasicParsing | Out-Null
    Write-Output "$ep -> INESPERADO 200"
  } catch {
    Write-Output "$ep -> HTTP $($_.Exception.Response.StatusCode.value__)" # Esperado: 401
  }
}

# 4. Smoke 403 — Registro público cerrado (PUBLIC_SIGNUP_DISABLED) y modo demo bloqueado en producción
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

- **Smoke `503 OWNER_NOT_CONFIGURED`:** en producción **NO debe aparecer** tras seguir la Fase 1 (`ownerConfigured` debe ser `true`). El comportamiento `503` queda verificado de forma determinista en [tests/single-user-private-mode.test.ts](file:///C:/Users/isaca_6khxtdy/.gemini/antigravity/scratch/rpg-life-engine/tests/single-user-private-mode.test.ts) para ausencia, vacío o UUID inválido en `NODE_ENV=production`.
- **Smoke Login Privado + Onboarding (manual por la propietaria en navegador):**
  1. Abrir el correo de invitación enviado por Supabase → verificar aterrizaje en `/login?mode=reset` y limpieza automática de `#access_token=...` en la barra de direcciones.
  2. Definir contraseña robusta personal (12+ caracteres alfanuméricos, guardada en gestor de contraseñas) → confirmar guardado sin errores.
  3. Iniciar sesión en `/login` → verificar cookies `HttpOnly; SameSite=Lax; Secure` y redirección a `/cozy`.
  4. Abrir `/onboarding` → verificar `GET /api/onboarding` HTTP `200`, completar con alias `isacarlope` y datos reales, verificar persistencia real en Supabase y confirmar en DevTools que `localStorage` no contiene montos financieros y que el borrador se limpió al finalizar.

---

## 9. Plan E2E Real (Post-Smoke)

1. Confirmar sesión y datos de `isacarlope` desde computador Windows y celular (iPhone/Galaxy Tab).
2. Confirmar que un intento de login con credenciales inválidas devuelve `401` genérico y tras varios intentos activa `429`.
3. Probar `¿Olvidaste tu contraseña?` → recibir correo real → completar cambio único en `/login?mode=reset` → comprobar que el mismo enlace ya no es reutilizable.
4. Solo cuando estos pasos pasen con evidencia real, Release 3.3 podrá marcarse como `LIVE` y `E2E VERIFIED`, desbloqueando la siguiente fase (OakHaven Everywhere: Galaxy Tab S Pen + Apple Watch).

---

## 10. Procedimiento de Rollback Compatible con Contraseñas Modernas

- **Regla crítica:** **NUNCA** hacer rollback ciego ni redeploy directo al commit `c083a57` (Release 3.2) una vez que `isacarlope` tenga contraseña robusta (12+ caracteres alfanuméricos).
  - **Motivo:** Release 3.2 imponía en `src/app/login/page.tsx` la validación `!/^\d{4,8}$/` (solo PIN numérico de 4–8 dígitos), lo que bloquearía temporalmente el login en la UI (sin perder datos en Supabase).
- **Procedimiento seguro (Rollback Selectivo / Hotfix):**
  ```powershell
  # 1. Crear rama hotfix desde main (Release 3.3)
  git checkout main
  git pull --ff-only origin main
  git checkout -b hotfix/release-3.3-selective-rollback

  # 2. Revertir ÚNICAMENTE el/los archivo(s) con incidente (ej. vista de onboarding),
  #    NUNCA tocar la capa de autenticación moderna ni el guard single-user:
  #    CONSERVAR INTACTOS:
  #    - src/app/login/page.tsx
  #    - src/app/page.tsx
  #    - src/app/api/auth/login/route.ts
  #    - src/app/api/shortcuts/widget-summary/route.ts
  #    - src/lib/auth-login.ts
  #    - src/lib/single-user-guard.ts
  #    - src/lib/auth.ts
  git checkout c083a57 -- <ruta/del/modulo/a/revertir>

  # 3. Validar antes de publicar
  npx tsc --noEmit
  npm test
  npm run build

  # 4. Integrar el hotfix en main y dejar que Railway despliegue el parche seguro
  ```

---

## 11. Acciones que Requieren Aprobación Humana Explícita

1. **Confirmar en Railway que `PR Environments` esté `OFF`.**
2. **Aprobar Fase 1:** registrar/aplicar `OAKHAVEN_OWNER_USER_ID` y `OAKHAVEN_PUBLIC_SIGNUP_ENABLED=false` como variables live en `production` (sin redepliegue mediante `--skip-deploys` / `skipDeploys: true`, o aplicando el patch sobre Release 3.2 antes del merge).
3. **Aprobar Fase 2 y 3:** `git push` de `feat/oakhaven-secure-personal-onboarding`, creación de PR, merge `--no-ff` a `main` y despliegue de Release 3.3 en Railway.
4. **Aprobar Fase 4 (propietaria):** abrir el enlace de invitación privado en tu correo solo después de que los smoke tests confirmen `ownerConfigured: true`.

---

**`RELEASE 3.3 — PRE-DEPLOY CHECK READY FOR APPROVAL`**
