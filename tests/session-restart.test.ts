import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createStarterUserMemoryStore } from "../src/lib/demo-store.ts";
import { serializeStoreCollections, applyPersistedCollectionsToStore, persistUserCollectionsState } from "../src/lib/persistence-sync.ts";
import { applySkillSessionState, serializeSkillSessionState } from "../src/lib/skill-session-state.ts";
import { recoverSkillSessionStateFromProfile } from "../src/lib/skill-session-recovery.ts";

function store(owner = "fixture-A") {
  const result = createStarterUserMemoryStore({ userId: owner });
  result.wallet_gp = 0;
  result.vault_remaining_gp = 50;
  result.current_xp = 0;
  result.readingBooks = [{ id: "fixture-book", title: "Synthetic book", author: "Fixture", total_pages: 100, pages_read: 0, status: "reading", category: "fixture" }];
  result.knittingProjects = [{ id: "fixture-knit", name: "Synthetic knitting", technique: "Crochet", total_rows_target: 100, completed_rows: 0, yarn_details: "fixture", status: "in_progress" }];
  return result;
}

test("a full snapshot restart replays the same session without paying GP/XP or advancing pages again", () => {
  const original = store();
  const input = { domain: "reading" as const, duration_minutes: 10, book_id: "fixture-book", pages_read: 5, idempotency_key: "fixture-read-op" };
  const first = original.logSkillSession(input);
  assert.equal(first.reward_impact.transferred_gp, 50);
  const saved = JSON.parse(JSON.stringify(serializeStoreCollections(original, "fixture-A")));
  const restarted = store();
  assert.equal(restarted.processedIdempotencyKeys.size, 0);
  applyPersistedCollectionsToStore(restarted, saved, "fixture-A");
  const before = { wallet: restarted.wallet_gp, vault: restarted.vault_remaining_gp, xp: restarted.current_xp, streak: restarted.current_streak_days, pages: restarted.readingBooks[0].pages_read, count: restarted.skillSessions.length };
  const replay = restarted.logSkillSession({ ...input, pages_read: 99, duration_minutes: 100 });
  assert.equal(replay.session.id, first.session.id);
  assert.equal(replay.reward_impact.transferred_gp, first.reward_impact.transferred_gp);
  assert.equal(replay.reward_impact.idempotent_replay, true);
  assert.deepEqual({ wallet: restarted.wallet_gp, vault: restarted.vault_remaining_gp, xp: restarted.current_xp, streak: restarted.current_streak_days, pages: restarted.readingBooks[0].pages_read, count: restarted.skillSessions.length }, before);
});

test("capped zero-GP receipts and knitting progress remain idempotent after restart", () => {
  const original = store();
  original.vault_remaining_gp = 0;
  const input = { domain: "knitting" as const, duration_minutes: 5, project_id: "fixture-knit", rows_completed: 3, idempotency_key: "fixture-knit-op" };
  const first = original.logSkillSession(input);
  assert.equal(first.reward_impact.transferred_gp, 0);
  const restarted = store();
  applyPersistedCollectionsToStore(restarted, JSON.parse(JSON.stringify(serializeStoreCollections(original, "fixture-A"))), "fixture-A");
  const rows = restarted.knittingProjects[0].completed_rows;
  const replay = restarted.logSkillSession({ ...input, rows_completed: 90 });
  assert.equal(replay.session.id, first.session.id);
  assert.equal(replay.reward_impact.transferred_gp, 0);
  assert.equal(restarted.knittingProjects[0].completed_rows, rows);
});

test("recovered session cache requires explicit matching owner and does not include financial commands", () => {
  const original = store();
  original.logSkillSession({ domain: "study", duration_minutes: 5, idempotency_key: "fixture-study-op" });
  original.processedIdempotencyKeys.set("limit_break:private", { synthetic: true });
  const state = serializeSkillSessionState(original, "fixture-A")!;
  assert.ok(state.receipts.length > 0);
  assert.ok(state.receipts.every(([key]) => key.startsWith("skill_session:")));
  assert.equal(serializeSkillSessionState(original), undefined);
  for (const owner of [undefined, "", "fixture-B"]) {
    const target = store("fixture-B");
    const before = structuredClone(target.skillSessions);
    assert.equal(applySkillSessionState(target, state, owner), false);
    assert.deepEqual(target.skillSessions, before);
    assert.equal(target.processedIdempotencyKeys.size, 0);
  }
});

test("invalid envelopes are rejected atomically and legacy snapshots do not invent receipts", () => {
  const original = store();
  original.logSkillSession({ domain: "study", duration_minutes: 5, idempotency_key: "fixture-study-op" });
  const state = serializeSkillSessionState(original, "fixture-A")!;
  const target = store();
  for (const value of [null, {}, { ...state, version: 2 }, { ...state, sessions: [null] }, { ...state, receipts: [["skill_session:x", {}]] }, { ...state, receipts: [...state.receipts, ...state.receipts] }]) {
    assert.equal(applySkillSessionState(target, value, "fixture-A"), false);
    assert.equal(target.processedIdempotencyKeys.size, 0);
  }
  applyPersistedCollectionsToStore(target, { readingBooks: [] }, "fixture-A");
  assert.deepEqual(target.readingBooks, []);
  assert.equal(target.processedIdempotencyKeys.size, 0);
});

test("serialization and restore detach mutable session/receipt references", () => {
  const original = store();
  original.logSkillSession({ domain: "study", duration_minutes: 5, idempotency_key: "fixture-study-op" });
  const snapshot = serializeSkillSessionState(original, "fixture-A")!;
  const target = store();
  applySkillSessionState(target, snapshot, "fixture-A");
  snapshot.sessions[0].title = "mutated snapshot";
  assert.notEqual(target.skillSessions[0].title, snapshot.sessions[0].title);
  original.skillSessions[0].title = "mutated original";
  assert.notEqual(target.skillSessions[0].title, original.skillSessions[0].title);
});

test("a separate Node process recovers the atomic disk snapshot and replays without a second effect", async () => {
  const original = store();
  const input = { domain: "reading" as const, duration_minutes: 10, book_id: "fixture-book", pages_read: 5, idempotency_key: "fixture-process-op" };
  const first = original.logSkillSession(input);
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "oakhaven-restart-"));
  const file = path.join(directory, "fixture-A.json");
  try {
    assert.equal((await persistUserCollectionsState({ userId: "fixture-A", store: original, storageDirectory: directory, localOnly: true })).diskSaved, true);
    const child = spawnSync(process.execPath, ["--input-type=module", "-e", `
      import { createStarterUserMemoryStore } from ${JSON.stringify(new URL("../src/lib/demo-store.ts", import.meta.url).href)};
      import { hydrateStoreFromLocalDisk } from ${JSON.stringify(new URL("../src/lib/persistence-sync.ts", import.meta.url).href)};
      const target = createStarterUserMemoryStore({userId:"fixture-A"});
      if (!hydrateStoreFromLocalDisk("fixture-A", target, ${JSON.stringify(directory)})) throw Error("recovery failed");
      const before = JSON.stringify([target.wallet_gp,target.current_xp,target.readingBooks[0].pages_read,target.skillSessions.length]);
      const replay = target.logSkillSession(${JSON.stringify(input)});
      const after = JSON.stringify([target.wallet_gp,target.current_xp,target.readingBooks[0].pages_read,target.skillSessions.length]);
      console.log(JSON.stringify({unchanged:before===after,id:replay.session.id,replay:replay.reward_impact.idempotent_replay}));
    `], { encoding: "utf8", timeout: 15000 });
    assert.equal(child.status, 0, child.stderr);
    const result = JSON.parse(child.stdout.trim());
    assert.deepEqual(result, { unchanged: true, id: first.session.id, replay: true });
  } finally {
    assert.equal(path.dirname(path.resolve(file)), path.resolve(directory));
    assert.equal(path.dirname(path.resolve(directory)), path.resolve(os.tmpdir()));
    if (fs.existsSync(file)) fs.unlinkSync(file);
    fs.rmdirSync(directory);
  }
});

function profileClient(snapshot: unknown, id = "fixture-A", fail = false) {
  let calls = 0;
  const chain = { select() { return chain; }, eq(field: string, owner: string) { assert.equal(field, "id"); assert.equal(owner, "fixture-A"); return chain; }, async maybeSingle() { calls++; return { data: { id, collections_state: snapshot }, error: fail ? { message: "synthetic" } : null }; } };
  return { db: { from(table: string) { assert.equal(table, "profiles"); return chain; } } as unknown as SupabaseClient, calls: () => calls };
}

test("profile recovery happens before a fresh-process retry, coalesces reads and never changes balances", async () => {
  const original = store();
  const input = { domain: "study" as const, duration_minutes: 5, idempotency_key: "fixture-profile-op" };
  const first = original.logSkillSession(input);
  const client = profileClient(serializeStoreCollections(original, "fixture-A"));
  const restarted = store();
  const before = [restarted.wallet_gp, restarted.vault_remaining_gp, restarted.current_xp];
  const one = recoverSkillSessionStateFromProfile(client.db, "fixture-A", restarted);
  const two = recoverSkillSessionStateFromProfile(client.db, "fixture-A", restarted);
  assert.equal(one, two);
  await one;
  const replay = restarted.logSkillSession(input);
  assert.equal(replay.session.id, first.session.id);
  assert.equal(replay.reward_impact.idempotent_replay, true);
  assert.deepEqual([restarted.wallet_gp, restarted.vault_remaining_gp, restarted.current_xp], before);
  assert.equal(client.calls(), 1);
  await assert.rejects(recoverSkillSessionStateFromProfile(client.db, "fixture-B", restarted));
});

test("foreign/corrupt/failed recovery cannot create a receipt, and a failed read can be retried", async () => {
  const target = store();
  const broken = profileClient({}, "fixture-A", true);
  await assert.rejects(recoverSkillSessionStateFromProfile(broken.db, "fixture-A", target));
  assert.equal(target.processedIdempotencyKeys.size, 0);
  const validLegacy = profileClient({});
  assert.equal(await recoverSkillSessionStateFromProfile(validLegacy.db, "fixture-A", target), false);
  const foreign = store("fixture-B");
  await assert.rejects(recoverSkillSessionStateFromProfile(profileClient({ skillSessionState: {} }).db, "fixture-A", foreign));
  assert.equal(foreign.processedIdempotencyKeys.size, 0);
});
