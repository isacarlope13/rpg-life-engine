import { NextResponse } from "next/server";
import { HabitLogShortcutRequest } from "@/types/rpg";
import { isSupabaseConfigured, resolvePlayerTreasury } from "@/lib/supabase";
import { requireShortcutUser, scopeIdempotencyKey } from "@/lib/request-auth";

export async function POST(req: Request) {
  try {
    const authCtx = await requireShortcutUser(req);
    if (!authCtx.ok) return authCtx.response;
    const { userId, store, db } = authCtx;

    const body = (await req.json()) as HabitLogShortcutRequest;

    // Si viene session_payload o session_domain especializado en modo local, delega a logSkillSession
    if (!isSupabaseConfigured && body.session_domain && body.session_payload) {
      const skillRes = store.logSkillSession({
        domain: body.session_domain,
        duration_minutes: body.session_payload.duration_minutes || 25,
        title: body.custom_activity?.title,
        notes: body.notes,
        idempotency_key: body.idempotency_key,
        ...body.session_payload,
      });

      return NextResponse.json(
        {
          success: true,
          mode: "local_engine",
          activity_log_id: skillRes.session.id,
          quest_completed: {
            code: body.quest_code || `SKILL_${body.session_domain.toUpperCase()}`,
            title: skillRes.session.title,
            domain: body.session_domain,
            streak_multiplier_applied:
              skillRes.reward_impact.streak_multiplier_applied,
            transferred_gp: skillRes.reward_impact.transferred_gp,
            shield_earned: skillRes.reward_impact.shield_earned,
            vault_capped: skillRes.reward_impact.vault_capped,
            earned_xp: skillRes.session.xp_earned,
          },
          player_progress: {
            player_level: store.player_level,
            current_xp: store.current_xp,
            current_streak_days: store.current_streak_days,
            streak_multiplier: store.streak_multiplier,
            aegis_shields: store.aegis_shields,
            leveled_up: skillRes.reward_impact.leveled_up,
          },
          treasury_snapshot: {
            billing_period: store.billing_period,
            wallet_gp: store.wallet_gp,
            vault_remaining_gp: store.vault_remaining_gp,
          },
          shortcut_tts_message: `¡Sesión completada! ${skillRes.session.title}. Has liberado ${skillRes.reward_impact.transferred_gp.toLocaleString("es-CO")} GP de la Bóveda.`,
        },
        { status: 201 }
      );
    }

    const questCatalogMatch = store.quests.find(
      (q) => q.code === body.quest_code
    );

    const questTitle =
      questCatalogMatch?.title ||
      body.custom_activity?.title ||
      "Misión Productiva";
    const questDomain =
      questCatalogMatch?.domain || body.session_domain || "general";
    const requestedGp =
      questCatalogMatch?.reward_gp ?? body.custom_activity?.requested_gp ?? 3000;
    const earnedXp =
      questCatalogMatch?.reward_xp ?? body.custom_activity?.earned_xp ?? 50;

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

      const { data: activity, error: actErr } = await db
        .from("activity_logs")
        .insert({
          user_id: userId,
          treasury_id: treasury.id,
          domain: questDomain,
          activity_name: questTitle,
          requested_gp: requestedGp,
          earned_xp: earnedXp,
          notes: body.notes || null,
          idempotency_key: scopeIdempotencyKey(userId, body.idempotency_key),
        })
        .select("*")
        .single();

      if (actErr) {
        // Manejo idempotente de duplicados (colisión de clave idempotente en base de datos)
        if (
          actErr.code === "23505" ||
          actErr.message?.toLowerCase().includes("unique") ||
          actErr.message?.toLowerCase().includes("duplicate")
        ) {
          const scopedKey = scopeIdempotencyKey(userId, body.idempotency_key);
          const { data: existingAct } = await db
            .from("activity_logs")
            .select("*")
            .eq("idempotency_key", scopedKey)
            .maybeSingle();

          if (existingAct) {
            return NextResponse.json(
              {
                success: true,
                mode: "supabase_idempotent_replay",
                activity_log_id: existingAct.id,
                quest_completed: {
                  code: body.quest_code || "CUSTOM",
                  title: existingAct.activity_name,
                  domain: existingAct.domain,
                  transferred_gp: existingAct.requested_gp,
                  earned_xp: existingAct.earned_xp,
                },
                shortcut_tts_message: `Hábito ya registrado previamente: ${existingAct.activity_name}.`,
              },
              { status: 200 }
            );
          }
        }

        return NextResponse.json(
          { success: false, error: actErr.message },
          { status: 500 }
        );
      }

      const { data: updatedTreasury } = await db
        .from("player_treasury")
        .select("*")
        .eq("id", treasury.id)
        .maybeSingle();

      const finalTreasury = updatedTreasury || treasury;

      return NextResponse.json(
        {
          success: true,
          mode: "supabase",
          activity_log_id: activity.id,
          quest_completed: {
            code: body.quest_code || "CUSTOM",
            title: questTitle,
            domain: questDomain,
            base_gp: requestedGp,
            streak_multiplier_applied: activity.streak_multiplier_applied,
            transferred_gp: activity.transferred_gp,
            shield_earned: activity.shield_earned,
            earned_xp: earnedXp,
          },
          player_progress: {
            player_level: finalTreasury.player_level,
            current_xp: finalTreasury.current_xp,
            current_streak_days: finalTreasury.current_streak_days,
            aegis_shields: finalTreasury.aegis_shields,
            leveled_up: finalTreasury.player_level > treasury.player_level,
          },
          treasury_snapshot: {
            billing_period: finalTreasury.billing_period,
            wallet_gp: finalTreasury.wallet_gp,
            vault_remaining_gp: finalTreasury.vault_remaining_gp,
          },
          shortcut_tts_message: `¡Misión completada con racha de ${finalTreasury.current_streak_days} días! Multiplicador ${activity.streak_multiplier_applied}x aplicado. Liberaste ${Number(activity.transferred_gp).toLocaleString("es-CO")} GP a tu Billetera.`,
        },
        { status: 201 }
      );
    }

    const result = store.completeActivity({
      code: body.quest_code || "CUSTOM",
      title: questTitle,
      domain: questDomain,
      requested_gp: requestedGp,
      earned_xp: earnedXp,
      idempotency_key: body.idempotency_key,
    });

    const unlockPct = Number(
      (
        ((store.vault_cap_gp - store.vault_remaining_gp) /
          store.vault_cap_gp) *
        100
      ).toFixed(1)
    );

    return NextResponse.json(
      {
        success: true,
        mode: "local_engine",
        activity_log_id: crypto.randomUUID(),
        quest_completed: {
          code: body.quest_code || "CUSTOM",
          title: questTitle,
          domain: questDomain,
          base_gp: requestedGp,
          streak_multiplier_applied: result.streak_multiplier_applied,
          transferred_gp: result.transferred_gp,
          shield_earned: result.shield_earned,
          vault_capped: result.vault_capped,
          idempotent_replay: result.idempotent_replay,
          earned_xp: earnedXp,
        },
        player_progress: {
          player_level: store.player_level,
          current_xp: store.current_xp,
          current_streak_days: store.current_streak_days,
          streak_multiplier: store.streak_multiplier,
          aegis_shields: store.aegis_shields,
          leveled_up: result.leveled_up,
        },
        treasury_snapshot: {
          billing_period: store.billing_period,
          wallet_gp: store.wallet_gp,
          vault_remaining_gp: store.vault_remaining_gp,
          vault_unlock_percentage: unlockPct,
        },
        shortcut_tts_message: `¡Misión completada! Racha de ${store.current_streak_days} días activa (${result.streak_multiplier_applied}x). Has liberado ${result.transferred_gp.toLocaleString("es-CO")} GP de la Bóveda.${
          result.shield_earned
            ? " ¡Ganaste 1 Escudo Aegis por tu racha de 7 días!"
            : ""
        }`,
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
