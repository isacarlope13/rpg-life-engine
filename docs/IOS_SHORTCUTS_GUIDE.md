# Guía Paso a Paso — OakHaven Wrist & Atajos de iOS

Esta guía distingue tres niveles de integración:
1. **Atajos de iOS (HTTP sobre HTTPS):** utilizable hoy en iPhone y en Apple Watch mediante la app *Atajos* / Siri.
2. **Apple Watch vía Atajos:** ejecuta los mismos Atajos configurados en el iPhone desde la muñeca (sin instalar app propia).
3. **App Nativa watchOS (futuro):** proyecto SwiftUI/WatchConnectivity independiente con cola offline nativa en el reloj.

## Reglas de seguridad obligatorias
- **Tokens personales revocables:** cuando autorices su emisión en producción, cada token se almacenará únicamente como hash **SHA-256** con alcance mínimo (`read:summary`, `write:quick_capture`, `write:timer`), fecha de expiración, límite de tasa (`30 req/min`) y protección anti-replay (`idempotencyKey` + ventana de `15 min`).
- **Cero mutación directa de GP, XP o COP desde el dispositivo:** el servidor rechaza cualquier payload que incluya `wallet_gp`, `current_xp`, `amount_cop` o `user_id`.

## Cómo configurar cada Atajo en iPhone / Apple Watch
1. **Registrar hábito rápido (`quick_habit`):**
   - Acción *Obtener contenido de URL* → `POST https://<tu-dominio>/api/shortcuts/habit-log`
   - Cabeceras: `Content-Type: application/json`, `Authorization: Bearer <token-personal>`
   - Cuerpo JSON: `{"quest_code":"CUSTOM","title":"Hábito rápido","idempotency_key":"qc:ios:habit:<fecha-minuto>"}`
2. **Iniciar / finalizar sesión (`quick_timer_start` / `quick_timer_stop`):**
   - `POST /api/shortcuts/skill-session` con `action` y `duration_minutes` (1–480).
3. **Consultar tareas, GP y XP (`read:summary`):**
   - `GET /api/shortcuts/widget-summary` → devuelve resumen compacto para mostrar en notificación de iPhone o Apple Watch.
4. **Registrar gasto con confirmación (`quick_expense_confirm`):**
   - Siempre incluye paso nativo de *Mostrar alerta / Confirmar* en Atajos antes de enviar la solicitud (nunca ejecuta pagos ni transferencias bancarias).
5. **Capturar idea / registrar energía disponible (`quick_idea` / `quick_energy_log`):**
   - Usa *Solicitar entrada* (texto o menú `Baja / Media / Alta`) y envía con `idempotencyKey` determinista.
