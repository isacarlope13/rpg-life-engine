import { NextResponse } from "next/server";
import { generateGameMasterBriefing } from "@/lib/gemini";
import { requireShortcutUser } from "@/lib/request-auth";

export async function POST(req: Request) {
  try {
    const authCtx = await requireShortcutUser(req);
    if (!authCtx.ok) return authCtx.response;
    const { store } = authCtx;

    const rubikStats = store.getRubikStats("3x3");
    const strategyComp = store.getDebtStrategyComparison();

    const narrative = await generateGameMasterBriefing({
      wallet_gp: store.wallet_gp,
      vault_remaining_gp: store.vault_remaining_gp,
      total_penalty_gp: store.total_penalty_gp,
      streak_days: store.current_streak_days,
      aegis_shields: store.aegis_shields,
      bosses: store.bosses,
      rubik_pb: rubikStats.pb_seconds,
      rubik_ao5: rubikStats.ao5_seconds,
      total_skill_sessions: store.skillSessions.length,
      interest_saved_avalanche: strategyComp.interest_saved_with_avalanche_cop,
    });

    return NextResponse.json({
      success: true,
      briefing: narrative,
      ttk_projections: store.getBossTTKProjections(),
      debt_strategy_comparison: strategyComp,
      generated_at: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error inesperado";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
