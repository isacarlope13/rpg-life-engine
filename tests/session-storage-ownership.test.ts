import test from "node:test";
import assert from "node:assert/strict";
import { createUniversalSession, finishUniversalSession } from "../src/lib/sanctuary/universal-session-engine.ts";
import { appendOwnedHistory, loadOwnedHistory, loadOwnedSession, saveOwnedSession, sessionStorageKeys, type SessionStorage } from "../src/lib/sanctuary/session-storage.ts";

function memory() {
  const rows = new Map<string, string>();
  const storage: SessionStorage = { getItem: key => rows.get(key) ?? null, setItem: (key, value) => { rows.set(key, value); } };
  return { rows, storage };
}
const create = (owner = "fixture-A") => createUniversalSession({ userId: owner, domain: "reading", autoStart: true });

test("session creation has no demo identity fallback", () => {
  for (const userId of ["", " ", "anonymous", undefined]) {
    assert.throws(() => createUniversalSession({ userId: userId as string, domain: "reading" }), /identidad explícita/);
  }
});

test("A to B to A keeps separate active session, idempotency key and history", () => {
  const { storage } = memory();
  const a = create();
  assert.equal(saveOwnedSession(storage, "fixture-A", a), true);
  assert.equal(loadOwnedSession(storage, "fixture-B"), null);
  assert.deepEqual(loadOwnedHistory(storage, "fixture-B"), []);
  const b = create("fixture-B");
  saveOwnedSession(storage, "fixture-B", b);
  const completed = finishUniversalSession(a);
  assert.equal(appendOwnedHistory(storage, "fixture-A", completed), true);
  assert.equal(loadOwnedHistory(storage, "fixture-B").length, 0);
  assert.equal(loadOwnedSession(storage, "fixture-A")?.idempotencyKey, a.idempotencyKey);
  assert.equal(loadOwnedSession(storage, "fixture-B")?.sessionId, b.sessionId);
  assert.equal(loadOwnedHistory(storage, "fixture-A")[0].sessionId, a.sessionId);
});

test("identity missing or mismatched cannot read, save, clear or append another owner's state", () => {
  const { storage, rows } = memory();
  const a = create();
  saveOwnedSession(storage, "fixture-A", a);
  const before = [...rows];
  assert.equal(loadOwnedSession(storage), null);
  assert.deepEqual(loadOwnedHistory(storage), []);
  assert.equal(saveOwnedSession(storage, undefined, null), false);
  assert.equal(saveOwnedSession(storage, "fixture-B", a), false);
  assert.equal(appendOwnedHistory(storage, "fixture-B", finishUniversalSession(a)), false);
  assert.deepEqual([...rows], before);
});

test("legacy v3/v4/history are never read, reassigned, removed or overwritten", () => {
  const { rows, storage } = memory();
  for (const key of ["rpg_universal_session_v3", "rpg_universal_session_v4", "rpg_universal_sessions_history_v4"]) rows.set(key, "legacy-for-recovery");
  const before = [...rows];
  assert.equal(loadOwnedSession(storage, "fixture-A"), null);
  assert.deepEqual(loadOwnedHistory(storage, "fixture-A"), []);
  saveOwnedSession(storage, "fixture-A", create());
  appendOwnedHistory(storage, "fixture-A", finishUniversalSession(create()));
  saveOwnedSession(storage, "fixture-A", null);
  for (const [key, value] of before) assert.equal(rows.get(key), value);
});

test("scoped records still require matching ownership; corrupt storage is not silently replaced", () => {
  const { rows, storage } = memory();
  const keys = sessionStorageKeys("fixture-B")!;
  rows.set(keys.active, JSON.stringify(create("fixture-A")));
  rows.set(keys.history, JSON.stringify([finishUniversalSession(create("fixture-A")), null, {}]));
  assert.equal(loadOwnedSession(storage, "fixture-B"), null);
  assert.deepEqual(loadOwnedHistory(storage, "fixture-B"), []);
  rows.set(keys.history, "not-json");
  assert.equal(appendOwnedHistory(storage, "fixture-B", finishUniversalSession(create("fixture-B"))), false);
  assert.equal(rows.get(keys.history), "not-json");
});

test("history retry deduplicates by session without discarding unknown rows", () => {
  const { rows, storage } = memory();
  const owner = "fixture-A";
  const completed = finishUniversalSession(create(owner));
  rows.set(sessionStorageKeys(owner)!.history, JSON.stringify([{ legacy: "keep" }]));
  appendOwnedHistory(storage, owner, completed);
  appendOwnedHistory(storage, owner, completed);
  assert.equal(loadOwnedHistory(storage, owner).length, 1);
  assert.equal(JSON.parse(rows.get(sessionStorageKeys(owner)!.history)!)[1].legacy, "keep");
  assert.equal(appendOwnedHistory(storage, owner, create(owner)), false);
});

test("namespaces are collision-free and storage failures do not escape", () => {
  assert.notEqual(sessionStorageKeys("fixture:a")!.active, sessionStorageKeys("fixture_a")!.active);
  assert.equal(sessionStorageKeys("anonymous"), null);
  const failed: SessionStorage = { getItem() { throw Error("blocked"); }, setItem() { throw Error("blocked"); } };
  assert.equal(loadOwnedSession(failed, "fixture-A"), null);
  assert.deepEqual(loadOwnedHistory(failed, "fixture-A"), []);
  assert.equal(saveOwnedSession(failed, "fixture-A", create()), false);
  assert.equal(appendOwnedHistory(failed, "fixture-A", finishUniversalSession(create())), false);
});
