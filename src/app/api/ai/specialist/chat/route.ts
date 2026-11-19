import { NextResponse } from "next/server";
import { requireShortcutUser } from "@/lib/request-auth";
import { checkAiQuotaAllowance } from "@/lib/ai-cache-and-ratelimit";
import { redactSensitiveForLogs, type MayorChatTurn } from "@/lib/ai/mayor-rowan-engine";
import {
  askBuildingSpecialist,
  getSpecialistSkillForBuilding,
} from "@/lib/ai/specialist-engine";
import { listLocalUserResources } from "@/lib/ai/local-resources-memory";
import type { LocalClientSnapshot } from "@/lib/ai/mayor-readonly-tools";

interface SpecialistChatBody {
  buildingId?: string;
  message?: string;
  history?: MayorChatTurn[];
  local_snapshot?: LocalClientSnapshot;
  ai_enabled?: boolean;
  disabled_skill_ids?: string[];
  selected_resource_id?: string;
}

export async function POST(req: Request) {
  try {
    const authCtx = await requireShortcutUser(req);
    if (!authCtx.ok) return authCtx.response;
    const { userId, db, store, mode } = authCtx;
    const isSupabaseConfigured = mode === "supabase" && Boolean(db);

    if (process.env.OAKHAVEN_AI_ENABLED === "false") {
      return NextResponse.json(
        { success: false, error: "Los asistentes de IA están desactivados en el servidor." },
        { status: 503 }
      );
    }

    let body: SpecialistChatBody;
    try {
      body = (await req.json()) as SpecialistChatBody;
    } catch {
      return NextResponse.json({ success: false, error: "JSON inválido." }, { status: 400 });
    }

    const buildingId = (body.buildingId || "").trim();
    if (!buildingId || !getSpecialistSkillForBuilding(buildingId)) {
      return NextResponse.json(
        { success: false, error: `Edificio "${buildingId}" sin especialista registrado.` },
        { status: 400 }
      );
    }

    const message = (body.message || "").trim();
    if (!message || message.length > 600) {
      return NextResponse.json(
        { success: false, error: "Escribe una consulta válida (máximo 600 caracteres)." },
        { status: 400 }
      );
    }

    const quota = checkAiQuotaAllowance(`specialist:${userId}`);
    if (!quota.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: "Límite temporal de consultas alcanzado. Intenta nuevamente en un minuto.",
          remaining_quota_today: quota.remainingToday,
        },
        { status: 429 }
      );
    }

    const history: MayorChatTurn[] = Array.isArray(body.history)
      ? body.history
          .slice(-8)
          .filter(
            (t): t is MayorChatTurn =>
              Boolean(t) &&
              (t.role === "user" || t.role === "assistant") &&
              typeof t.content === "string"
          )
          .map((t) => ({ role: t.role, content: t.content.slice(0, 600) }))
      : [];

    const response = await askBuildingSpecialist({
      buildingId,
      question: message,
      history,
      allowGemini: body.ai_enabled !== false,
      disabledSkillIds: Array.isArray(body.disabled_skill_ids) ? body.disabled_skill_ids : undefined,
      selectedResourceId: typeof body.selected_resource_id === "string" ? body.selected_resource_id : undefined,
      memoryResources: !isSupabaseConfigured ? listLocalUserResources(userId) : undefined,
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
    const rawMsg = err instanceof Error ? err.message : "Error inesperado en especialista";
    console.error("[api/ai/specialist/chat]", redactSensitiveForLogs(rawMsg));
    return NextResponse.json(
      { success: false, error: "No fue posible consultar al especialista en este momento." },
      { status: 500 }
    );
  }
}
