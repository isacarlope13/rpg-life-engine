import test from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { persistProfileCollections } from "../src/lib/profile-collections-persistence.ts";

function client(result: unknown, fail = false) {
  const calls: unknown[] = [];
  const chain = {
    update(value: unknown) { calls.push(["update", value]); return chain; },
    eq(field: string, value: string) { calls.push(["eq", field, value]); return chain; },
    select(field: string) { calls.push(["select", field]); return chain; },
    async maybeSingle() { if (fail) throw Error("synthetic network failure"); return result; },
  };
  return { calls, db: { from(table: string) { calls.push(["from", table]); return chain; } } as unknown as SupabaseClient };
}

test("profile persistence confirms exactly the authenticated profile row", async () => {
  const { db, calls } = client({ data: { id: "fixture-A" }, error: null });
  assert.deepEqual(await persistProfileCollections(db, "fixture-A", { books: [] }), { saved: true });
  assert.ok(calls.some(call => JSON.stringify(call) === JSON.stringify(["eq", "id", "fixture-A"])));
  assert.ok(calls.some(call => JSON.stringify(call) === JSON.stringify(["select", "id"])));
});

test("zero rows, foreign row, database errors and network failures never mean persisted", async () => {
  for (const value of [{ data: null, error: null }, { data: { id: "fixture-B" }, error: null }, { data: null, error: { message: "synthetic failure" } }]) {
    assert.equal((await persistProfileCollections(client(value).db, "fixture-A", {})).saved, false);
  }
  assert.equal((await persistProfileCollections(client(null, true).db, "fixture-A", {})).saved, false);
});
