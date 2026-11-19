/**
 * ============================================================================
 * OAKHAVEN AI FASE 7 — OBSERVABILIDAD SEGURA Y CONTROL DE COSTOS (ZERO-PII)
 * ============================================================================
 * REGLAS DE PRIVACIDAD:
 * - NUNCA almacena preguntas completas, respuestas privadas, contenido de
 *   documentos, cifras financieras ni secretos.
 * - Solo registra contadores agregados, latencia en ms y tokens reportados
 *   oficialmente por el proveedor (nunca estima costos sin tarifas verificadas).
 */

export interface AiTelemetryEvent {
  agentId: string; // e.g. "rowan", "clara", "silas"
  buildingId: string;
  mode: "gemini_grounded" | "deterministic_grounded" | "blocked_safety" | "disabled";
  durationMs: number;
  usedGemini: boolean;
  cacheHit?: boolean;
  timedOut?: boolean;
  hadError?: boolean;
  inputTokens?: number;
  outputTokens?: number;
}

export interface AgentObservabilityStats {
  agentId: string;
  buildingId: string;
  totalRequests: number;
  deterministicRequests: number;
  geminiRequests: number;
  blockedRequests: number;
  errors: number;
  timeouts: number;
  cacheHits: number;
  totalDurationMs: number;
  avgLatencyMs: number;
  lastLatencyMs: number;
  reportedInputTokens: number;
  reportedOutputTokens: number;
}

const GLOBAL_OBS_KEY = "__oakhaven_ai_observability_v1__";

function getStatsMap(): Map<string, AgentObservabilityStats> {
  const g = globalThis as unknown as Record<string, Map<string, AgentObservabilityStats> | undefined>;
  if (!g[GLOBAL_OBS_KEY]) {
    g[GLOBAL_OBS_KEY] = new Map<string, AgentObservabilityStats>();
  }
  return g[GLOBAL_OBS_KEY]!;
}

export function recordAiTelemetryEvent(event: AiTelemetryEvent): void {
  const map = getStatsMap();
  const key = `${event.agentId}:${event.buildingId}`;
  const prev = map.get(key) || {
    agentId: event.agentId,
    buildingId: event.buildingId,
    totalRequests: 0,
    deterministicRequests: 0,
    geminiRequests: 0,
    blockedRequests: 0,
    errors: 0,
    timeouts: 0,
    cacheHits: 0,
    totalDurationMs: 0,
    avgLatencyMs: 0,
    lastLatencyMs: 0,
    reportedInputTokens: 0,
    reportedOutputTokens: 0,
  };

  prev.totalRequests += 1;
  if (event.mode === "blocked_safety") prev.blockedRequests += 1;
  else if (event.usedGemini) prev.geminiRequests += 1;
  else prev.deterministicRequests += 1;

  if (event.hadError) prev.errors += 1;
  if (event.timedOut) prev.timeouts += 1;
  if (event.cacheHit) prev.cacheHits += 1;

  const dur = Math.max(0, Math.round(event.durationMs));
  prev.totalDurationMs += dur;
  prev.lastLatencyMs = dur;
  prev.avgLatencyMs = Math.round(prev.totalDurationMs / prev.totalRequests);

  if (typeof event.inputTokens === "number" && event.inputTokens > 0) {
    prev.reportedInputTokens += event.inputTokens;
  }
  if (typeof event.outputTokens === "number" && event.outputTokens > 0) {
    prev.reportedOutputTokens += event.outputTokens;
  }

  map.set(key, prev);
}

export function getAiObservabilitySnapshot() {
  const agents = Array.from(getStatsMap().values());
  const totals = agents.reduce(
    (acc, a) => {
      acc.totalRequests += a.totalRequests;
      acc.deterministicRequests += a.deterministicRequests;
      acc.geminiRequests += a.geminiRequests;
      acc.blockedRequests += a.blockedRequests;
      acc.errors += a.errors;
      acc.timeouts += a.timeouts;
      acc.cacheHits += a.cacheHits;
      acc.reportedInputTokens += a.reportedInputTokens;
      acc.reportedOutputTokens += a.reportedOutputTokens;
      return acc;
    },
    {
      totalRequests: 0,
      deterministicRequests: 0,
      geminiRequests: 0,
      blockedRequests: 0,
      errors: 0,
      timeouts: 0,
      cacheHits: 0,
      reportedInputTokens: 0,
      reportedOutputTokens: 0,
    }
  );

  return {
    generatedAt: new Date().toISOString(),
    privacyGuarantee: "Zero-PII: sin preguntas, sin respuestas, sin documentos ni importes financieros.",
    costEstimateNote:
      "Sin tarifas de facturación verificadas en runtime; se reportan únicamente conteos de solicitudes y tokens entregados por el proveedor.",
    totals,
    byAgent: agents,
  };
}

export function resetAiObservabilityForTests(): void {
  getStatsMap().clear();
}
