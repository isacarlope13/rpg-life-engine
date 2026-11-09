import type { ScheduledSkillBlock } from "../calendar-planner.ts";
import type { ApprovalRequest, SystemEvent } from "../automation/types.ts";

export interface GoogleCalendarEventPayload {
  summary: string;
  description: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  colorId?: string;
}

export interface NotionPagePayload {
  parentDatabaseId: string;
  properties: {
    title: string;
    domain: string;
    durationMinutes: number;
    date: string;
    clarityScore?: number;
    tags?: string[];
  };
  markdownContent: string;
}

export interface WebhookNotificationPayload {
  eventType: string;
  title: string;
  message: string;
  urgency: "low" | "medium" | "critical";
  timestamp: string;
  data: Record<string, unknown>;
  signature?: string;
}

export interface IGoogleCalendarAdapter {
  formatCircadianBlocksToCalendarEvents(
    blocks: ScheduledSkillBlock[],
    dateIso: string,
    timeZone?: string
  ): GoogleCalendarEventPayload[];
  generateICalendarFeed(
    blocks: ScheduledSkillBlock[],
    dateIso: string,
    feedTitle?: string
  ): string;
}

export interface INotionAdapter {
  formatSessionToNotionPayload(params: {
    databaseId: string;
    title: string;
    domain: string;
    durationMinutes: number;
    notes: string;
    clarityScore?: number;
    dateIso?: string;
  }): NotionPagePayload;
}

export interface IWebhookNotificationAdapter {
  dispatchNotification(
    targetUrl: string,
    payload: WebhookNotificationPayload,
    secretKey?: string
  ): Promise<{ success: boolean; statusCode?: number; error?: string }>;
}
