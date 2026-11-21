export interface WidgetSummaryStoreSnapshot {
  player_level: number;
  current_streak_days: number;
  streak_multiplier: number;
  aegis_shields: number;
  readingBooks?: unknown[];
  knittingProjects?: unknown[];
  skillSessions?: unknown[];
}

export interface SafeWidgetSummaryResponse {
  player_level: number;
  streak_days: number;
  streak_multiplier: number;
  aegis_shields: number;
  cozy_village: {
    town_name: string;
    reading_books_count: number;
    knitting_projects_count: number;
    recent_sessions_count: number;
    community_stars: number;
    sanctuary_buildings_count: number;
  };
  widget_integration: {
    status: "pending_authenticated_integration";
    auth_required: true;
    financial_data_exposed: false;
    supported_auth_methods: string[];
    planned_phase: string;
    message: string;
  };
  ios_scriptable_widget_code: string;
}

export const PENDING_AUTHENTICATED_WIDGET_NOTICE = `// OakHaven — Widget iOS (Scriptable) deshabilitado temporalmente en Release 3.3
//
// Motivo de seguridad:
// - GET /api/shortcuts/widget-summary exige autenticación privada de propietario único
//   y responde HTTP 401 Unauthorized a solicitudes anónimas.
// - Un script ejecutable sin credenciales fallaría con 401, y nunca se deben incrustar
//   tokens, contraseñas, UUIDs ni saldos financieros en código copiable o pantalla bloqueada.
//
// Próxima fase (OakHaven Wrist + Apple Shortcuts):
// - Emisión y rotación de token personal (x-api-key: rpg_usr_...) almacenado en iOS Keychain.
// - Resumen privado optimizado para widget sin exposición de montos financieros.`;

/**
 * Construye la respuesta segura del resumen de widget para usuarios ya autenticados.
 * - No expone datos financieros (wallet_gp, bóveda ni deudas) ni secretos/UUIDs.
 * - Deshabilita el antiguo snippet ejecutable anónimo de Scriptable hasta habilitar
 *   el aprovisionamiento autenticado de tokens personales en OakHaven Wrist + Apple Shortcuts.
 */
export function buildSafeWidgetSummaryPayload(
  store: WidgetSummaryStoreSnapshot
): SafeWidgetSummaryResponse {
  return {
    player_level: store.player_level,
    streak_days: store.current_streak_days,
    streak_multiplier: store.streak_multiplier,
    aegis_shields: store.aegis_shields,
    cozy_village: {
      town_name: "Valle de Oakhaven",
      reading_books_count: store.readingBooks?.length || 0,
      knitting_projects_count: store.knittingProjects?.length || 0,
      recent_sessions_count: store.skillSessions?.length || 0,
      community_stars: 5.0,
      sanctuary_buildings_count: 8,
    },
    widget_integration: {
      status: "pending_authenticated_integration",
      auth_required: true,
      financial_data_exposed: false,
      supported_auth_methods: ["session_cookie", "x-api-key (rpg_usr_...)"],
      planned_phase: "OakHaven Wrist + Apple Shortcuts",
      message:
        "El widget externo requiere integración autenticada con token personal en iOS Keychain (pendiente para OakHaven Wrist + Apple Shortcuts).",
    },
    ios_scriptable_widget_code: PENDING_AUTHENTICATED_WIDGET_NOTICE,
  };
}
