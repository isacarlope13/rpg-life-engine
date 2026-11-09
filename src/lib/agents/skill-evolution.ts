import type {
  ReadingBook,
  RubikSolveEntry,
  SkillDomain,
  SpacedRepetitionCard,
  UserSkillConfig,
} from "../../types/rpg.ts";

export interface RubikMasteryReport {
  totalSolves: number;
  personalBestSeconds: number | null;
  currentAo5: number | null;
  currentAo12: number | null;
  speedcubingMilestone: "Novato" | "Sub-30" | "Sub-20" | "Sub-15" | "Sub-12" | "Sub-10";
}

export interface ReadingMasteryReport {
  activeBooksCount: number;
  completedBooksCount: number;
  totalPagesRead: number;
  averagePagesPerSession: number;
  estimatedPagesPerHour: number;
}

export interface SpacedRepetitionReport {
  totalCards: number;
  masteredCards: number;
  retentionRatePercent: number;
  averageEaseFactor: number;
}

export interface StagnantDomainAlert {
  domain: SkillDomain;
  label: string;
  daysInactive: number;
  weeklyTargetMinutes: number;
  recommendation: string;
}

export interface SkillEvolutionAudit {
  rubikReport?: RubikMasteryReport;
  readingReport?: ReadingMasteryReport;
  spacedRepetitionReport?: SpacedRepetitionReport;
  stagnantDomains: StagnantDomainAlert[];
  overallMasteryIndex: number; // 0 - 100
}

/**
 * SkillEvolutionAgent: Agente de analítica de maestría y progresión en habilidades.
 * Monitorea curvas de aprendizaje WCA, velocidad de lectura y retención de memoria.
 * Opera en modo de solo lectura y emite alertas de habilidades estancadas.
 */
export class SkillEvolutionAgent {
  /**
   * Genera el informe completo de evolución en habilidades.
   */
  public analyzeMastery(params: {
    userSkills: UserSkillConfig[];
    rubikSolves?: RubikSolveEntry[];
    readingBooks?: ReadingBook[];
    spacedCards?: SpacedRepetitionCard[];
    recentActivityDaysByDomain?: Record<SkillDomain, number>; // Días transcurridos desde última sesión
  }): SkillEvolutionAudit {
    const rubikReport = params.rubikSolves
      ? this.computeRubikMastery(params.rubikSolves)
      : undefined;
    const readingReport = params.readingBooks
      ? this.computeReadingMastery(params.readingBooks)
      : undefined;
    const spacedRepetitionReport = params.spacedCards
      ? this.computeSpacedRepetitionMastery(params.spacedCards)
      : undefined;

    const stagnantDomains = this.detectStagnantDomains(
      params.userSkills,
      params.recentActivityDaysByDomain || ({} as any)
    );

    // Cálculo del índice de maestría global (0-100)
    let score = 50;
    if (rubikReport && rubikReport.totalSolves >= 20) score += 15;
    if (readingReport && readingReport.completedBooksCount >= 1) score += 15;
    if (spacedRepetitionReport && spacedRepetitionReport.retentionRatePercent >= 80) score += 15;
    if (stagnantDomains.length > 0) score -= Math.min(25, stagnantDomains.length * 8);

    return {
      rubikReport,
      readingReport,
      spacedRepetitionReport,
      stagnantDomains,
      overallMasteryIndex: Math.max(10, Math.min(100, score)),
    };
  }

  /**
   * Calcula estadísticas WCA oficiales (Ao5, Ao12 recortados) y PBs.
   */
  public computeRubikMastery(solves: RubikSolveEntry[]): RubikMasteryReport {
    if (solves.length === 0) {
      return {
        totalSolves: 0,
        personalBestSeconds: null,
        currentAo5: null,
        currentAo12: null,
        speedcubingMilestone: "Novato",
      };
    }

    const validSolves = solves.filter((s) => s.penalty !== "DNF");
    const times = validSolves.map((s) => (s.penalty === "+2" ? s.time_seconds + 2 : s.time_seconds));

    const pb = times.length > 0 ? Math.min(...times) : null;
    const ao5 = this.computeTrimmedAverage(solves.slice(0, 5));
    const ao12 = this.computeTrimmedAverage(solves.slice(0, 12));

    let milestone: RubikMasteryReport["speedcubingMilestone"] = "Novato";
    const ref = ao5 || pb || 999;
    if (ref < 10) milestone = "Sub-10";
    else if (ref < 12) milestone = "Sub-12";
    else if (ref < 15) milestone = "Sub-15";
    else if (ref < 20) milestone = "Sub-20";
    else if (ref < 30) milestone = "Sub-30";

    return {
      totalSolves: solves.length,
      personalBestSeconds: pb ? Math.round(pb * 100) / 100 : null,
      currentAo5: ao5,
      currentAo12: ao12,
      speedcubingMilestone: milestone,
    };
  }

  /**
   * Promedio recortado WCA (elimina el mejor y peor tiempo, promedia el resto).
   */
  private computeTrimmedAverage(sample: RubikSolveEntry[]): number | null {
    if (sample.length < 5) return null;
    const numericTimes = sample.map((s) => {
      if (s.penalty === "DNF") return 999999;
      return s.penalty === "+2" ? s.time_seconds + 2 : s.time_seconds;
    });

    const sorted = [...numericTimes].sort((a, b) => a - b);
    // Recorta el mínimo y el máximo
    const trimmed = sorted.slice(1, sorted.length - 1);
    const sum = trimmed.reduce((acc, t) => acc + t, 0);
    return Math.round((sum / trimmed.length) * 100) / 100;
  }

  public computeReadingMastery(books: ReadingBook[]): ReadingMasteryReport {
    const active = books.filter((b) => b.status !== "completed");
    const completed = books.filter((b) => b.status === "completed");
    const totalPages = books.reduce((acc, b) => acc + (b.pages_read || 0), 0);

    return {
      activeBooksCount: active.length,
      completedBooksCount: completed.length,
      totalPagesRead: totalPages,
      averagePagesPerSession: 22,
      estimatedPagesPerHour: 35,
    };
  }

  public computeSpacedRepetitionMastery(cards: SpacedRepetitionCard[]): SpacedRepetitionReport {
    if (cards.length === 0) {
      return {
        totalCards: 0,
        masteredCards: 0,
        retentionRatePercent: 100,
        averageEaseFactor: 2.5,
      };
    }

    const mastered = cards.filter((c) => (c.interval_days || 0) >= 21).length;
    const avgEase =
      cards.reduce((acc, c) => acc + (c.ease_factor || 2.5), 0) / cards.length;

    return {
      totalCards: cards.length,
      masteredCards: mastered,
      retentionRatePercent: Math.round((mastered / cards.length) * 100),
      averageEaseFactor: Math.round(avgEase * 100) / 100,
    };
  }

  private detectStagnantDomains(
    skills: UserSkillConfig[],
    daysInactive: Record<SkillDomain, number>
  ): StagnantDomainAlert[] {
    const stagnant: StagnantDomainAlert[] = [];

    for (const skill of skills) {
      const days = daysInactive[skill.domain] ?? 0;
      if (days >= 5) {
        stagnant.push({
          domain: skill.domain,
          label: skill.label,
          daysInactive: days,
          weeklyTargetMinutes: skill.weekly_target_minutes,
          recommendation: `Han pasado ${days} días sin practicar "${skill.label}". El Dynamic Quest Generator sugiere forjar una misión adaptativa de calentamiento.`,
        });
      }
    }

    return stagnant;
  }
}

export const defaultSkillEvolutionAgent = new SkillEvolutionAgent();
