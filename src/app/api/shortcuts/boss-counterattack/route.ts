import { NextResponse } from "next/server";
import { isSupabaseConfigured, supabaseAdmin } from "@/lib/supabase";
import { requireShortcutUser } from "@/lib/request-auth";

export async function POST(req: Request) {
  try {
    const authCtx = await requireShortcutUser(req);
    if (!authCtx.ok) return authCtx.response;
    const { userId, store, db } = authCtx;

    if (isSupabaseConfigured && db) {
      // fn_boss_monthly_counterattack es SECURITY DEFINER y acepta un user_id arbitrario,
      // por eso SOLO el rol service_role puede ejecutarla (ver supabase/auth_profiles.sql).
      // El user_id proviene de la identidad verificada (sesión o token personal), no del cliente.
      if (!supabaseAdmin) {
        return NextResponse.json(
          {
            success: false,
            error: "Falta SUPABASE_SERVICE_ROLE_KEY para ejecutar el cierre de mes.",
          },
          { status: 500 }
        );
      }
      const { data, error } = await supabaseAdmin.rpc(
        "fn_boss_monthly_counterattack",
        { p_user_id: userId }
      );
      if (error) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 500 }
        );
      }
      return NextResponse.json({
        success: true,
        mode: "supabase",
        counterattack_result: data,
      });
    }

    const result = store.triggerBossCounterAttack();
    return NextResponse.json({
      success: true,
      mode: "local_engine",
      counterattack_result: result,
      bosses: store.bosses,
      vault_remaining_gp: store.vault_remaining_gp,
      shortcut_tts_message: `¡Alerta de Cierre de Mes! Los Bosses vivos se han regenerado ${result.total_interest_healed_cop.toLocaleString("es-CO")} pesos en intereses y ${result.enraged_bosses_count} entraron en estado Enraged, bloqueando ${result.vault_gp_locked_by_enrage.toLocaleString("es-CO")} GP de tu Bóveda.`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error inesperado";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
