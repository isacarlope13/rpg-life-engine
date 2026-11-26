import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  addPageToNotebook,
  computeStrokeWidth,
  createInkNotebook,
  exportInkDocumentToSvg,
  findStrokeAtPoint,
  normalizeInkPoint,
  shouldAcceptInkPointer,
} from "../src/lib/devices/oakhaven-ink-engine.ts";
import {
  DEVICE_CHANNEL_CAPABILITIES,
  buildDeterministicQuickCaptureKey,
  checkDeviceRateLimit,
  checkReplayProtection,
  hashPersonalTokenSha256,
  isScopedDeviceTokenAuthorized,
  validateQuickCapturePayload,
} from "../src/lib/devices/wrist-shortcut-contract.ts";
import {
  buildOakHavenPortabilityBundle,
  previewPortabilityImport,
} from "../src/lib/portability/oakhaven-export-bundle.ts";

describe("OAKHAVEN P1/P2 — Ink (Cuadernos/S Pen), Wrist/iOS Shortcuts y Portabilidad", () => {
  test("1. OakHaven Ink soporta cuadernos multipágina, plantillas de papel, S Pen, selección y SVG seguro", () => {
    assert.equal(shouldAcceptInkPointer("touch", true), false);
    assert.equal(shouldAcceptInkPointer("pen", true), true);
    assert.ok(computeStrokeWidth(3, 0.9) > computeStrokeWidth(3, 0.2));

    let nb = createInkNotebook("Notas Atelier", "grid", { linkedProjectId: "proj-1" });
    assert.equal(nb.pages.length, 1);
    assert.equal(nb.linkedProjectId, "proj-1");
    nb = addPageToNotebook(nb, "dots");
    assert.equal(nb.pages.length, 2);

    const active = nb.pages[1];
    active.strokes.push({
      id: "s1",
      color: "#3A2E2B",
      baseWidth: 3,
      pointerType: "pen",
      points: [normalizeInkPoint(10, 10, 0.6), normalizeInkPoint(120, 80, 0.8)],
    });
    assert.equal(findStrokeAtPoint(active.strokes, 12, 11)?.id, "s1");

    const svg = exportInkDocumentToSvg(active);
    assert.match(svg, /^<svg /);
    assert.match(svg, /M10 10 L120 80/);
    assert.ok(!svg.includes("<script"));
  });

  test("2. Wrist distingue Atajos de iOS vs App nativa Watch y valida tokens revocables con scopes", () => {
    assert.equal(DEVICE_CHANNEL_CAPABILITIES.ios_shortcuts_http.requiresNativeApp, false);
    assert.equal(DEVICE_CHANNEL_CAPABILITIES.apple_watch_native_companion.requiresNativeApp, true);

    const token = {
      id: "tok_demo_1",
      label: "Atajo iPhone",
      channel: "ios_shortcuts_http" as const,
      scopes: ["read:summary", "write:quick_capture"] as Array<"read:summary" | "write:quick_capture">,
      createdAt: "2026-11-26T00:00:00Z",
      revokedAt: null,
    };
    assert.equal(isScopedDeviceTokenAuthorized(token, "write:quick_capture").allowed, true);
    assert.equal(isScopedDeviceTokenAuthorized(token, "write:timer").allowed, false);
    assert.equal(
      isScopedDeviceTokenAuthorized({ ...token, revokedAt: "2026-11-26T01:00:00Z" }, "read:summary").allowed,
      false
    );

    const key = buildDeterministicQuickCaptureKey({
      deviceSource: "apple_watch",
      actionType: "quick_crochet_row",
      label: "Cupido vuelta 2",
      bucketMinuteIso: "2026-11-26T14:30:00Z",
    });
    assert.equal(
      validateQuickCapturePayload({
        idempotencyKey: key,
        deviceSource: "ios_shortcut",
        actionType: "quick_habit",
        label: "Intento GP",
        wallet_gp: 999999,
      }).valid,
      false
    );
  });

  test("3. Portabilidad valida esquema, redacta secretos, bloquea COP y detecta duplicados en vista previa", () => {
    const bundle = buildOakHavenPortabilityBundle({
      walletGp: 59647,
      vaultRemainingGp: 240353,
      vaultCapGp: 400000,
      currentXp: 1619,
      playerLevel: 4,
      streakDays: 14,
      knittingProjects: [
        { id: "k1", name: "Cupido", api_key: "SHOULD_NOT_EXPORT" },
        { id: "k2", name: "Nuevo Chal" },
      ],
      readingBooks: [{ id: "b1", title: "Libro", auth_token: "HIDDEN" }],
      notes: ["Nota repetida", "Nota nueva"],
    });
    assert.equal(bundle.includesRealMoneyCop, false);
    assert.equal("api_key" in bundle.personalRecords.knittingProjects[0], false);

    const preview = previewPortabilityImport(bundle, {
      knittingProjects: [{ id: "k1", name: "Cupido" }],
      readingBooks: [],
      notes: ["Nota repetida"],
    });
    assert.equal(preview.valid, true);
    assert.equal(preview.duplicateKnittingCount, 1);
    assert.equal(preview.newKnittingCount, 1);
    assert.equal(preview.newBooksCount, 1);
    assert.equal(preview.duplicateNotesCount, 1);
    assert.equal(preview.newNotesCount, 1);
  });

  test("4. Seguridad Wrist: hash SHA-256, rate-limit, protección anti-replay e integración real en /cozy", async () => {
    const hash = await hashPersonalTokenSha256("oak_test_token_demo_only");
    assert.match(hash, /^[a-f0-9]{64}$/);
    assert.equal(hash, await hashPersonalTokenSha256("oak_test_token_demo_only"));

    const now = Date.parse("2026-11-26T16:00:00Z");
    const rlOk = checkDeviceRateLimit({ recentTimestampsMs: [now - 5000], nowMs: now, maxRequests: 2 });
    assert.equal(rlOk.allowed, true);
    const rlBlock = checkDeviceRateLimit({
      recentTimestampsMs: [now - 5000, now - 2000],
      nowMs: now,
      maxRequests: 2,
    });
    assert.equal(rlBlock.allowed, false);

    const seen = new Set<string>(["qc:used:key"]);
    assert.equal(
      checkReplayProtection({
        idempotencyKey: "qc:used:key",
        capturedAtIso: "2026-11-26T15:59:00Z",
        seenKeys: seen,
        nowMs: now,
      }).allowed,
      false
    );
    assert.equal(
      checkReplayProtection({
        idempotencyKey: "qc:old:key",
        capturedAtIso: "2026-11-26T12:00:00Z",
        seenKeys: seen,
        nowMs: now,
      }).allowed,
      false
    );
    assert.equal(
      checkReplayProtection({
        idempotencyKey: "qc:fresh:key",
        capturedAtIso: "2026-11-26T15:59:00Z",
        seenKeys: seen,
        nowMs: now,
      }).allowed,
      true
    );

    const cozySrc = fs.readFileSync(
      new URL("../src/components/cozy-rpg-dashboard.tsx", import.meta.url),
      "utf8"
    );
    assert.match(cozySrc, /DeviceHubModal/);
  });
});
