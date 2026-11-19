import { NextResponse } from "next/server";
import { requireShortcutUser } from "@/lib/request-auth";
import { getAiObservabilitySnapshot } from "@/lib/ai/ai-observability";

/**
 * GET /api/ai/observability
 * Devuelve métricas agregadas Zero-PII del rendimiento de la IA (sin prompts, sin respuestas,
 * sin documentos ni datos financieros). Requiere usuario autenticado.
 */
export async function GET(req: Request) {
  const authCtx = await requireShortcutUser(req);
  if (!authCtx.ok) return authCtx.response;

  return NextResponse.json({
    success: true,
    observability: getAiObservabilitySnapshot(),
  });
}
