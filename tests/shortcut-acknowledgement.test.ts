import test from "node:test";
import assert from "node:assert/strict";
import { shortcutAcknowledgement } from "../src/lib/shortcut-acknowledgement.ts";

test("each shortcut accepts only its own confirmed resource ID", () => {
  const variants = [
    ["/api/shortcuts/skill-session", { success: true, session_logged: { id: "session-A" } }, "session-A"],
    ["/api/shortcuts/habit-log", { success: true, activity_log_id: "activity-A" }, "activity-A"],
    ["/api/shortcuts/quick-expense", { success: true, transaction_id: "transaction-A" }, "transaction-A"],
  ] as const;
  for (const [url, payload, id] of variants) {
    assert.equal(shortcutAcknowledgement(url, payload), id);
    assert.equal(shortcutAcknowledgement(url, { ...payload, success: false }), null);
    assert.equal(shortcutAcknowledgement(url, { ...payload, offline: true }), null);
    for (const [otherUrl] of variants) if (otherUrl !== url) assert.equal(shortcutAcknowledgement(otherUrl, payload), null);
  }
});

test("generic success, missing ID, non-JSON shape and unknown endpoints remain pending", () => {
  for (const value of [null, [], "ok", {}, { success: true }, { success: true, session_logged: { id: "" } }]) {
    assert.equal(shortcutAcknowledgement("/api/shortcuts/skill-session", value), null);
  }
  assert.equal(shortcutAcknowledgement("/unknown", { success: true, transaction_id: "x" }), null);
});
