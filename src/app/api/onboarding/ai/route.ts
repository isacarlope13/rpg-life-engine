import { NextResponse } from "next/server";
import { isDisplayNameAvailable, resolveAuthenticatedUser } from "@/lib/auth";
import { checkAiQuotaAllowance } from "@/lib/ai-cache-and-ratelimit";
import {
  evaluateFinancesWithAI,
  planQuestsAndRewardsWithAI,
  resolveProfessionClasses,
} from "@/lib/onboarding-ai";
import type {
  CurrencyCode,
  FixedCostItem,
  OnboardingBossInput,
  UserSkillConfig,
} from "@/types/rpg";

export async function POST(req: Request) {
  const session = await resolveAuthenticatedUser(req);
  if (!session) {
    return NextResponse.json(
      { error: "No autenticado. Inicia sesión para usar el asistente IA." },
      { status: 401 }
    );
  }

  const rateKey = `onboarding:${session.userId}`;
  if (!checkAiQuotaAllowance(rateKey).allowed) {
    return NextResponse.json(
      {
        error:
          "Has alcanzado el límite de consultas por minuto. Espera unos segundos e intenta de nuevo.",
      },
      { status: 429 }
    );
  }
  const body = (await req.json().catch(() => ({}))) as {
    action?:
      | "check_name"
      | "profession_classes"
      | "analyze_finances"
      | "plan_quests_rewards";
    display_name?: string;
    profession?: string;
    character_class?: string;
    raw_text?: string;
    currency?: CurrencyCode;
    monthly_income?: number;
    vault_cap?: number;
    fixed_costs?: FixedCostItem[];
    bosses?: OnboardingBossInput[];
    skills?: UserSkillConfig[];
  };

  if (body.action === "check_name") {
    const name = (body.display_name || "").trim();
    if (name.length < 2) {
      return NextResponse.json({
        available: false,
        reason: "El nombre de aventurero debe tener al menos 2 caracteres.",
      });
    }
    const available = await isDisplayNameAvailable(name, session?.userId);
    return NextResponse.json({
      available,
      reason: available
        ? "Nombre de aventurero disponible."
        : "Ese nombre de aventurero ya está en uso por otro jugador.",
    });
  }

  if (body.action === "profession_classes") {
    const result = await resolveProfessionClasses(body.profession || "");
    return NextResponse.json(result);
  }

  if (body.action === "analyze_finances") {
    const text = (body.raw_text || "").trim();
    if (!text) {
      return NextResponse.json(
        { error: "Escribe una descripción o pega una tabla con tus finanzas." },
        { status: 400 }
      );
    }
    const evaluation = await evaluateFinancesWithAI({
      rawTextOrTable: text,
      currency: body.currency || "COP",
    });
    return NextResponse.json(evaluation);
  }

  if (body.action === "plan_quests_rewards") {
    const plan = await planQuestsAndRewardsWithAI({
      profession: body.profession || "Estudiante / Explorador",
      character_class: body.character_class || "Paladín Financiero",
      currency: body.currency || "COP",
      monthly_income: Number(body.monthly_income) || 2300000,
      vault_cap: Number(body.vault_cap) || 400000,
      fixed_costs: Array.isArray(body.fixed_costs) ? body.fixed_costs : [],
      bosses: Array.isArray(body.bosses) ? body.bosses : [],
      skills: Array.isArray(body.skills) ? body.skills : [],
    });
    return NextResponse.json(plan);
  }

  return NextResponse.json({ error: "Acción no reconocida." }, { status: 400 });
}
