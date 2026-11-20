import { NextResponse } from "next/server";
import {
  getUserStore,
  isDisplayNameAvailable,
  resolveAuthenticatedUser,
  updateLocalUserProfile,
} from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import {
  persistOnboardingSafely,
  type ExtendedOnboardingInput,
} from "@/lib/onboarding/onboarding-persistence";

/**
 * GET /api/onboarding
 * Permite verificar disponibilidad de nombre de aventurero (solo lectura)
 * y consultar si el usuario ya completó el onboarding (modo creación vs edición).
 */
export async function GET(req: Request) {
  const session = await resolveAuthenticatedUser(req);
  if (!session) {
    return NextResponse.json(
      { error: "No autenticado", code: "UNAUTHENTICATED" },
      { status: 401 }
    );
  }

  const url = new URL(req.url);
  const checkName = url.searchParams.get("check_name")?.trim();
  if (checkName) {
    if (checkName.length < 2) {
      return NextResponse.json({
        available: false,
        reason: "Debe tener al menos 2 caracteres.",
      });
    }
    const available = await isDisplayNameAvailable(checkName, session.userId);
    return NextResponse.json({
      available,
      reason: available ? "Disponible" : `El nombre "${checkName}" ya está en uso.`,
    });
  }

  let hasExistingTreasury = false;
  if (session.mode === "supabase") {
    const db = session.userClient || supabaseAdmin;
    if (db) {
      const billingPeriod = new Date().toISOString().slice(0, 7);
      const { data } = await db
        .from("player_treasury")
        .select("player_level,wallet_gp,current_xp,monthly_income_cop")
        .eq("user_id", session.userId)
        .eq("billing_period", billingPeriod)
        .maybeSingle();
      hasExistingTreasury = Boolean(data);
    }
  }

  return NextResponse.json({
    ok: true,
    onboardingMode: hasExistingTreasury ? "edit" : "initial",
    display_name: session.displayName,
    character_class: session.characterClass,
  });
}

/**
 * POST /api/onboarding
 * Idempotente y no destructivo:
 * - Nunca reinicia wallet_gp, player_level, current_xp ni rachas en usuarios existentes.
 * - No ejecuta borrados masivos ciegos sin confirmación explícita confirm_destructive_replace.
 * - Reporta errores parciales sin silenciar fallos.
 */
export async function POST(req: Request) {
  const session = await resolveAuthenticatedUser(req);
  if (!session) {
    return NextResponse.json(
      { error: "No autenticado", code: "UNAUTHENTICATED" },
      { status: 401 }
    );
  }

  const body = (await req.json().catch(() => null)) as ExtendedOnboardingInput | null;
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

  const monthlyIncome = Math.max(0, Math.round(Number(body.monthly_income) || 0));
  const fixedCosts = Array.isArray(body.fixed_costs) ? body.fixed_costs : [];
  const totalFixed = fixedCosts.reduce(
    (acc, fc) => acc + Math.max(0, Math.round(Number(fc.amount) || 0)),
    0
  );
  const variableOps = Math.max(0, Math.round(Number(body.variable_ops_budget) || 0));
  const vaultCap = Math.max(0, Math.round(Number(body.vault_cap) || 0));

  if (monthlyIncome > 0 && monthlyIncome - totalFixed - variableOps - vaultCap < 0) {
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
          "Debes autorizar expresamente la Política de Tratamiento de Datos Personales para guardar tu configuración.",
      },
      { status: 400 }
    );
  }

  // 1. Actualizar espejo en memoria preservando progreso previo si existe
  const userStore = getUserStore(session.userId);
  const prevWalletGp = userStore.wallet_gp;
  const prevLevel = userStore.player_level;
  const prevXp = userStore.current_xp;
  const prevStreak = userStore.current_streak_days;
  const hadProgress = prevWalletGp > 0 || prevLevel > 1 || prevXp > 0 || prevStreak > 0;

  userStore.applyOnboarding(body);
  if (hadProgress) {
    userStore.wallet_gp = prevWalletGp;
    userStore.player_level = prevLevel;
    userStore.current_xp = prevXp;
    userStore.current_streak_days = prevStreak;
  }

  updateLocalUserProfile(session.userId, {
    display_name: cleanName,
    character_class: body.character_class?.trim() || session.characterClass,
    avatar_url: body.avatar_url ?? session.avatarUrl,
    data_privacy_accepted: true,
    privacy_accepted_at: body.privacy_accepted_at || new Date().toISOString(),
    privacy_version: body.privacy_version || "3.4",
  });

  // 2. Si está en modo Supabase, persistir de forma idempotente y no destructiva
  if (session.mode === "supabase") {
    const db = session.userClient || supabaseAdmin;
    if (db) {
      const persistence = await persistOnboardingSafely({
        db,
        userId: session.userId,
        email: session.email,
        fallbackCharacterClass: session.characterClass,
        fallbackAvatarUrl: session.avatarUrl,
        body,
        cleanName,
        monthlyIncome,
        totalFixed,
        variableOps,
        vaultCap,
      });

      return NextResponse.json(
        {
          ok: persistence.ok,
          onboardingMode: persistence.onboardingMode,
          preservedProgress: persistence.preservedProgress,
          partialErrors: persistence.partialErrors,
          sections: persistence.sections,
        },
        { status: persistence.ok ? 200 : 207 }
      );
    }
  }

  return NextResponse.json({
    ok: true,
    onboardingMode: hadProgress ? "edit" : "initial",
    preservedProgress: hadProgress,
    partialErrors: [],
  });
}
