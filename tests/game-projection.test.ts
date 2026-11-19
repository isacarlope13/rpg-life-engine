import test from "node:test";
import assert from "node:assert/strict";
import { projectRpgReadModel } from "../src/game/domain/projection.ts";

const fixture = () => ({
  player_level: 7, current_xp: 12.5, wallet_gp: -23.75, vault_remaining_gp: 999.125,
  skill_summaries: [{ domain: "reading", label: "Lectura", level: 3, total_xp: 320 }],
  quests: [{ id: "quest-1", code: "READ", title: "Leer por gusto", status: "completed", reward_gp: 100, reward_xp: 50 }],
  reading_books: [{ id: "shared", title: "Libro propio" }],
  work_projects: [{ id: "shared", name: "Proyecto propio" }],
  knitting_projects: [{ id: "shared", name: "Mi tejido" }],
  email: "synthetic@example.invalid", shortcut_api_key: "fixture-do-not-copy",
});
function project(state: unknown) {
  const result = projectRpgReadModel({ source: "fixture", ownerId: "fixture-A", state }, "fixture-A");
  assert.equal(result.ok, true);
  if (!result.ok) throw Error("Unexpected rejection");
  return result.projection;
}

test("authoritative values are copied exactly without recomputing levels, XP or balances", () => {
  const result = project(fixture());
  assert.equal(result.source, "fixture");
  assert.equal(result.status, "ready");
  assert.deepEqual(result.progress, { level: 7, currentXp: 12.5, walletGp: -23.75, vaultRemainingGp: 999.125 });
  assert.deepEqual(result.skills, [{ domain: "reading", label: "Lectura", level: 3, totalXp: 320 }]);
  assert.deepEqual(result.quests, [{ sourceQuestId: "quest-1", label: "Leer por gusto", objective: "Leer por gusto", status: "completed", progressLabel: "Completada", openExistingQuestActionId: "existing-quest:quest-1" }]);
  assert.equal(JSON.stringify(result).includes("fixture-do-not-copy"), false);
  assert.equal(JSON.stringify(result).includes("synthetic@example.invalid"), false);
});

test("old quests retain their code but missing status never implies completion or availability", () => {
  const state = fixture();
  const old = { ...state, quests: [{ code: "OLD", title: "Misión antigua" }] };
  const result = project(old);
  assert.equal(result.status, "degraded");
  assert.equal(result.quests[0].sourceQuestId, "OLD");
  assert.equal(result.quests[0].status, "unavailable");
  assert.ok(result.issues.includes("quest:OLD:unknown-status"));
});

test("missing and malformed snapshots stay visibly unknown, never zeroed or provisioned", () => {
  for (const snapshot of [null, undefined, [], {}, { wallet_gp: "100", current_xp: NaN, player_level: Infinity, vault_gp: 123 }]) {
    const result = project(snapshot);
    assert.equal(result.status, "degraded");
    assert.deepEqual(result.progress, { level: null, currentXp: null, walletGp: null, vaultRemainingGp: null });
    assert.deepEqual(result.skills, []);
    assert.deepEqual(result.quests, []);
  }
  assert.equal(project({ ...fixture(), current_xp: -1 }).progress.currentXp, null);
});

test("owner mismatch rejects before observing the snapshot, without global fallback", () => {
  const state = { get wallet_gp() { throw Error("must not access another owner"); } };
  assert.deepEqual(projectRpgReadModel({ source: "fixture", ownerId: "fixture-A", state }, "fixture-B"), { ok: false, reason: "owner-mismatch" });
  assert.equal(projectRpgReadModel({ source: "fixture", ownerId: "", state }, "").ok, false);
});

test("inventory preserves source IDs and disambiguates collections without adding rewards", () => {
  const result = project(fixture());
  const entries = result.inventory.groups[0].entries;
  assert.equal(result.inventory.ownerId, result.ownerId);
  assert.deepEqual(entries.map(e => e.source), [{ kind: "book", id: "shared" }, { kind: "project", id: "shared" }, { kind: "skill-resource", id: "shared" }]);
  assert.equal(new Set(entries.map(e => e.viewId)).size, 3);
  assert.equal("existingRewardLabel" in result.quests[0], false);
});

test("projection is deeply immutable, detached and does not change its input", () => {
  const state = fixture();
  const before = structuredClone(state);
  const result = project(state);
  assert.deepEqual(state, before);
  assert.equal(Object.isFrozen(state), false);
  state.skill_summaries[0].label = "Changed";
  state.reading_books[0].title = "Changed";
  assert.equal(result.skills[0].label, "Lectura");
  assert.equal(result.inventory.groups[0].entries[0].label, "Libro propio");
  assert.throws(() => { Object.assign(result.progress, { walletGp: 100000 }); }, TypeError);
  assert.throws(() => { Object.assign(result.inventory.groups[0].entries[0].source, { id: "other" }); }, TypeError);
});

test("invalid rows and duplicate IDs are reported instead of generating invented identities", () => {
  const state = fixture();
  const result = project({ ...state,
    quests: [null, {}, ...state.quests, ...state.quests],
    skill_summaries: [null, ...state.skill_summaries, ...state.skill_summaries],
    reading_books: [{ title: "Missing ID" }, ...state.reading_books, ...state.reading_books],
  });
  assert.equal(result.status, "degraded");
  assert.equal(result.quests.length, 1);
  assert.equal(result.skills.length, 1);
  assert.equal(result.inventory.groups[0].entries.length, 3);
  assert.ok(result.issues.includes("reading_books:invalid-or-duplicate-identity"));
});
