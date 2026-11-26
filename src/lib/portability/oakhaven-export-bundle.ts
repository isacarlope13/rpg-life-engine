/**
 * ============================================================================
 * OAKHAVEN — PORTABILIDAD Y EXPORTACIÓN SEGURA DE DATOS PERSONALES
 * ============================================================================
 * Genera un paquete JSON portable con los datos personales del propietario
 * (proyectos, notas, libros, sesiones, patrones Filet y notas Ink) manteniendo:
 * 1. Separación estricta entre economía virtual (GP/XP) y dinero real (COP).
 * 2. Redacción automática de cualquier campo sensible (tokens, contraseñas, keys).
 */

export interface OakHavenPortabilityBundle {
  schemaVersion: 1;
  exportedAt: string;
  app: "OakHaven Personal Life OS";
  virtualProgression: {
    walletGp: number;
    vaultRemainingGp: number;
    vaultCapGp: number;
    currentXp: number;
    playerLevel: number;
    streakDays: number;
  };
  personalRecords: {
    knittingProjects: Array<Record<string, unknown>>;
    readingBooks: Array<Record<string, unknown>>;
    notes: string[];
  };
  includesRealMoneyCop: false;
}

const SENSITIVE_KEY_PATTERN = /(password|secret|token|service_role|api_key|authorization|cookie)/i;

export function sanitizeForPortability<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeForPortability(item)) as unknown as T;
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEY_PATTERN.test(k)) continue;
      out[k] = sanitizeForPortability(v);
    }
    return out as T;
  }
  return value;
}

export function buildOakHavenPortabilityBundle(params: {
  walletGp: number;
  vaultRemainingGp: number;
  vaultCapGp: number;
  currentXp: number;
  playerLevel: number;
  streakDays: number;
  knittingProjects: Array<Record<string, unknown>>;
  readingBooks: Array<Record<string, unknown>>;
  notes: string[];
  exportedAt?: string;
}): OakHavenPortabilityBundle {
  return {
    schemaVersion: 1,
    exportedAt: params.exportedAt || new Date().toISOString(),
    app: "OakHaven Personal Life OS",
    virtualProgression: {
      walletGp: Math.round(Number(params.walletGp) || 0),
      vaultRemainingGp: Math.max(0, Math.round(Number(params.vaultRemainingGp) || 0)),
      vaultCapGp: Math.max(0, Math.round(Number(params.vaultCapGp) || 0)),
      currentXp: Math.max(0, Math.round(Number(params.currentXp) || 0)),
      playerLevel: Math.max(1, Math.round(Number(params.playerLevel) || 1)),
      streakDays: Math.max(0, Math.round(Number(params.streakDays) || 0)),
    },
    personalRecords: {
      knittingProjects: sanitizeForPortability(params.knittingProjects),
      readingBooks: sanitizeForPortability(params.readingBooks),
      notes: params.notes.map((n) => String(n).slice(0, 1000)),
    },
    includesRealMoneyCop: false,
  };
}
