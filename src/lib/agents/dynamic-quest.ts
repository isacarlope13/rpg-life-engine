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
  projectName?: string;
}

export interface AdaptiveProjectContext {
  projectName?: string;
  currentUnit?: string;
  targetUnits?: number;
}

/**
 * DynamicQuestGenerator & RewardOptimizer:
 * Forja misiones adaptativas personalizadas para reactivar habilidades estancadas
 * y calibra las recompensas de XP y GP para preservar el equilibrio económico del juego.
 * En OakHaven 4.4 integra contexto de proyectos reales (libros, tejidos, sprints)
 * y garantiza la estricta exclusión de habilidades pausadas o archivadas.
 */
export class DynamicQuestGenerator {
  private guardian: SystemGuardian;
  public static readonly MAX_AUTONOMOUS_GP = 4000;

  constructor(guardian: SystemGuardian = defaultSystemGuardian) {
    this.guardian = guardian;
  }

  /**
   * Genera una misión adaptativa basada en un dominio estancado o meta activa,
   * integrando opcionalmente el contexto del proyecto activo y fecha determinista para evitar duplicados.
   */
  public generateAdaptiveQuest(params: {
    domain: SkillDomain;
    domainLabel: string;
    daysInactive: number;
    playerLevel: number;
    projectContext?: AdaptiveProjectContext;
    dateKey?: string;
  }): DynamicQuestTemplate {
    const dateSuffix = params.dateKey
      ? params.dateKey.replace(/[^a-zA-Z0-9]/g, "")
      : Date.now().toString(36).toUpperCase();
    const code = `DYN_${params.domain.toUpperCase()}_${dateSuffix}`;

    let name = `Reactivación: Sesión de ${params.domainLabel}`;
    let description = `Dedica 25 minutos conscientes a ${params.domainLabel} para reactivar tu progreso y mantener tu nivel.`;
    let difficulty: "easy" | "medium" | "hard" = "easy";
    let baseGp = 2500;
    let baseXp = 60;
    const projectName = params.projectContext?.projectName;

    if (params.domain === "rubik") {
      name = "Enfoque WCA: Promedio Ao5 sin Penalizaciones";
      description = "Realiza 5 solves consecutivos con scramble oficial WCA manteniendo consistencia.";
      difficulty = "medium";
      baseGp = 3200;
      baseXp = 75;
    } else if (params.domain === "reading") {
      if (projectName) {
        name = `Lectura Activa: ${projectName}`;
        description = `Lee al menos 20 páginas de "${projectName}" y registra una cita o reflexión clave con Eldrin.`;
      } else {
        name = "Inmersión Literaria: Sprint de 25 Páginas";
        description = "Lee 25 páginas en tu libro activo y captura al menos una cita o idea clave.";
      }
      difficulty = "medium";
      baseGp = 3500;
      baseXp = 80;
    } else if (params.domain === "knitting") {
      if (projectName) {
        name = `Tejido Creativo: Vueltas en ${projectName}`;
        description = `Avanza en tu proyecto activo "${projectName}" y registra tus vueltas en el bastidor de Clara.`;
      } else {
        name = `Santuario Zen: 30 min de ${params.domainLabel}`;
        description = `Desconecta de pantallas y practica ${params.domainLabel} como descanso activo y libre de culpa.`;
      }
      difficulty = "easy";
      baseGp = 3000;
      baseXp = 70;
    } else if (params.domain === "work") {
      if (projectName) {
        name = `Sprint de Foco: ${projectName}`;
        description = `Completa un bloque de trabajo profundo enfocado en "${projectName}" sin distracciones bajo la guía de Aura.`;
      } else {
        name = "Sprint Pomodoro de 25 min";
        description = "Completa un bloque de trabajo profundo sin multitarea con temporizador respetuoso.";
      }
      difficulty = "medium";
      baseGp = 3000;
      baseXp = 75;
    } else if (params.domain === "sports") {
      name = "Entrenamiento de Fuerza & Control RPE";
      description = "Completa tu sesión de series con Bruno registrando pesos y respetando tiempos de descanso.";
      difficulty = "medium";
      baseGp = 2800;
      baseXp = 70;
    } else if (params.domain === "gardening") {
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
      projectName,
    };
  }

  /**
   * Genera misiones adaptativas filtradas exclusivamente por las habilidades activas del usuario (OakHaven 4.0).
   * Excluye habilidades pausadas o archivadas para no saturar al usuario ni inducir culpa.
   * Acepta un mapa opcional de proyectos activos por dominio.
   */
  public generateActiveSkillsQuests(params: {
    activeDomains: SkillDomain[];
    domainLabels: Partial<Record<SkillDomain, string>>;
    playerLevel: number;
    projectContexts?: Partial<Record<SkillDomain, AdaptiveProjectContext>>;
    dateKey?: string;
  }): DynamicQuestTemplate[] {
    return params.activeDomains.map((dom) => {
      const label = params.domainLabels[dom] || dom;
      const projectCtx = params.projectContexts ? params.projectContexts[dom] : undefined;
      return this.generateAdaptiveQuest({
        domain: dom,
        domainLabel: label,
        daysInactive: 1,
        playerLevel: params.playerLevel,
        projectContext: projectCtx,
        dateKey: params.dateKey,
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
