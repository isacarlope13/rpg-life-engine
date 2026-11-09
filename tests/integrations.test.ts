import test from "node:test";
import assert from "node:assert/strict";
import {
  GoogleCalendarAdapter,
  NotionAdapter,
  WebhookNotificationAdapter,
} from "../src/lib/integrations/index.ts";
import { AutomationEventBus } from "../src/lib/automation/index.ts";
import type { ScheduledSkillBlock } from "../src/lib/calendar-planner.ts";

test("Integrations 1: GoogleCalendarAdapter formateo a REST API e iCalendar (.ics)", () => {
  const gcalAdapter = new GoogleCalendarAdapter("America/Bogota");

  const mockBlocks: ScheduledSkillBlock[] = [
    { domain: "reading", label: "Lectura Matutina", minutes: 30, timeRange: "06:30 - 07:00", period: "manana" },
    { domain: "work", label: "Bloque de Trabajo Deep Work", minutes: 240, timeRange: "08:30 - 12:30", period: "tarde" },
    { domain: "rubik", label: "Práctica WCA Rubik", minutes: 25, timeRange: "18:00 - 18:25", period: "noche" },
  ];

  // 1. Formateo para Google Calendar API
  const events = gcalAdapter.formatCircadianBlocksToCalendarEvents(mockBlocks, "2026-11-10");
  assert.equal(events.length, 3);
  assert.equal(events[0].start.dateTime, "2026-11-10T06:30:00");
  assert.equal(events[0].end.dateTime, "2026-11-10T07:00:00");
  assert.equal(events[0].start.timeZone, "America/Bogota");
  assert.equal(events[0].colorId, "2"); // Sage green para reading
  assert.equal(events[1].colorId, "9"); // Bold blue para work
  assert.equal(events[2].colorId, "7"); // Cyan para rubik

  // 2. Generación de feed estándar iCalendar (.ics)
  const icsFeed = gcalAdapter.generateICalendarFeed(mockBlocks, "2026-11-10", "Mi Calendario Circadiano");
  assert.ok(icsFeed.includes("BEGIN:VCALENDAR"));
  assert.ok(icsFeed.includes("X-WR-CALNAME:Mi Calendario Circadiano"));
  assert.ok(icsFeed.includes("SUMMARY:[RPG] Lectura Matutina"));
  assert.ok(icsFeed.includes("DTSTART:20261110T063000"));
  assert.ok(icsFeed.includes("END:VCALENDAR"));
});

test("Integrations 2: NotionAdapter estructuración de Session Intelligence & Markdown", () => {
  const notionAdapter = new NotionAdapter();

  const payload = notionAdapter.formatSessionToNotionPayload({
    databaseId: "notion_db_sessions_123",
    title: "Lectura Profunda: Hábitos Atómicos",
    domain: "reading",
    durationMinutes: 45,
    notes: "La regla de los dos minutos para crear hábitos sostenibles.",
    clarityScore: 9,
    dateIso: "2026-11-09",
  });

  assert.equal(payload.parentDatabaseId, "notion_db_sessions_123");
  assert.equal(payload.properties.title, "Lectura Profunda: Hábitos Atómicos");
  assert.equal(payload.properties.domain, "reading");
  assert.equal(payload.properties.durationMinutes, 45);
  assert.equal(payload.properties.clarityScore, 9);
  assert.ok(payload.markdownContent.includes("# 🧠 Lectura Profunda: Hábitos Atómicos"));
  assert.ok(payload.markdownContent.includes("La regla de los dos minutos"));
  assert.ok(payload.markdownContent.includes("Claridad Mental"));
  assert.ok(payload.markdownContent.includes("9 / 10"));
});

test("Integrations 3: WebhookNotificationAdapter HMAC SHA-256 & EventBus Listener", async () => {
  const webhookAdapter = new WebhookNotificationAdapter();
  const bus = new AutomationEventBus();

  let capturedUrl = "";
  let capturedPayload: any = null;

  // Mock de dispatchNotification
  webhookAdapter.dispatchNotification = async (targetUrl, payload, secretKey) => {
    capturedUrl = targetUrl;
    capturedPayload = payload;
    return { success: true, statusCode: 200 };
  };

  const detach = webhookAdapter.attachToEventBus(
    bus,
    "https://api.rpg-life-engine.internal/webhooks/alerts",
    "webhook_secret_key_2026"
  );

  // Emitir STREAK_AT_RISK
  await bus.emit({
    id: "evt_streak_warn",
    type: "STREAK_AT_RISK",
    userId: "usr_test",
    timestamp: new Date().toISOString(),
    source: "scheduler",
    payload: {
      streakDays: 14,
      hoursUntilMidnight: 3,
      urgency: "critical",
    },
  });

  assert.equal(capturedUrl, "https://api.rpg-life-engine.internal/webhooks/alerts");
  assert.equal(capturedPayload?.eventType, "STREAK_AT_RISK");
  assert.equal(capturedPayload?.urgency, "critical");
  assert.ok(capturedPayload?.message.includes("14 días"));

  detach();
});
