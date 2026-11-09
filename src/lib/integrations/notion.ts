import type { INotionAdapter, NotionPagePayload } from "./types.ts";

/**
 * NotionAdapter: Adaptador desacoplado para exportación y sincronización de
 * Session Intelligence, reflexiones y bitácoras hacia Notion Databases.
 */
export class NotionAdapter implements INotionAdapter {
  public formatSessionToNotionPayload(params: {
    databaseId: string;
    title: string;
    domain: string;
    durationMinutes: number;
    notes: string;
    clarityScore?: number;
    dateIso?: string;
  }): NotionPagePayload {
    const today = params.dateIso || new Date().toISOString().slice(0, 10);

    const markdownContent = [
      `# 🧠 ${params.title}`,
      `> **Dominio:** ${params.domain.toUpperCase()} | **Duración:** ${params.durationMinutes} min | **Fecha:** ${today}`,
      params.clarityScore ? `> **Nivel de Claridad Mental:** ${params.clarityScore} / 10 ⭐` : "",
      "",
      "## 📝 Apuntes & Reflexiones de la Sesión",
      params.notes || "_Sin notas adicionales registradas._",
      "",
      "---",
      "_Exportado automáticamente desde RPG Life-Engine v3.5 (Santuario Libre de Culpa)_",
    ]
      .filter(Boolean)
      .join("\n");

    return {
      parentDatabaseId: params.databaseId,
      properties: {
        title: params.title,
        domain: params.domain,
        durationMinutes: params.durationMinutes,
        date: today,
        clarityScore: params.clarityScore ?? 8,
        tags: [params.domain, "rpg-life-engine", "session-intelligence"],
      },
      markdownContent,
    };
  }
}

export const defaultNotionAdapter = new NotionAdapter();
