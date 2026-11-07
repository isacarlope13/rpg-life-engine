import { NextResponse } from "next/server";
import { QuickExpenseShortcutRequest } from "@/types/rpg";
import { parseExpenseWithGemini } from "@/lib/gemini";
import { isSupabaseConfigured, resolvePlayerTreasury } from "@/lib/supabase";
import { requireShortcutUser, scopeIdempotencyKey } from "@/lib/request-auth";

export async function POST(req: Request) {
  try {
    const authCtx = await requireShortcutUser(req);
    if (!authCtx.ok) return authCtx.response;
    const { userId, store, db } = authCtx;

    const body = (await req.json()) as QuickExpenseShortcutRequest;

    let amount_cop = body.manual_override?.amount_cop || 0;
    let category = body.manual_override?.category || "discretionary_unbudgeted";
    let merchant_or_concept =
      body.manual_override?.merchant_or_concept || "Gasto rápido";
    let boss_name = body.manual_override?.boss_name || null;
    let detected_source: "bank_sms" | "voice_dictation" | "manual" = "manual";

    if (
      (body.input_mode === "natural_language" ||
        body.input_mode === "bank_sms") &&
      body.raw_text
    ) {
      const aiParsed = await parseExpenseWithGemini(body.raw_text);
      amount_cop = aiParsed.amount_cop;
      category = aiParsed.category;
      merchant_or_concept = aiParsed.merchant_or_concept;
      boss_name = aiParsed.boss_target !== "NONE" ? aiParsed.boss_target : null;
      detected_source = aiParsed.detected_source || "voice_dictation";
    }

    if (!amount_cop || amount_cop <= 0) {
      return NextResponse.json(
        { success: false, error: "El monto en COP debe ser mayor a 0" },
        { status: 400 }
      );
    }

    if (isSupabaseConfigured && db) {
      const treasury = await resolvePlayerTreasury(userId, db);

      if (!treasury) {
        return NextResponse.json(
          {
            success: false,
            error: "No existe player_treasury para el usuario actual (ejecuta supabase/seed.sql)",
          },
          { status: 404 }
        );
      }

      let bossId: string | null = null;
      if (category === "debt_attack" && boss_name) {
        const { data: bossRow } = await db
          .from("debt_bosses")
          .select("id")
          .eq("user_id", userId)
          .ilike("name", boss_name)
          .maybeSingle();
        bossId = bossRow?.id || null;
      }

      const { data: tx, error: txError } = await db
        .from("financial_transactions")
        .insert({
          user_id: userId,
          treasury_id: treasury.id,
          amount_cop,
          category,
          merchant_or_concept,
          boss_id: bossId,
          aegis_shield_used: body.use_aegis_shield ?? true,
          wishlist_item_id: body.manual_override?.wishlist_item_id || null,
          idempotency_key: scopeIdempotencyKey(userId, body.idempotency_key),
          ai_parsed_metadata: {
            input_mode: body.input_mode,
            detected_source,
            raw_text: body.raw_text,
          },
        })
        .select("*")
        .single();

      if (txError) {
        return NextResponse.json(
          { success: false, error: txError.message },
          { status: 500 }
        );
      }

      const { data: updatedTreasury } = await db
        .from("player_treasury")
        .select("*")
        .eq("id", treasury.id)
        .single();

      return NextResponse.json(
        {
          success: true,
          mode: "supabase",
          transaction_id: tx.id,
          parsed_data: {
            amount_cop,
            category,
            merchant_or_concept,
            detected_source,
            multiplier_applied: tx.aegis_shield_used
              ? 1.0
              : category === "discretionary_unbudgeted"
              ? 1.2
              : 1.0,
          },
          rpg_impact: {
            wallet_gp_deducted: tx.wallet_gp_deducted,
            penalty_gp_applied: tx.penalty_gp_applied,
            aegis_shield_used: tx.aegis_shield_used,
          },
          treasury_snapshot: {
            billing_period: updatedTreasury.billing_period,
            wallet_gp: updatedTreasury.wallet_gp,
            vault_remaining_gp: updatedTreasury.vault_remaining_gp,
            aegis_shields: updatedTreasury.aegis_shields,
            status_effect:
              updatedTreasury.wallet_gp < 0 ? "OVERDRAWN_CURSE" : "HEALTHY",
          },
          shortcut_tts_message: tx.aegis_shield_used
            ? `Escudo Aegis activado en ${merchant_or_concept}. Se bloqueó la multa del 20 por ciento y solo pagaste ${Number(tx.wallet_gp_deducted).toLocaleString("es-CO")} GP.`
            : category === "discretionary_unbudgeted"
            ? `Alerta de gasto no presupuestado en ${merchant_or_concept}. Se descontaron ${Number(tx.wallet_gp_deducted).toLocaleString("es-CO")} GP incluyendo ${Number(tx.penalty_gp_applied).toLocaleString("es-CO")} GP de castigo.`
            : `Transacción procesada: ${merchant_or_concept} por ${amount_cop.toLocaleString("es-CO")} pesos.`,
        },
        { status: 201 }
      );
    }

    // Motor Local v3.0 (Con Idempotencia, Escudo Aegis, Control de Presupuestos y Combo Overflow)
    const impact = store.recordTransaction({
      amount_cop,
      category,
      merchant_or_concept,
      boss_name,
      wishlist_item_id: body.manual_override?.wishlist_item_id || null,
      use_aegis_shield: body.use_aegis_shield,
      idempotency_key: body.idempotency_key,
    });

    const ttsMessage =
      category === "discretionary_unbudgeted"
        ? impact.aegis_shield_used
          ? `¡Escudo Aegis activado! Tu disciplina absorbió la multa de 20 por ciento en ${merchant_or_concept}. Solo se descontaron ${impact.wallet_gp_deducted.toLocaleString("es-CO")} GP.`
          : `Alerta de gasto no presupuestado en ${merchant_or_concept}. Se descontaron ${impact.wallet_gp_deducted.toLocaleString("es-CO")} GP de tu billetera incluyendo ${impact.penalty_gp_applied.toLocaleString("es-CO")} GP de castigo.`
        : category === "debt_attack"
        ? `¡Ataque ejecutado! ${impact.combo_summary}.${
            impact.overflow_damage_cop > 0
              ? ` ¡Combo Overflow! ${impact.overflow_damage_cop.toLocaleString("es-CO")} de daño excedente impactó al siguiente Boss.`
              : ""
          }`
        : `Transacción registrada: ${merchant_or_concept} por ${amount_cop.toLocaleString("es-CO")} COP.`;

    return NextResponse.json(
      {
        success: true,
        mode: "local_engine",
        transaction_id: crypto.randomUUID(),
        parsed_data: {
          amount_cop,
          category,
          merchant_or_concept,
          detected_source,
          multiplier_applied: impact.aegis_shield_used
            ? 1.0
            : category === "discretionary_unbudgeted"
            ? 1.2
            : 1.0,
        },
        rpg_impact: impact,
        treasury_snapshot: {
          billing_period: store.billing_period,
          wallet_gp: store.wallet_gp,
          vault_remaining_gp: store.vault_remaining_gp,
          aegis_shields: store.aegis_shields,
          streak_days: store.current_streak_days,
          streak_multiplier: store.streak_multiplier,
          status_effect:
            store.wallet_gp < 0 ? "OVERDRAWN_CURSE" : "HEALTHY",
        },
        shortcut_tts_message: ttsMessage,
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error inesperado";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
