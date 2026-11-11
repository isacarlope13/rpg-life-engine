import type { SkillDomain } from "../../types/rpg.ts";
import { defaultSystemGuardian, SystemGuardian } from "./system-guardian.ts";
import type { AgentExecutionOutcome } from "./types.ts";

export interface DynamicQuestTemplate {
  code: string;
  name: string;
  description: string;
  domain: SkillDomain;
  difficulty: "easy" | "medium" | "hard";
  rewardGp: number;
  rewardXp: number;
  dailyLimit: number;
}

/**
 * DynamicQuestGenerator & RewardOptimizer:
 * Forja misiones adaptativas personalizadas para reactivar habilidades estancadas
 * y calibra las recompensas de XP y GP para preservar el equilibrio económico del juego.
 */
export class DynamicQuestGenerator {
  private guardian: SystemGuardian;
  public static readonly MAX_AUTONOMOUS_GP = 4000;

  constructor(guardian: SystemGuardian = defaultSystemGuardian) {
    this.guardian = guardian;
  }

  /**
   * Genera una misión adaptativa basada en un dominio estancado o meta activa.
   */
  public generateAdaptiveQuest(params: {
    domain: SkillDomain;
    domainLabel: string;
    daysInactive: number;
    playerLevel: number;
  }): DynamicQuestTemplate {
    const code = `DYN_${params.domain.toUpperCase()}_${Date.now().toString(36).toUpperCase()}`;

    let name = `Reactivación: Sesión de ${params.domainLabel}`;
    let description = `Dedica 25 minutos conscientes a ${params.domainLabel} para reactivar tu progreso y mantener tu nivel.`;
    let difficulty: "easy" | "medium" | "hard" = "easy";
    let baseGp = 2500;
    let baseXp = 60;

    if (params.domain === "rubik") {
      name = "Enfoque WCA: Promedio Ao5 sin Penalizaciones";
      description = "Realiza 5 solves consecutivos con scramble oficial WCA manteniendo consistencia.";
      difficulty = "medium";
      baseGp = 3200;
      baseXp = 75;
    } else if (params.domain === "reading") {
      name = "Inmersión Literaria: Sprint de 25 Páginas";
      description = "Lee 25 páginas en tu libro activo y captura al menos una cita o idea clave.";
      difficulty = "medium";
      baseGp = 3500;
      baseXp = 80;
    } else if (params.domain === "gardening" || params.domain === "knitting") {
      name = `Santuario Zen: 30 min de ${params.domainLabel}`;
      description = `Desconecta de pantallas y practica ${params.domainLabel} como descanso activo y libre de culpa.`;
      difficulty = "easy";
      baseGp = 3000;
      baseXp = 70;
    }

    // Escalamiento por nivel controlado (Reward Optimizer)
    const levelBonusGp = Math.min(800, params.playerLevel * 50);
    const rewardGp = Math.min(
      DynamicQuestGenerator.MAX_AUTONOMOUS_GP,
      baseGp + levelBonusGp
    );

    return {
      code,
      name,
      description,
      domain: params.domain,
      difficulty,
      rewardGp,
      rewardXp: baseXp + Math.min(40, params.playerLevel * 5),
      dailyLimit: 1,
    };
  }

  /**
   * Genera misiones adaptativas filtradas exclusivamente por las habilidades activas del usuario (OakHaven 4.0).
   * Excluye habilidades pausadas o archivadas para no saturar al usuario.
   */
  public generateActiveSkillsQuests(params: {
    activeDomains: SkillDomain[];
    domainLabels: Partial<Record<SkillDomain, string>>;
    playerLevel: number;
  }): DynamicQuestTemplate[] {
    return params.activeDomains.map((dom) => {
      const label = params.domainLabels[dom] || dom;
      return this.generateAdaptiveQuest({
        domain: dom,
        domainLabel: label,
        daysInactive: 1,
        playerLevel: params.playerLevel,
      });
    });
  }

  /**
   * Propone la inyección de la misión en el catálogo a través del SystemGuardian.
   */
  public async proposeQuestDeployment(params: {
    userId: string;
    quest: DynamicQuestTemplate;
    mutationExecutor: () => Promise<Record<string, unknown>>;
  }): Promise<AgentExecutionOutcome> {
    return this.guardian.interceptAndEnforce(
      {
        agentCode: "dynamic_quest_generator",
        userId: params.userId,
        category: "quest_override",
        actionName: "deploy_dynamic_quest",
        rationale: `Misión adaptativa generada para reactivar ${params.quest.domain} con recompensa calibrada de ${params.quest.rewardGp} GP.`,
        payload: {
          code: params.quest.code,
          name: params.quest.name,
          reward_gp: params.quest.rewardGp,
          reward_xp: params.quest.rewardXp,
          domain: params.quest.domain,
        },
      },
      params.mutationExecutor
    );
  }
}

export const defaultDynamicQuestGenerator = new DynamicQuestGenerator();
