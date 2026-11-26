import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  computeStrokeWidth,
  createEmptyInkDocument,
  exportInkDocumentToSvg,
  normalizeInkPoint,
  shouldAcceptInkPointer,
} from "../src/lib/devices/oakhaven-ink-engine.ts";
import {
  buildDeterministicQuickCaptureKey,
  validateQuickCapturePayload,
} from "../src/lib/devices/wrist-shortcut-contract.ts";
import {
  buildOakHavenPortabilityBundle,
} from "../src/lib/portability/oakhaven-export-bundle.ts";

describe("OAKHAVEN P2 — Ink (S Pen), Wrist/iOS Shortcuts y Portabilidad", () => {
  test("1. OakHaven Ink soporta rechazo de palma para S Pen y exporta SVG limpio sin scripts", () => {
    assert.equal(shouldAcceptInkPointer("touch", true), false);
    assert.equal(shouldAcceptInkPointer("pen", true), true);
    assert.equal(shouldAcceptInkPointer("touch", false), true);
    assert.ok(computeStrokeWidth(3, 0.9) > computeStrokeWidth(3, 0.2));

    const doc = createEmptyInkDocument("Boceto Filet", 400, 200);
    doc.strokes.push({
      id: "s1",
      color: "#3A2E2B",
      baseWidth: 3,
      pointerType: "pen",
      points: [normalizeInkPoint(10, 10, 0.6), normalizeInkPoint(120, 80, 0.8)],
    });
    const svg = exportInkDocumentToSvg(doc);
    assert.match(svg, /^<svg /);
    assert.match(svg, /M10 10 L120 80/);
    assert.ok(!svg.includes("<script"));
  });

  test("2. Contrato Wrist / iOS Shortcuts exige idempotencia y rechaza mutaciones de GP/XP/COP desde cliente", () => {
    const key = buildDeterministicQuickCaptureKey({
      deviceSource: "apple_watch",
      actionType: "quick_crochet_row",
      label: "Cupido vuelta 2",
      bucketMinuteIso: "2026-11-26T14:30:00Z",
    });
    assert.match(key, /^qc:apple_watch:quick_crochet_row:/);

    const ok = validateQuickCapturePayload({
      idempotencyKey: key,
      deviceSource: "apple_watch",
      actionType: "quick_crochet_row",
      label: "Cupido vuelta 2",
      durationMinutes: 10,
    });
    assert.equal(ok.valid, true);

    const badGp = validateQuickCapturePayload({
      idempotencyKey: key,
      deviceSource: "ios_shortcut",
      actionType: "quick_habit",
      label: "Intento GP",
      wallet_gp: 999999,
    });
    assert.equal(badGp.valid, false);

    const badCop = validateQuickCapturePayload({
      idempotencyKey: key,
      deviceSource: "ios_shortcut",
      actionType: "quick_habit",
      label: "Intento COP",
      amount_cop: 500000,
    });
    assert.equal(badCop.valid, false);
  });

  test("3. Portabilidad exporta datos personales redactando secretos y sin mezclar dinero real COP", () => {
    const bundle = buildOakHavenPortabilityBundle({
      walletGp: 59647,
      vaultRemainingGp: 240353,
      vaultCapGp: 400000,
      currentXp: 1619,
      playerLevel: 4,
      streakDays: 14,
      knittingProjects: [{ id: "k1", name: "Cupido", api_key: "SHOULD_NOT_EXPORT" }],
      readingBooks: [{ id: "b1", title: "Libro", auth_token: "HIDDEN" }],
      notes: ["Nota 1"],
    });
    assert.equal(bundle.includesRealMoneyCop, false);
    assert.equal(bundle.virtualProgression.walletGp, 59647);
    assert.equal("api_key" in bundle.personalRecords.knittingProjects[0], false);
    assert.equal("auth_token" in bundle.personalRecords.readingBooks[0], false);
  });
});
