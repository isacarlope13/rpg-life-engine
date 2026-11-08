import { NextResponse } from "next/server";
import {
  getUserStore,
  isDisplayNameAvailable,
  resolveAuthenticatedUser,
  updateLocalUserProfile,
} from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import type { OnboardingPayload } from "@/types/rpg";

export async function POST(req: Request) {
  const session = await resolveAuthenticatedUser(req);
  if (!session) {
    return NextResponse.json(
      { error: "No autenticado", code: "UNAUTHENTICATED" },
      { status: 401 }
    );
  }

  const body = (await req.json().catch(() => null)) as OnboardingPayload | null;
  if (!body) {
    return NextResponse.json(
      { error: "Datos de onboarding inválidos." },
      { status: 400 }
    );
  }

  const cleanName = (body.display_name || "").trim();
  if (cleanName.length < 2) {
    return NextResponse.json(
      { error: "El nombre del aventurero debe tener al menos 2 caracteres." },
      { status: 400 }
    );
  }

  // Verificar unicidad del nombre de aventurero en la base de datos (excluyendo al propio usuario)
  const nameAvailable = await isDisplayNameAvailable(cleanName, session.userId);
  if (!nameAvailable) {
    return NextResponse.json(
      {
        error: `El nombre de aventurero "${cleanName}" ya está registrado por otro jugador. Por favor elige uno único.`,
        code: "DUPLICATE_DISPLAY_NAME",
      },
      { status: 409 }
    );
  }

  const monthlyIncome = Math.round(Number(body.monthly_income) || 0);
  const fixedCosts = Array.isArray(body.fixed_costs) ? body.fixed_costs : [];
  const totalFixed = fixedCosts.reduce(
    (acc, fc) => acc + Math.max(0, Math.round(Number(fc.amount) || 0)),
    0
  );
  const variableOps = Math.max(
    0,
    Math.round(Number(body.variable_ops_budget) || 0)
  );
  const vaultCap = Math.max(0, Math.round(Number(body.vault_cap) || 0));

  if (monthlyIncome <= 0) {
    return NextResponse.json(
      { error: "El ingreso mensual debe ser mayor a 0." },
      { status: 400 }
    );
  }

  if (fixedCosts.length === 0) {
    return NextResponse.json(
      { error: "Agrega al menos un costo fijo (ej. arriendo, servicios)." },
      { status: 400 }
    );
  }

  if (monthlyIncome - totalFixed - variableOps - vaultCap < 0) {
    return NextResponse.json(
      {
        error:
          "La suma de costos fijos, variables operativos y bóveda supera tu ingreso mensual.",
      },
      { status: 400 }
    );
  }

  if (!Array.isArray(body.skills) || body.skills.length === 0) {
    return NextResponse.json(
      { error: "Selecciona al menos 1 habilidad o hábito para tu Santuario." },
      { status: 400 }
    );
  }

  if (body.data_privacy_accepted !== true) {
    return NextResponse.json(
      {
        error:
          "Debes autorizar expresamente la Política de Tratamiento de Datos Personales y sus posibles cambios y mejoras para crear tu partida.",
      },
      { status: 400 }
    );
  }

  // 1. Actualizar siempre el espejo en memoria del usuario
  const userStore = getUserStore(session.userId);
  userStore.applyOnboarding(body);

  updateLocalUserProfile(session.userId, {
    display_name: cleanName,
    character_class: body.character_class?.trim() || session.characterClass,
    avatar_url: body.avatar_url ?? session.avatarUrl,
    data_privacy_accepted: true,
    privacy_accepted_at: body.privacy_accepted_at || new Date().toISOString(),
    privacy_version: body.privacy_version || "3.4",
  });

  // 2. Si está en modo Supabase, persistir en las tablas del usuario
  if (session.mode === "supabase") {
    const db = session.userClient || supabaseAdmin;
    if (db) {
      const userId = session.userId;
      const billingPeriod = new Date().toISOString().slice(0, 7);

      // Perfil extendido con profesión y nombre único
      try {
        const { error: profErr } = await db.from("profiles").upsert(
          {
            id: userId,
            email: session.email,
            display_name: cleanName,
            profession:
              body.profession?.trim() || "Estudiante / Explorador",
            character_class:
              body.character_class?.trim() || session.characterClass,
            avatar_url: body.avatar_url ?? session.avatarUrl,
            currency: body.currency || "COP",
            timezone: body.timezone || "America/Bogota",
            pay_frequency: body.pay_frequency || "monthly",
            pay_day: Math.min(31, Math.max(1, Math.round(body.pay_day || 1))),
            savings_goal_monthly: Math.max(
              0,
              Math.round(Number(body.savings_goal_monthly) || 0)
            ),
            main_goal: body.main_goal?.trim() || null,
            goal_deadline: body.goal_deadline?.trim() || null,
            onboarding_completed: true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" }
        );
        if (profErr) {
          await db.from("profiles").upsert(
            {
              id: userId,
              email: session.email,
              display_name: cleanName,
              character_class:
                body.character_class?.trim() || session.characterClass,
              avatar_url: body.avatar_url ?? session.avatarUrl,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "id" }
          );
        }
      } catch {
        // Ignorar si profiles no existe aún
      }

      // Tesorería mensual del jugador
      await db.from("player_treasury").upsert(
        {
          user_id: userId,
          billing_period: billingPeriod,
          monthly_income_cop: monthlyIncome,
          fixed_costs_budget_cop: totalFixed,
          fixed_costs_spent_cop: 0,
          variable_ops_budget_cop: variableOps,
          variable_ops_spent_cop: 0,
          vault_cap_gp: Math.max(10000, vaultCap),
          vault_remaining_gp: Math.max(10000, vaultCap),
          wallet_gp: 0,
          total_penalty_gp: 0,
          debt_strategy:
            body.debt_strategy === "avalanche" ? "avalanche" : "snowball",
          player_level: 1,
          current_xp: 0,
          current_streak_days: 0,
          streak_multiplier: 1.0,
          aegis_shields: 1,
        },
        { onConflict: "user_id,billing_period" }
      );

      // Costos fijos desglosados
      try {
        await db.from("fixed_costs").delete().eq("user_id", userId);
        await db.from("fixed_costs").insert(
          fixedCosts.map((fc, idx) => ({
            user_id: userId,
            name: fc.name.trim() || `Costo Fijo ${idx + 1}`,
            amount: Math.max(0, Math.round(Number(fc.amount) || 0)),
            category: fc.category || "hogar",
          }))
        );
      } catch {
        // Ignorar si fixed_costs aún no existe
      }

      // Deudas (Bosses)
      await db.from("debt_bosses").delete().eq("user_id", userId);
      const validBosses = (body.bosses || []).filter(
        (b) => b.name && Number(b.total_balance) > 0
      );
      if (validBosses.length > 0) {
        const { data: insertedBosses } = await db
          .from("debt_bosses")
          .insert(
            validBosses.map((b, idx) => {
              const bal = Math.round(Number(b.total_balance));
              return {
                user_id: userId,
                name: b.name.trim(),
                max_hp: bal,
                current_hp: bal,
                interest_rate_ea: Math.max(0, Number(b.interest_rate_ea) || 0),
                min_monthly_payment_cop: Math.max(
                  0,
                  Math.round(Number(b.min_monthly_payment) || 0)
                ),
                paid_this_month_cop: 0,
                priority_order: idx + 1,
                status: "active",
              };
            })
          )
          .select("*");

        if (insertedBosses && insertedBosses.length > 0) {
          userStore.bosses = insertedBosses.map((b) => ({
            id: String(b.id),
            name: String(b.name),
            max_hp: Number(b.max_hp),
            current_hp: Number(b.current_hp),
            interest_rate_ea: Number(b.interest_rate_ea),
            min_monthly_payment_cop: Number(b.min_monthly_payment_cop),
            paid_this_month_cop: Number(b.paid_this_month_cop),
            priority_order: Number(b.priority_order),
            status: b.status,
          }));
        }
      }

      // Habilidades elegidas por el usuario
      try {
        await db.from("user_skills").delete().eq("user_id", userId);
        await db.from("user_skills").insert(
          body.skills.map((s) => ({
            user_id: userId,
            domain: s.domain,
            label: s.label,
            weekly_target_minutes: Math.max(
              15,
              Math.round(Number(s.weekly_target_minutes) || 120)
            ),
            preferred_session_time: s.preferred_session_time || "noche",
            custom_description: s.custom_description || null,
          }))
        );
      } catch {
        // Ignorar si user_skills aún no existe
      }

      // Propuesta de nueva habilidad (buzón de evolución del Santuario)
      if (body.custom_skill_suggestion?.skill_name?.trim()) {
        try {
          await db.from("skill_suggestions").insert({
            user_id: userId,
            skill_name: body.custom_skill_suggestion.skill_name.trim(),
            tracking_idea:
              body.custom_skill_suggestion.tracking_idea?.trim() || "",
            weekly_target_minutes: Math.max(
              15,
              Math.round(
                Number(body.custom_skill_suggestion.weekly_target_minutes) ||
                  120
              )
            ),
          });
        } catch {
          // Ignorar si skill_suggestions aún no existe
        }
      }

      // Misiones iniciales (Quests) generadas o personalizadas en el Paso 5
      const validQuests = (body.quests || []).filter(
        (q) => q.title && Number(q.reward_gp) > 0
      );
      if (validQuests.length > 0) {
        try {
          await db.from("quest_catalog").delete().eq("user_id", userId);
          await db.from("quest_catalog").insert(
            validQuests.map((q, idx) => ({
              user_id: userId,
              code: (q.code || `QUEST_${idx + 1}`).slice(0, 50),
              title: q.title.trim().slice(0, 150),
              domain: ["rubik", "reading", "knitting", "study", "work", "general"].includes(
                q.domain
              )
                ? q.domain
                : "general",
              difficulty: q.difficulty || "medium",
              reward_gp: Math.max(1, Math.round(Number(q.reward_gp))),
              reward_xp: Math.max(10, Math.round(Number(q.reward_xp) || 85)),
              daily_limit: 1,
              is_active: true,
            }))
          );
        } catch {
          // Ignorar si hay restricción de enum en BD previa a la migración
        }
      }

      // Wishlist / Tienda de recompensas
      const validWishes = (body.wishlist || []).filter(
        (w) => w.name && Number(w.cost_gp) > 0
      );
      if (validWishes.length > 0) {
        await db.from("wishlist_items").delete().eq("user_id", userId);
        await db.from("wishlist_items").insert(
          validWishes.map((w, idx) => ({
            user_id: userId,
            name: w.name.trim(),
            cost_gp: Math.max(1, Math.round(Number(w.cost_gp))),
            priority: Math.min(
              5,
              Math.max(1, Math.round(Number(w.priority) || idx + 1))
            ),
            is_redeemed: false,
          }))
        );
      }
    }
  }

  return NextResponse.json({ ok: true });
}
