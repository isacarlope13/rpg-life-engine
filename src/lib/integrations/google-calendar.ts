import type { ScheduledSkillBlock } from "../calendar-planner.ts";
import type {
  GoogleCalendarEventPayload,
  IGoogleCalendarAdapter,
} from "./types.ts";

/**
 * GoogleCalendarAdapter: Adaptador desacoplado para sincronización de bloques circadianos
 * con Google Calendar e importación universal en formato iCalendar (.ics).
 */
export class GoogleCalendarAdapter implements IGoogleCalendarAdapter {
  private defaultTimeZone: string;

  constructor(defaultTimeZone = "America/Bogota") {
    this.defaultTimeZone = defaultTimeZone;
  }

  /**
   * Transforma una lista de bloques circadianos en el payload JSON esperado por la Google Calendar REST API v3.
   */
  public formatCircadianBlocksToCalendarEvents(
    blocks: ScheduledSkillBlock[],
    dateIso: string, // "YYYY-MM-DD"
    timeZone = this.defaultTimeZone
  ): GoogleCalendarEventPayload[] {
    return blocks.map((block) => {
      const [startHHMM, endHHMM] = (block.timeRange || "08:00 - 08:30").split("-").map((s) => s.trim());
      const startDateTime = `${dateIso}T${startHHMM || "08:00"}:00`;
      const endDateTime = `${dateIso}T${endHHMM || "08:30"}:00`;

      return {
        summary: `[RPG Life] ${block.label}`,
        description: `Habilidad: ${block.domain.toUpperCase()} • Duración: ${block.minutes} min • Periodo: ${block.period} • Santuario Libre de Culpa`,
        start: { dateTime: startDateTime, timeZone },
        end: { dateTime: endDateTime, timeZone },
        colorId: this.getDomainColorId(block.domain),
      };
    });
  }

  /**
   * Genera un feed estándar iCalendar (.ics) compatible con Apple Calendar, Google Calendar y Outlook.
   */
  public generateICalendarFeed(
    blocks: ScheduledSkillBlock[],
    dateIso: string,
    feedTitle = "RPG Life-Engine Circadian Schedule"
  ): string {
    const dateFormatted = dateIso.replace(/-/g, "");
    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//RPG Life-Engine//Circadian Calendar//ES",
      `X-WR-CALNAME:${feedTitle}`,
      "CALSCALE:GREGORIAN",
    ];

    blocks.forEach((block, index) => {
      const [startHHMM, endHHMM] = (block.timeRange || "08:00 - 08:30").split("-").map((s) => s.trim());
      const startClean = (startHHMM || "08:00").replace(":", "");
      const endClean = (endHHMM || "08:30").replace(":", "");

      lines.push(
        "BEGIN:VEVENT",
        `UID:rpg_block_${dateFormatted}_${index}_${block.domain}@life-engine`,
        `DTSTAMP:${dateFormatted}T000000Z`,
        `DTSTART:${dateFormatted}T${startClean}00`,
        `DTEND:${dateFormatted}T${endClean}00`,
        `SUMMARY:[RPG] ${block.label}`,
        `DESCRIPTION:Dominio: ${block.domain} (${block.minutes}m). Santuario sin culpa.`,
        "STATUS:CONFIRMED",
        "END:VEVENT"
      );
    });

    lines.push("END:VCALENDAR");
    return lines.join("\r\n");
  }

  private getDomainColorId(domain: string): string {
    switch (domain) {
      case "work":
        return "9"; // Bold blue
      case "rubik":
        return "7"; // Peacock / Cyan
      case "reading":
        return "2"; // Sage green
      case "gardening":
      case "hiking":
        return "10"; // Basil green
      default:
        return "5"; // Banana yellow
    }
  }
}

export const defaultGoogleCalendarAdapter = new GoogleCalendarAdapter();
