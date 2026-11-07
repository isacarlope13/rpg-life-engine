import { NextResponse } from "next/server";
import { ReceiptScanShortcutRequest } from "@/types/rpg";
import { parseReceiptWithGeminiVision } from "@/lib/gemini";
import { isSupabaseConfigured, resolvePlayerTreasury } from "@/lib/supabase";
import { requireShortcutUser, scopeIdempotencyKey } from "@/lib/request-auth";

export async function POST(req: Request) {
  try {
    const authCtx = await requireShortcutUser(req);
    if (!authCtx.ok) return authCtx.response;
    const { userId, store, db } = authCtx;

    const body = (await req.json()) as ReceiptScanShortcutRequest;

    const split = await parseReceiptWithGeminiVision({
      receipt_text: body.receipt_text,
      image_base64: body.image_base64,
      mime_type: body.mime_type,
    });

    const baseIdemKey = body.idempotency_key?.trim();

    if (isSupabaseConfigured && db) {
      const treasury = await resolvePlayerTreasury(userId, db);

      if (!treasury) {
        return NextResponse.json(
          {
            success: false,
            error:
              "No existe player_treasury para el usuario actual (ejecuta supabase/seed.sql)",
          },
          { status: 404 }
        );
      }

      let operationalImpact = null;
      if (split.operational_essential_cop > 0) {
        const { data: opsTx, error: opsErr } = await db
          .from("financial_transactions")
          .insert({
            user_id: userId,
            treasury_id: treasury.id,
            amount_cop: split.operational_essential_cop,
            category: "variable_operational",
            merchant_or_concept: `${split.merchant_name} (Esenciales: ${split.essential_items_summary})`,
            aegis_shield_used: false,
            idempotency_key: scopeIdempotencyKey(
              userId,
              baseIdemKey ? `${baseIdemKey}:ops` : undefined
            ),
          })
          .select("*")
          .single();

        if (opsErr) {
          return NextResponse.json(
            { success: false, error: opsErr.message },
            { status: 500 }
          );
        }
        operationalImpact = opsTx;
      }

      let discretionaryImpact = null;
      if (split.discretionary_unbudgeted_cop > 0) {
        const { data: discTx, error: discErr } = await db
          .from("financial_transactions")
          .insert({
            user_id: userId,
            treasury_id: treasury.id,
            amount_cop: split.discretionary_unbudgeted_cop,
            category: "discretionary_unbudgeted",
            merchant_or_concept: `${split.merchant_name} (Antojos: ${split.unbudgeted_items_summary})`,
            aegis_shield_used: body.use_aegis_shield ?? false,
            idempotency_key: scopeIdempotencyKey(
              userId,
              baseIdemKey ? `${baseIdemKey}:disc` : undefined
            ),
          })
          .select("*")
          .single();

        if (discErr) {
          return NextResponse.json(
            { success: false, error: discErr.message },
            { status: 500 }
          );
        }
        discretionaryImpact = discTx;
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
          receipt_analysis: split,
          operational_impact: operationalImpact,
          discretionary_impact: discretionaryImpact,
          treasury_snapshot: {
            wallet_gp: Number(updatedTreasury?.wallet_gp ?? treasury.wallet_gp),
            vault_remaining_gp: Number(
              updatedTreasury?.vault_remaining_gp ?? treasury.vault_remaining_gp
            ),
            aegis_shields: Number(
              updatedTreasury?.aegis_shields ?? treasury.aegis_shields
            ),
          },
          shortcut_tts_message: `Factura de ${split.merchant_name} dividida con éxito en Supabase. ${split.operational_essential_cop.toLocaleString("es-CO")} pesos fueron a mercado operativo sin multa, y ${split.discretionary_unbudgeted_cop.toLocaleString("es-CO")} pesos se detectaron como antojos.`,
        },
        { status: 201 }
      );
    }

    // 1. Registra la parte operativa esencial (Sin multa)
    let operationalImpact = null;
    if (split.operational_essential_cop > 0) {
      operationalImpact = store.recordTransaction({
        amount_cop: split.operational_essential_cop,
        category: "variable_operational",
        merchant_or_concept: `${split.merchant_name} (Esenciales: ${split.essential_items_summary})`,
        idempotency_key: baseIdemKey ? `${baseIdemKey}:ops` : undefined,
      });
    }

    // 2. Registra la parte de antojos no presupuestados (Aplica 1.2x o Escudo Aegis)
    let discretionaryImpact = null;
    if (split.discretionary_unbudgeted_cop > 0) {
      discretionaryImpact = store.recordTransaction({
        amount_cop: split.discretionary_unbudgeted_cop,
        category: "discretionary_unbudgeted",
        merchant_or_concept: `${split.merchant_name} (Antojos: ${split.unbudgeted_items_summary})`,
        use_aegis_shield: body.use_aegis_shield ?? false,
        idempotency_key: baseIdemKey ? `${baseIdemKey}:disc` : undefined,
      });
    }

    return NextResponse.json(
      {
        success: true,
        mode: "local_engine",
        receipt_analysis: split,
        operational_impact: operationalImpact,
        discretionary_impact: discretionaryImpact,
        treasury_snapshot: {
          wallet_gp: store.wallet_gp,
          vault_remaining_gp: store.vault_remaining_gp,
          aegis_shields: store.aegis_shields,
        },
        shortcut_tts_message: `Factura de ${split.merchant_name} dividida con éxito. ${split.operational_essential_cop.toLocaleString("es-CO")} pesos fueron a mercado operativo sin multa, y ${split.discretionary_unbudgeted_cop.toLocaleString("es-CO")} pesos se detectaron como antojos.`,
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
