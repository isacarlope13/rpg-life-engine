import test from "node:test";
import assert from "node:assert/strict";
import { createUniversalSession, hydrateUniversalSession } from "../src/lib/sanctuary/universal-session-engine.ts";

const session = () => createUniversalSession({ userId: "fixture-A", domain: "reading", autoStart: true });

test("hydration requires an explicit expected owner and never adopts an ownerless record", () => {
  const original = session();
  const { userId: _owner, ...ownerless } = original;
  assert.equal(hydrateUniversalSession(ownerless, "fixture-A"), null);
  assert.equal(hydrateUniversalSession({ ...original, userId: "" }, "fixture-A"), null);
  assert.equal(hydrateUniversalSession(original), null);
  assert.equal(hydrateUniversalSession(original, ""), null);
  assert.equal(hydrateUniversalSession(original, "anonymous"), null);
});

test("account B cannot recover A and returning to A preserves identity and idempotency", () => {
  const original = session();
  const raw = JSON.stringify(original);
  assert.equal(hydrateUniversalSession(raw, "fixture-B"), null);
  const recovered = hydrateUniversalSession(raw, "fixture-A", Date.parse(original.startedAt) + 5000);
  assert.ok(recovered);
  assert.equal(recovered.userId, original.userId);
  assert.equal(recovered.sessionId, original.sessionId);
  assert.equal(recovered.idempotencyKey, original.idempotencyKey);
  assert.equal(raw, JSON.stringify(original));
});
