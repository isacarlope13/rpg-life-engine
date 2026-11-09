// Utilidad para exportación a Notion (CSV), respaldos maestros (JSON)
// y generador automático de atajos de iOS Shortcuts.

import type { ReadingBook, RubikSolveEntry, FixedCostItem, SessionIntelligenceData } from "@/types/rpg";
import type { DemoBoss } from "./demo-store";

function downloadBlob(filename: string, text: string, mimeType: string): void {
  if (typeof window === "undefined") return;
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function escapeCsvCell(val: unknown): string {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

/**
 * 1. Exporta la biblioteca de libros y sus citas en formato CSV compatible con Notion
 */
export function exportBooksToNotionCsv(books: ReadingBook[]): void {
  const headers = [
    "Título",
    "Autor",
    "Formato",
    "Estado",
    "Total Páginas",
    "Precio Pagado COP",
    "Calificación",
    "Cita Célebre",
    "Reseña Personal",
    "Total Citas Capturadas",
    "Fecha Registro",
  ];

  const rows = books.map((b) => [
    escapeCsvCell(b.title),
    escapeCsvCell(b.author),
    escapeCsvCell(b.format || "fisico"),
    escapeCsvCell(b.status || "por_leer"),
    escapeCsvCell(b.total_pages || 0),
    escapeCsvCell(b.price_paid || 0),
    escapeCsvCell(b.rating || 5),
    escapeCsvCell(b.famous_quote || ""),
    escapeCsvCell(b.personal_review || ""),
    escapeCsvCell(b.quotes?.length || 0),
    escapeCsvCell(b.purchase_date || new Date().toISOString().split("T")[0]),
  ]);

  const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
  downloadBlob(`reading-hub-notion-${new Date().toISOString().split("T")[0]}.csv`, csvContent, "text/csv;charset=utf-8;");
}

/**
 * 2. Exporta el estado financiero y Debt Bosses a CSV para Notion / Excel
 */
export function exportFinancesToCsv(bosses: DemoBoss[], fixedCosts: FixedCostItem[] = []): void {
  const headers = [
    "Tipo Registro",
    "Nombre / Concepto",
    "Saldo / Monto COP",
    "Tasa E.A. %",
    "Cuota Mínima Mensual",
    "Día de Corte",
    "Estado",
  ];

  const rowsBosses = bosses.map((boss) => [
    escapeCsvCell("Debt Boss"),
    escapeCsvCell(boss.name),
    escapeCsvCell(boss.current_hp),
    escapeCsvCell(boss.interest_rate_ea),
    escapeCsvCell(boss.min_monthly_payment_cop),
    escapeCsvCell(boss.cutoff_day || 15),
    escapeCsvCell(boss.status || (boss.current_hp <= 0 ? "derrotado" : "activo")),
  ]);

  const rowsFixed = fixedCosts.map((fc) => [
    escapeCsvCell("Costo Fijo"),
    escapeCsvCell(fc.name),
    escapeCsvCell(fc.amount),
    escapeCsvCell(0),
    escapeCsvCell(fc.amount),
    escapeCsvCell(1),
    escapeCsvCell(fc.category || "operativo"),
  ]);

  const allRows = [...rowsBosses, ...rowsFixed];
  const csvContent = "\uFEFF" + [headers.join(","), ...allRows.map((r) => r.join(","))].join("\r\n");
  downloadBlob(`finanzas-debt-bosses-${new Date().toISOString().split("T")[0]}.csv`, csvContent, "text/csv;charset=utf-8;");
}

/**
 * 3. Exporta la bitácora de solves de Cubos WCA a CSV
 */
export function exportRubikSolvesCsv(solves: RubikSolveEntry[]): void {
  const headers = [
    "ID Solve",
    "Tipo Cubo",
    "Tiempo Segundos",
    "Penalización",
    "Scramble WCA",
    "Fecha",
  ];

  const rows = solves.map((s) => [
    escapeCsvCell(s.id),
    escapeCsvCell(s.cube_type || "3x3"),
    escapeCsvCell(s.time_seconds),
    escapeCsvCell(s.penalty || "NONE"),
    escapeCsvCell(s.scramble || ""),
    escapeCsvCell(s.timestamp || new Date().toISOString()),
  ]);

  const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
  downloadBlob(`rubik-solves-wca-${new Date().toISOString().split("T")[0]}.csv`, csvContent, "text/csv;charset=utf-8;");
}

/**
 * 4. Descarga un respaldo maestro en JSON con todo el estado del jugador
 */
export function exportMasterBackupJson(state: unknown): void {
  const jsonContent = JSON.stringify(
    {
      version: "3.4.0",
      export_date: new Date().toISOString(),
      engine_state: state,
    },
    null,
    2
  );
  downloadBlob(
    `rpg-life-engine-backup-${new Date().toISOString().split("T")[0]}.json`,
    jsonContent,
    "application/json"
  );
}

/**
 * 5. Genera la configuración directa e instalador de iOS Shortcuts con tu API Key
 */
export function generateIosShortcutFile(apiKey: string, serverOrigin: string): void {
  const shortcutData = {
    WFWorkflowName: "RPG Life-Engine Express",
    WFWorkflowActions: [
      {
        action: "Dictar o Recibir Entrada de Texto",
        description: "Ej: 'Almuerzo 25000', 'Leí 15 páginas', 'Solución de cubo 18s'",
      },
      {
        action: "URL Webhook",
        endpoint: `${serverOrigin}/api/shortcuts/omni`,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body_template: {
          text: "ShortcutInput",
          use_aegis_shield: true,
        },
      },
      {
        action: "Respuesta de Voz Siri (TTS)",
        description: "Siri te responderá en voz alta con los GP ganados y el daño al Debt Boss.",
      },
    ],
    metadata: {
      api_key: apiKey,
      server: serverOrigin,
      created_at: new Date().toISOString(),
    },
  };

  downloadBlob(
    "RPG-LifeEngine-Atajo.shortcut.json",
    JSON.stringify(shortcutData, null, 2),
    "application/json"
  );
}

/**
 * 6. Convierte una sesión activa de Session Intelligence a formato Markdown compatible con Notion
 */
export function formatSessionToNotionMarkdown(session: SessionIntelligenceData): string {
  const domainEmojis: Record<string, string> = {
    rubik: "🧊",
    reading: "📖",
    knitting: "🧶",
    study: "🎓",
    work: "💼",
    gaming: "🎮",
    sports: "🏅",
    journaling: "✍️",
    gardening: "🌱",
    drawing: "🎨",
    ceramics: "🏺",
    hiking: "🥾",
    cooking: "🍳",
    general: "⚡",
  };
  const icon = domainEmojis[session.domain] || "📌";

  const checklistLines = session.checklistResults
    ? Object.entries(session.checklistResults)
        .map(([k, v]) => `  - **${k}:** ${v}`)
        .join("\n")
    : "";

  return `### ${icon} ${session.title}
- **Fecha:** ${session.timestamp || new Date().toISOString().replace("T", " ").slice(0, 16)}
- **Dominio:** ${session.domain.toUpperCase()}
- **Duración:** ${session.durationMinutes} minutos
- **XP Obtenida:** +${session.xpEarned} XP
- **GP Ganada:** +${session.gpEarned} GP
- **Multiplicador de Enfoque:** ${session.focusMultiplier || 1.0}x
${session.clarityRating ? `- **Claridad Mental / Batería:** ${session.clarityRating}/10` : ""}
${checklistLines ? `- **Resultados Clave:**\n${checklistLines}` : ""}

#### 📝 Notas de Sesión / Bitácora:
${session.sessionNotes.trim() ? session.sessionNotes.trim() : "_Sin notas adicionales capturadas._"}

---
*Sincronizado desde RPG Life-Engine v3.4 • Refugio Libre de Culpa*
`;
}

/**
 * 7. Copia una sesión activa en formato compatible con Notion directamente al portapapeles
 */
export async function copySessionToNotionClipboard(
  session: SessionIntelligenceData
): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.clipboard) return false;
  try {
    const md = formatSessionToNotionMarkdown(session);
    await navigator.clipboard.writeText(md);
    return true;
  } catch {
    return false;
  }
}

/**
 * 8. Exporta un lote de sesiones históricas a CSV para Notion Databases
 */
export function exportSessionsToNotionCsv(sessions: SessionIntelligenceData[]): void {
  const headers = [
    "ID",
    "Título",
    "Dominio",
    "Duración Minutos",
    "XP Ganada",
    "GP Ganada",
    "Multiplicador",
    "Claridad Mental (1-10)",
    "Notas de Sesión",
    "Fecha",
  ];

  const rows = sessions.map((s) => [
    escapeCsvCell(s.id),
    escapeCsvCell(s.title),
    escapeCsvCell(s.domain),
    escapeCsvCell(s.durationMinutes),
    escapeCsvCell(s.xpEarned),
    escapeCsvCell(s.gpEarned),
    escapeCsvCell(s.focusMultiplier || 1.0),
    escapeCsvCell(s.clarityRating || ""),
    escapeCsvCell(s.sessionNotes || ""),
    escapeCsvCell(s.timestamp || new Date().toISOString()),
  ]);

  const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
  downloadBlob(
    `notion-session-intelligence-${new Date().toISOString().split("T")[0]}.csv`,
    csvContent,
    "text/csv;charset=utf-8;"
  );
}
