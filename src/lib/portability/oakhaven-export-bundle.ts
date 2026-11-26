/**
 * ============================================================================
 * OAKHAVEN — PORTABILIDAD, VALIDACIÓN Y VISTA PREVIA DE IMPORTACIÓN SEGURA
 * ============================================================================
 * - Exportación estructurada con versionado de esquema (`schemaVersion: 1`).
 * - Redacción automática de secretos/tokens.
 * - Validación estricta de archivos importados y detección de duplicados.
 * - Separación estricta entre progresión virtual (GP/XP) y dinero real (COP).
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

export interface PortabilityImportPreview {
  valid: boolean;
  errors: string[];
  newKnittingCount: number;
  duplicateKnittingCount: number;
  newBooksCount: number;
  duplicateBooksCount: number;
  newNotesCount: number;
  duplicateNotesCount: number;
  sanitizedBundle?: OakHavenPortabilityBundle;
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

export function validatePortabilityBundle(
  raw: unknown
): { valid: true; bundle: OakHavenPortabilityBundle } | { valid: false; errors: string[] } {
  const errors: string[] = [];
  if (!raw || typeof raw !== "object") {
    return { valid: false, errors: ["El archivo debe ser un objeto JSON válido."] };
  }
  const obj = raw as Record<string, unknown>;
  if (obj.schemaVersion !== 1) {
    errors.push(`Versión de esquema no soportada: ${String(obj.schemaVersion)}.`);
  }
  if (obj.app !== "OakHaven Personal Life OS") {
    errors.push("El archivo no pertenece a OakHaven Personal Life OS.");
  }
  if (obj.includesRealMoneyCop !== false) {
    errors.push("El paquete de portabilidad general no puede mezclar registros de dinero real COP.");
  }
  const records = obj.personalRecords as Record<string, unknown> | undefined;
  if (
    !records ||
    !Array.isArray(records.knittingProjects) ||
    !Array.isArray(records.readingBooks) ||
    !Array.isArray(records.notes)
  ) {
    errors.push("Faltan colecciones válidas dentro de personalRecords.");
  }
  if (errors.length > 0) {
    return { valid: false, errors };
  }
  return {
    valid: true,
    bundle: sanitizeForPortability(obj as unknown as OakHavenPortabilityBundle),
  };
}

export function previewPortabilityImport(
  rawBundle: unknown,
  existing: {
    knittingProjects: Array<{ id?: string; name?: string }>;
    readingBooks: Array<{ id?: string; title?: string }>;
    notes: string[];
  }
): PortabilityImportPreview {
  const check = validatePortabilityBundle(rawBundle);
  if (!check.valid) {
    return {
      valid: false,
      errors: check.errors,
      newKnittingCount: 0,
      duplicateKnittingCount: 0,
      newBooksCount: 0,
      duplicateBooksCount: 0,
      newNotesCount: 0,
      duplicateNotesCount: 0,
    };
  }

  const existingKnitKeys = new Set(
    existing.knittingProjects.map((k) => `${k.id || ""}::${(k.name || "").trim().toLowerCase()}`)
  );
  const existingKnitIds = new Set(existing.knittingProjects.map((k) => String(k.id || "")).filter(Boolean));
  const existingBookIds = new Set(existing.readingBooks.map((b) => String(b.id || "")).filter(Boolean));
  const existingNotes = new Set(existing.notes.map((n) => n.trim().toLowerCase()));

  let newKnittingCount = 0;
  let duplicateKnittingCount = 0;
  for (const k of check.bundle.personalRecords.knittingProjects) {
    const id = String(k.id || "");
    const key = `${id}::${String(k.name || "").trim().toLowerCase()}`;
    if ((id && existingKnitIds.has(id)) || existingKnitKeys.has(key)) duplicateKnittingCount += 1;
    else newKnittingCount += 1;
  }

  let newBooksCount = 0;
  let duplicateBooksCount = 0;
  for (const b of check.bundle.personalRecords.readingBooks) {
    const id = String(b.id || "");
    if (id && existingBookIds.has(id)) duplicateBooksCount += 1;
    else newBooksCount += 1;
  }

  let newNotesCount = 0;
  let duplicateNotesCount = 0;
  for (const n of check.bundle.personalRecords.notes) {
    if (existingNotes.has(n.trim().toLowerCase())) duplicateNotesCount += 1;
    else newNotesCount += 1;
  }

  return {
    valid: true,
    errors: [],
    newKnittingCount,
    duplicateKnittingCount,
    newBooksCount,
    duplicateBooksCount,
    newNotesCount,
    duplicateNotesCount,
    sanitizedBundle: check.bundle,
  };
}
