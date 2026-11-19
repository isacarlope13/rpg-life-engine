import { test } from "node:test";
import assert from "node:assert/strict";
import { createStarterUserMemoryStore } from "../src/lib/demo-store.ts";
import { ATOMIC_SKILL_SESSION_ENABLED, prepareAtomicSkillSession, commitAtomicSkillSession } from "../src/lib/atomic-skill-session.ts";

const ownerId = "10000000-0000-4000-8000-000000000001";
const treasuryId = "20000000-0000-4000-8000-000000000001";
function fixture() {
  const store = createStarterUserMemoryStore();
  return { store, ownerId, treasuryId, profileUpdatedAt: "2026-01-01T00:00:00Z" };
}
const command = { domain: "study" as const, duration_minutes: 25, idempotency_key: "adapter-fixture" };

test("release is disabled and proposal captures base GP without touching live treasury or cache", () => {
  assert.equal(ATOMIC_SKILL_SESSION_ENABLED, false);
  const ctx = fixture();
  ctx.store.current_streak_days = 9;
  ctx.store.vault_remaining_gp = 1;
  const before = structuredClone(ctx.store);
  const plan = prepareAtomicSkillSession(ctx, command);
  assert.deepEqual(structuredClone(ctx.store), before);
  assert.equal(plan.p_activity.requested_gp, 2500); // uncapped, unmultiplied engine proposal
  assert.equal(plan.p_activity.earned_xp, 55);
  assert.equal(plan.p_collections_state.skillSessionState?.ownerId, ownerId);
  assert.equal(plan.p_collections_state.skillSessionState?.sessions[0].id, plan.p_session_id);
  assert.equal(plan.p_owner_id, ownerId);
});

test("book proposal uses existing completion/quote rules and isolates nested mutations", () => {
  const ctx = fixture();
  const book = ctx.store.readingBooks[0];
  assert.ok(book);
  book.id = "30000000-0000-4000-8000-000000000001";
  book.pages_read = book.total_pages - 1;
  book.status = "reading";
  const before = structuredClone(ctx.store);
  const input = { ...command, domain: "reading" as const, book_id: book.id, pages_read: 1, quotes_list: [{ text: "Synthetic quote" }] };
  const plan = prepareAtomicSkillSession(ctx, input);
  const oracle = Object.assign(Object.create(Object.getPrototypeOf(ctx.store)), structuredClone(ctx.store));
  oracle.vault_remaining_gp = 1_000_000;
  oracle.current_streak_days = 0;
  const expected = oracle.logSkillSession(input);
  assert.equal(plan.p_activity.requested_gp, expected.reward_impact.transferred_gp);
  assert.deepEqual(plan.p_resource, { kind: "book", id: book.id, delta: 1 });
  assert.deepEqual(structuredClone(ctx.store), before);
  input.quotes_list[0].text = "changed";
  assert.equal(plan.p_request.quotes_list?.[0].text, "Synthetic quote");
});

test("server identity cannot be overwritten by extra request fields; invalid resource cannot silently fall back", () => {
  const ctx = fixture();
  const plan = prepareAtomicSkillSession(ctx, { ...command, ownerId: "foreign", user_id: "foreign" } as typeof command);
  assert.equal(plan.p_owner_id, ownerId);
  assert.equal("user_id" in plan.p_request, false);
  assert.equal("ownerId" in plan.p_request, false);
  assert.throws(() => prepareAtomicSkillSession(ctx, { ...command, domain: "reading", book_id: "missing" }));
  for (const duration_minutes of [0, -1, 1.2, NaN, Infinity]) assert.throws(() => prepareAtomicSkillSession(ctx, { ...command, duration_minutes }));
  assert.throws(() => prepareAtomicSkillSession(ctx, { ...command, idempotency_key: " padded " }));
});

test("RPC errors and transport timeouts never mutate store, fall back, or replace operation identity", async () => {
  const ctx = fixture();
  const plan = prepareAtomicSkillSession(ctx, command);
  const before = structuredClone(ctx.store);
  const sent: unknown[] = [];
  const db = { async rpc(_name: string, args: unknown) { sent.push(args); return { data: null, error: { code: "40001" } }; } };
  await assert.rejects(commitAtomicSkillSession(db, plan), /pending/);
  await assert.rejects(commitAtomicSkillSession(db, plan), /pending/);
  assert.deepEqual(sent[0], sent[1]);
  assert.deepEqual(structuredClone(ctx.store), before);
  await assert.rejects(commitAtomicSkillSession({ rpc: async () => { throw new Error("timeout"); } }, plan), /timeout/);
});

test("incomplete acknowledgement is pending rather than false success", async () => {
  const plan = prepareAtomicSkillSession(fixture(), command);
  for (const data of [null, { success: true }, { success: true, replayed: false, session_logged: { id: plan.p_session_id } }]) {
    await assert.rejects(commitAtomicSkillSession({ rpc: async () => ({ data, error: null }) }, plan), /acknowledgement/);
  }
});

test("knitting and Rubik proposals preserve live resources and use exact engine side effects", () => {
  const ctx = fixture();
  const project = ctx.store.knittingProjects[0];
  assert.ok(project);
  project.id = "40000000-0000-4000-8000-000000000001";
  const before = structuredClone(ctx.store);
  const knit = prepareAtomicSkillSession(ctx, { ...command, domain: "knitting", project_id: project.id, rows_completed: 2 });
  assert.deepEqual(knit.p_resource, { kind: "knitting", id: project.id, delta: 2 });
  const rubik = prepareAtomicSkillSession(ctx, { ...command, domain: "rubik", solve_time_seconds: 21, penalty: "+2", scramble: "R U" });
  assert.equal(rubik.p_resource.kind, "rubik");
  if (rubik.p_resource.kind === "rubik") {
    assert.equal(rubik.p_resource.time_seconds, 23);
    assert.equal(rubik.p_resource.scramble, "R U");
  }
  assert.deepEqual(structuredClone(ctx.store), before);
});
