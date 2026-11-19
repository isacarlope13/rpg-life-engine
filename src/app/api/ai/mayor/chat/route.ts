import { NextResponse } from "next/server";
import { requireShortcutUser } from "@/lib/request-auth";
import { checkAiQuotaAllowance } from "@/lib/ai-cache-and-ratelimit";
import {
  askMayorRowan,
  redactSensitiveForLogs,
  type MayorChatTurn,
} from "@/lib/ai/mayor-rowan-engine";
import type { LocalClientSnapshot } from "@/lib/ai/mayor-readonly-tools";

interface MayorChatRequestBody {
  message?: string;
  history?: MayorChatTurn[];
  local_snapshot?: LocalClientSnapshot;
  ai_enabled?: boolean;
  disabled_skill_ids?: string[];
}

const MAX_MESSAGE_CHARS = 600;
const MAX_HISTORY_TURNS = 10;

export async function POST(req: Request) {
  try {
    // 1. Autenticación obligatoria en el servidor (nunca confiar en userId del body)
    const authCtx = await requireShortcutUser(req);
    if (!authCtx.ok) return authCtx.response;
    const { userId, db, store, mode } = authCtx;
    const isSupabaseConfigured = mode === "supabase" && Boolean(db);

    // 2. Interruptor global de IA
    if (process.env.OAKHAVEN_AI_ENABLED === "false") {
      return NextResponse.json(
        {
          success: false,
          error: "El asistente de IA está desactivado por configuración del servidor.",
        },
        { status: 503 }
      );
    }

    // 3. Validación estricta del cuerpo
    let body: MayorChatRequestBody;
    try {
      body = (await req.json()) as MayorChatRequestBody;
    } catch {
      return NextResponse.json(
        { success: false, error: "Cuerpo JSON inválido." },
        { status: 400 }
      );
    }

    const message = typeof body.message === "string" ? body.message.trim() : "";
    if (!message) {
      return NextResponse.json(
        { success: false, error: "Escribe una pregunta para el Presidente Rowan." },
        { status: 400 }
      );
    }
    if (message.length > MAX_MESSAGE_CHARS) {
      return NextResponse.json(
        {
          success: false,
          error: `La pregunta supera el máximo de ${MAX_MESSAGE_CHARS} caracteres.`,
        },
        { status: 400 }
      );
    }

    const history: MayorChatTurn[] = Array.isArray(body.history)
      ? body.history
          .slice(-MAX_HISTORY_TURNS)
          .filter(
            (t): t is MayorChatTurn =>
              Boolean(t) &&
              (t.role === "user" || t.role === "assistant") &&
              typeof t.content === "string"
          )
          .map((t) => ({ role: t.role, content: t.content.slice(0, MAX_MESSAGE_CHARS) }))
      : [];

    // 4. Rate limiting por usuario autenticado
    const quota = checkAiQuotaAllowance(`mayor:${userId}`);
    if (!quota.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: "Has alcanzado el límite temporal de consultas al Presidente Rowan. Intenta de nuevo en un minuto.",
          remaining_quota_today: quota.remainingToday,
        },
        { status: 429 }
      );
    }

    // 5. Ejecutar consulta grounded (solo herramientas de solo lectura)
    const allowGemini = body.ai_enabled !== false;
    const response = await askMayorRowan({
      question: message,
      history,
      allowGemini,
      disabledSkillIds: Array.isArray(body.disabled_skill_ids) ? body.disabled_skill_ids : undefined,
      ctx: {
        authenticatedUserId: userId,
        db,
        store,
        isSupabaseConfigured,
        localSnapshot: body.local_snapshot,
      },
    });

    return NextResponse.json({
      success: true,
      ...response,
      remaining_quota_today: quota.remainingToday,
      generated_at: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const rawMsg = err instanceof Error ? err.message : "Error inesperado en Presidente Rowan";
    console.error("[api/ai/mayor/chat]", redactSensitiveForLogs(rawMsg));
    return NextResponse.json(
      { success: false, error: "No fue posible procesar tu consulta en este momento." },
      { status: 500 }
    );
  }
}
