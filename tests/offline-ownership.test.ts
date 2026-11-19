import test from "node:test";
import assert from "node:assert/strict";
import { safeLocalStorage } from "../src/lib/storage-safe.ts";
import { getOfflineQueue, getOfflineQueueKey, processOfflineQueue, queueOfflineAction } from "../src/lib/offline-sync.ts";
import { offlineOwnerMatches, OFFLINE_OWNER_HEADER } from "../src/lib/offline-owner.ts";

const action = { url: "/api/shortcuts/skill-session", method: "POST", body: { idempotency_key: "fixture-stable" }, description: "Synthetic activity" };

test("anonymous calls cannot read, enqueue or replay legacy pending commands", async () => {
  safeLocalStorage.setItem(getOfflineQueueKey(), JSON.stringify([{ ...action, userId: "fixture-A" }]));
  const before = safeLocalStorage.getItem(getOfflineQueueKey());
  assert.equal(queueOfflineAction(action), false);
  assert.deepEqual(getOfflineQueue(), []);
  assert.equal(await processOfflineQueue(), 0);
  assert.equal(safeLocalStorage.getItem(getOfflineQueueKey()), before);
});

test("owners have collision-free namespaces, with no global copy or adoption", () => {
  const before = safeLocalStorage.getItem(getOfflineQueueKey());
  assert.notEqual(getOfflineQueueKey("fixture:a"), getOfflineQueueKey("fixture_a"));
  assert.equal(queueOfflineAction(action, "fixture:A"), true);
  assert.equal(getOfflineQueue("fixture:A").length, 1);
  assert.deepEqual(getOfflineQueue("fixture:B"), []);
  assert.equal(queueOfflineAction({ ...action, userId: "fixture:A" }, "fixture:B"), false);
  assert.equal(safeLocalStorage.getItem(getOfflineQueueKey()), before);
});

test("server owner assertion uses verified identity and rejects cross-account replays", () => {
  assert.equal(offlineOwnerMatches(new Headers(), "fixture-A"), true);
  assert.equal(offlineOwnerMatches(new Headers({ [OFFLINE_OWNER_HEADER]: "fixture-A" }), "fixture-A"), true);
  assert.equal(offlineOwnerMatches(new Headers({ [OFFLINE_OWNER_HEADER]: "fixture-A" }), "fixture-B"), false);
  assert.equal(offlineOwnerMatches(new Headers({ [OFFLINE_OWNER_HEADER]: "" }), "fixture-B"), false);
});

test("corrupt and ownerless scoped rows are retained but never exposed or replayed", () => {
  const key = getOfflineQueueKey("fixture-corrupt");
  safeLocalStorage.setItem(key, "not-json");
  assert.equal(queueOfflineAction(action, "fixture-corrupt"), false);
  assert.equal(safeLocalStorage.getItem(key), "not-json");
  safeLocalStorage.setItem(key, JSON.stringify([action, null]));
  assert.deepEqual(getOfflineQueue("fixture-corrupt"), []);
});

test("retry, account switch, concurrent replay and appended commands preserve owner and stable keys", async () => {
  const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
  const navigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  const originalFetch = globalThis.fetch;
  Object.defineProperty(globalThis, "window", { configurable: true, value: {} });
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { onLine: true } });
  const owner = "fixture-replay-A";
  queueOfflineAction(action, owner);
  const initial = getOfflineQueue(owner)[0];
  let calls = 0;
  let status = 409;
  let release: (() => void) | undefined;
  try {
    globalThis.fetch = async (_url, init) => {
      calls++;
      assert.equal(new Headers(init?.headers).get(OFFLINE_OWNER_HEADER), owner);
      assert.equal(JSON.parse(init?.body as string).idempotency_key, initial.idempotency_key);
      if (status === 200) await new Promise<void>(resolve => { release = resolve; });
      return Response.json({ success: status === 200, session_logged: status === 200 ? { id: "fixture-offline-confirmed" } : undefined }, { status });
    };
    assert.equal(await processOfflineQueue("fixture-replay-B"), 0);
    assert.equal(calls, 0);
    assert.equal(await processOfflineQueue(owner), 0); // Server is logged in as B.
    assert.equal(getOfflineQueue(owner)[0].id, initial.id);
    status = 503;
    assert.equal(await processOfflineQueue(owner), 0);
    assert.equal(getOfflineQueue(owner)[0].idempotency_key, initial.idempotency_key);
    status = 200;
    const one = processOfflineQueue(owner);
    const two = processOfflineQueue(owner);
    assert.equal(one, two);
    queueOfflineAction({ ...action, body: { idempotency_key: "fixture-new" } }, owner);
    assert.ok(release);
    release();
    assert.equal(await one, 1);
    assert.equal(calls, 3);
    assert.equal(getOfflineQueue(owner).length, 1);
    assert.equal(getOfflineQueue(owner)[0].idempotency_key, "fixture-new");
  } finally {
    globalThis.fetch = originalFetch;
    if (windowDescriptor) Object.defineProperty(globalThis, "window", windowDescriptor);
    else Reflect.deleteProperty(globalThis, "window");
    if (navigatorDescriptor) Object.defineProperty(globalThis, "navigator", navigatorDescriptor);
    else Reflect.deleteProperty(globalThis, "navigator");
  }
});
