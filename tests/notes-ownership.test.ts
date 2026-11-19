import test from "node:test";
import assert from "node:assert/strict";
import { readOwnedNotes, saveOwnedNotes } from "../src/lib/sanctuary/use-owned-notes.ts";

test("notes require owner, preserve legacy, reject foreign envelopes and report storage failure", () => {
  const rows = new Map<string, string>();
  const storage = { getItem: (key: string) => rows.get(key) ?? null, setItem: (key: string, value: string) => { rows.set(key, value); } };
  rows.set("cozy_oakhaven_notes_v1", "legacy-note-for-recovery");
  assert.deepEqual(readOwnedNotes(storage), []);
  assert.equal(saveOwnedNotes(storage, undefined, ["must not save"]), false);
  assert.equal(saveOwnedNotes(storage, "fixture-A", ["A note"]), true);
  assert.deepEqual(readOwnedNotes(storage, "fixture-A"), ["A note"]);
  assert.deepEqual(readOwnedNotes(storage, "fixture-B"), []);
  saveOwnedNotes(storage, "fixture-B", ["B note"]);
  saveOwnedNotes(storage, "fixture-B", []);
  assert.deepEqual(readOwnedNotes(storage, "fixture-A"), ["A note"]);
  assert.equal(rows.get("cozy_oakhaven_notes_v1"), "legacy-note-for-recovery");
  rows.set("cozy_oakhaven_notes_v2_fixture-B", JSON.stringify({ ownerId: "fixture-A", notes: ["foreign"] }));
  assert.deepEqual(readOwnedNotes(storage, "fixture-B"), []);
  const before = rows.get("cozy_oakhaven_notes_v2_fixture-B");
  assert.equal(saveOwnedNotes(storage, "fixture-B", ["overwrite"]), false);
  assert.equal(rows.get("cozy_oakhaven_notes_v2_fixture-B"), before);
  const failed = { getItem: () => null, setItem: () => false };
  assert.equal(saveOwnedNotes(failed, "fixture-A", ["unsaved"]), false);
});
