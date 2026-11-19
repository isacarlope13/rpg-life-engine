import test from "node:test";
import { isPositiveSessionDuration } from "../src/lib/skill-session-validation.ts";
import fs from "node:fs";
import ts from "typescript";
import { buildSkillSessionPayload, createUniversalSession, finishUniversalSession } from "../src/lib/sanctuary/universal-session-engine.ts";
import assert from "node:assert/strict";
import { captureSessionCommand, executeSessionCommand, requestSessionCommand, sessionCommandKey } from "../src/lib/sanctuary/session-command.ts";

function fixture() {
  const rows = new Map<string, string>();
  const storage = { getItem: (key: string) => rows.get(key) ?? null, setItem: (key: string, value: string) => { rows.set(key, value); } };
  const input = { ownerId: "fixture-A", operationId: crypto.randomUUID(), payload: { duration_minutes: 2, domain: "reading", pages_read: 3 } };
  return { storage, rows, input };
}

test("capture persists the same payload, owner and idempotency key across retries and reload", () => {
  const { storage, input } = fixture();
  const original = captureSessionCommand(storage, input);
  input.payload.duration_minutes = 20;
  input.payload.pages_read = 30;
  const retry = captureSessionCommand(storage, input);
  assert.deepEqual(retry, original);
  assert.equal(retry.payload.duration_minutes, 2);
  assert.equal(retry.payload.idempotency_key, input.operationId);
});

test("no-time, missing owner or unavailable storage never starts a request", () => {
  const { storage, input } = fixture();
  for (const duration of [0, -1, NaN, Infinity]) assert.throws(() => captureSessionCommand(storage, { ...input, payload: { duration_minutes: duration } }));
  assert.throws(() => captureSessionCommand(storage, { ...input, ownerId: "" }));
  assert.throws(() => captureSessionCommand({ ...storage, setItem: () => false }, input));
});

test("401, 409, 503, fake offline and malformed success are not confirmations", async () => {
  const { storage, input } = fixture();
  const command = captureSessionCommand(storage, input);
  for (const [status, data] of [[401, {}], [409, {}], [503, {}], [200, { offline: true }], [200, { success: true }], [200, { success: false }], [200, null]] as const) {
    const result = await executeSessionCommand(storage, command, async () => Response.json(data, { status }));
    assert.notEqual(result.outcome, "confirmed");
    assert.equal(JSON.parse(storage.getItem(sessionCommandKey(input.ownerId, input.operationId))!).status, "pending");
  }
});

test("network loss and invalid JSON retain a pending operation", async () => {
  const { storage, input } = fixture();
  const command = captureSessionCommand(storage, input);
  assert.equal((await requestSessionCommand(command, async () => { throw Error("network"); })).outcome, "pending");
  assert.equal((await requestSessionCommand(command, async () => new Response("not-json"))).outcome, "pending");
});

test("parallel requests share one flight; local receipt avoids an extra send after reload", async () => {
  const { storage, input } = fixture();
  const command = captureSessionCommand(storage, input);
  let calls = 0;
  let release!: (value: Response) => void;
  const fetcher: typeof fetch = async (_url, init) => {
    calls++;
    assert.equal(new Headers(init?.headers).get("X-RPG-Offline-Owner"), input.ownerId);
    assert.equal(JSON.parse(init?.body as string).idempotency_key, input.operationId);
    return new Promise<Response>(resolve => { release = resolve; });
  };
  const one = executeSessionCommand(storage, command, fetcher);
  const two = executeSessionCommand(storage, command, fetcher);
  assert.equal(one, two);
  release(Response.json({ success: true, session_logged: { id: "fixture-session" } }));
  assert.equal((await one).outcome, "confirmed");
  assert.equal((await executeSessionCommand(storage, command, fetcher)).outcome, "confirmed");
  assert.equal(calls, 1);
});

test("corrupt commands and foreign owners are preserved, not silently adopted", () => {
  const { storage, input, rows } = fixture();
  const key = sessionCommandKey(input.ownerId, input.operationId);
  rows.set(key, "broken");
  assert.throws(() => captureSessionCommand(storage, input));
  assert.equal(rows.get(key), "broken");
  rows.set(key, JSON.stringify({ ...input, ownerId: "fixture-B", status: "pending" }));
  assert.throws(() => captureSessionCommand(storage, input));
});

test("explicit session duration rejects fake/default-coercible inputs while preserving valid manual entries", () => {
  for (const value of [0, -1, NaN, Infinity, "25", null, undefined, true]) assert.equal(isPositiveSessionDuration(value), false);
  for (const value of [1, 1.5, 25, 90]) assert.equal(isPositiveSessionDuration(value), true);
});

test("zero-time payload cannot fabricate a minute and specialized forms cannot replace operation identity", () => {
  const original = createUniversalSession({ userId: "fixture-A", domain: "reading", autoStart: false });
  const completed = finishUniversalSession(original, undefined, Date.parse(original.startedAt));
  const payload = buildSkillSessionPayload(completed, { action: "grant-xp", domain: "sports", idempotency_key: "replacement" });
  assert.equal(payload.duration_minutes, 0);
  assert.equal(payload.idempotency_key, original.idempotencyKey);
  assert.equal(payload.domain, original.domain);
  assert.equal(payload.action, "log_session");
  assert.equal(buildSkillSessionPayload(completed, { duration_minutes: 25 }).duration_minutes, 25);
});

test("a building completion handler cannot issue a second direct reward after finishing the universal session", () => {
  for (const file of fs.readdirSync("src/components/sanctuary").filter(name => name.endsWith("-building.tsx"))) {
    const source = ts.createSourceFile(file, fs.readFileSync(`src/components/sanctuary/${file}`, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function visit(node: ts.Node): void {
      if (ts.isVariableDeclaration(node) && node.initializer && ts.isArrowFunction(node.initializer)) {
        const calls = new Set<string>();
        function collect(child: ts.Node): void {
          if (ts.isCallExpression(child) && ts.isIdentifier(child.expression)) calls.add(child.expression.text);
          ts.forEachChild(child, collect);
        }
        collect(node.initializer.body);
        assert.equal(calls.has("finishSession") && calls.has("onSubmitDirectSkillSession"), false, `${file}: ${node.name.getText(source)} has duplicate completion paths`);
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
});
