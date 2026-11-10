# ESTADO ACTUAL DEL SISTEMA (CURRENT STATE AUDIT)
## RPG Life-Engine — Versión 3.5.0 ("Autonomous Core")
**Fecha de Auditoría:** 10 de Noviembre de 2026  
**Rama:** `main`  
**Estado de Git:** Limpio, sincronizado con origin.

---

### 1. Stack Tecnológico y Versiones Reales
* **Framework Web:** Next.js `15.2.0` (App Router, Turbopack compatible).
* **Entorno de Ejecución:** Node.js `22.x`.
* **Librería UI:** React `19.0.0` y React-DOM `19.0.0`.
* **Estilos:** Tailwind CSS `4.0.0` con `@tailwindcss/postcss`.
* **Iconografía:** Lucide React `0.475.0`.
* **Gráficos & Métricas:** Chart.js `4.6.1` y `react-chartjs-2` `5.3.1`.
* **Base de Datos & Auth:** Supabase Client `@supabase/supabase-js` `2.49.1`.
* **Inteligencia Artificial:** SDK oficial `@google/genai` `1.0.0`.
* **Single Source of Truth de Versión:** `src/lib/version.ts` declara canónicamente `3.5.0` (`v3.5.0-autonomous-core`).

---

### 2. Inventario de Rutas y Páginas
La aplicación cuenta con 27 rutas compilables entre páginas cliente/SSR y endpoints API:

#### Páginas Frontend (Rutas App)
1. `/` (`src/app/page.tsx`): Landing Page de presentación e inicio.
2. `/dashboard` (`src/app/dashboard/page.tsx`): Dashboard Cyber/RPG original con AI Command Center, Looker Studio financiero, Debt Bosses DoT y Árbol de Talentos.
3. `/cozy` (`src/app/cozy/page.tsx`): Dashboard temático Cozy Living Village en el Valle de Oakhaven.
4. `/login` (`src/app/login/page.tsx`): Flujo de autenticación seguro, demo-mode y acceso por Magic Link / Contraseña.
5. `/onboarding` (`src/app/onboarding/page.tsx`): Asistente de configuración guiado con IA para objetivos y misiones.
6. `/quick` (`src/app/quick/page.tsx`): Interfaz móvil PWA para captura rápida de gastos, sesiones y hábitos.
7. `/skills/[domain]` (`src/app/skills/[domain]/page.tsx`): Rutas dinámicas para cada dominio de habilidad del Santuario.
8. `/privacidad` (`src/app/privacidad/page.tsx`): Política obligatoria de tratamiento de datos y Habeas Data.

#### Endpoints API (`src/app/api/`)
* **Estado & Salud:**
  - `GET /api/state`: Retorna el estado completo del motor (`EngineStateData`), saldo de billetera, bóveda, sesiones, libros, tejido y racha.
  - `GET /api/health`: Healthcheck del sistema y verificación de conexión a base de datos.
* **Autenticación:**
  - `POST /api/auth/login`: Autenticación con cookies HTTP-only.
  - `POST /api/auth/logout`: Revocación de sesión.
  - `GET /api/auth/demo`: Creación de sesión instantánea de prueba (Demo Mode).
* **Atajos de Productividad y Captura:**
  - `POST /api/shortcuts/skill-session`: Registro de sesiones de habilidad con deduplicación e idempotencia estricta.
  - `POST /api/shortcuts/habit-log`: Registro de hábitos diarios y riego botánico.
  - `POST /api/shortcuts/quick-expense`: Registro de transacciones financieras y daño a Debt Bosses.
  - `POST /api/shortcuts/receipt-scan`: Escaneo de recibos físicos con IA.
  - `POST /api/shortcuts/boss-counterattack`: Contraataque dinámico a jefes de deuda.
  - `GET /api/shortcuts/widget-summary`: Datos compactos para widgets de iOS / Android.
* **Servicios Inteligentes & Integraciones:**
  - `POST /api/gamemaster/briefing`: Resumen estratégico diario generado por IA.
  - `GET /api/spotify/now-playing`: Integración en vivo con reproducción musical.

---

### 3. Arquitectura del Dashboard y Dualidad de Experiencias
El sistema implementa dos interfaces complementarias que comparten el mismo núcleo matemático:

1. **Tablero Original (`rpg-dashboard.tsx`):**
   - Enfoque: Alto rendimiento, visualización financiera densa, control de deuda (Estrategias Snowball y Avalanche), cálculo de impuestos pasivos y árbol de talentos.
   - Estética: Cyberpunk / RPG táctico de gestión.
2. **Cozy Living Village (`cozy-rpg-dashboard.tsx`):**
   - Enfoque: Productividad serena, autocuidado, ritmo orgánico y desconexión sin culpa (inspiración *Stardew Valley / Animal Crossing*).
   - Estética: Pergamino cálido, madera tallada, paleta tierra, clima dinámico y paisajes sonoros procedimentales nativos con Web Audio API.
   - Conexión: Totalmente sincronizado con `/api/state`, con capacidad de alternar entre la vista Tablero Bento y el Mapa Interactivo del Pueblo.

---

### 4. Persistencia, Seguridad y Manejo Offline
* **Supabase & RLS:** Tablas protegidas con Row Level Security para aislamiento multi-tenant por `user_id`.
* **Demo Store:** Contingencia en memoria y `localStorage` para navegación demo y pruebas sin credenciales de base de datos (`demo-store.ts`).
* **Resiliencia Offline PWA:** Cola de peticiones en `localStorage` (`rpg_offline_queue_v1`) mediante `offline-sync.ts`. Al recuperar conectividad, el listener `window.addEventListener('online')` sincroniza las acciones pendientes de forma transparente.
* **Idempotencia Criptográfica:** Uso de hashes SHA-256 (`crypto-hash.ts`) y claves idempotentes para impedir doble facturación, duplicación de lectura o doble resolución de cubos Rubik.

---

### 5. Suite de Pruebas y Estado de Verificación
El repositorio cuenta con 44 pruebas unitarias integradas ejecutadas mediante el test runner nativo de Node.js:
* `tests/rpg-engine.test.ts` (20 pruebas): Matemáticas WCA, SM-2, racha, combo overflow, parsing de divisas y árbol de talentos.
* `tests/automation-core.test.ts` (6 pruebas): EventBus, TaskQueue con reintentos, RuleEngine, CircadianScheduler.
* `tests/agents-core.test.ts` (3 pruebas): SystemGuardian, LifeCaptureAgent, AutonomousLifeManager.
* `tests/specialized-agents.test.ts` (4 pruebas): SmartExpenseEngine, SkillEvolutionAgent, DailyPlannerAgent, DynamicQuestGenerator.
* `tests/integrations.test.ts` (3 pruebas): Google Calendar, Notion, Webhooks HMAC SHA-256.
* `tests/stabilization-sprint.test.ts` (8 pruebas): Invariantes financieras, idempotencia, racha y consistencia de versión.

**Resultado de las pruebas:** 44/44 aprobadas (100% de éxito).
