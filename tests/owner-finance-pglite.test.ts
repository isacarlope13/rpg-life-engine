import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { movementFingerprint, validateFinanceRow } from "../src/lib/finance/finance-validation.ts";

test("isolated PostgreSQL finance migration: server-only lockdown, write integrity, strict idempotency & concurrency", async () => {
  const db = await PGlite.create();
  const ownerA = "30000000-0000-4000-8000-000000000001";
  const otherB = "30000000-0000-4000-8000-000000000002";
  const tables = [
    "owner_finance_transactions",
    "owner_finance_accounts",
    "owner_finance_debts",
    "owner_finance_events",
    "owner_finance_reserves",
  ];
  try {
    await db.exec(
      "create role anon; create role authenticated; create role service_role bypassrls; " +
      "create schema auth; create table auth.users(id uuid primary key); " +
      "create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; " +
      "grant usage on schema public to anon, authenticated, service_role; " +
      "grant usage on schema auth to authenticated, service_role; " +
      "grant execute on function auth.uid() to authenticated, service_role;"
    );
    await db.query("insert into auth.users values ($1),($2)", [ownerA, otherB]);

    // Apply migration twice to prove full DDL idempotency.
    const sql = readFileSync("supabase/owner_finance_ledger.sql", "utf8");
    await db.exec(sql);
    await db.exec(sql);

    const asService = async () => {
      await db.exec("reset role; set role service_role;");
    };
    const asAuthenticated = async (id: string) => {
      await db.exec("reset role; set role authenticated;");
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
    };
    const asAnon = async () => {
      await db.exec("reset role; set role anon;");
    };
    const count = async (t: string) =>
      Number((await db.query<{ n: number }>("select count(*)::int as n from public." + t)).rows[0].n);

    // 1. Server-only legitimate flows (CSV import + reconciliation + debts + events + reserves).
    await asService();
    for (const t of tables) assert.equal(await count(t), 0);

    const rows = Array.from({ length: 130 }, (_, i) =>
      validateFinanceRow({
        date: "2025-01-01",
        kind: "expense",
        category: "Test",
        description: "Synthetic " + i,
        amountCop: i + 1,
        paymentMethod: "Cash",
      })!
    );
    for (let pass = 0; pass < 2; pass++) {
      let inserted = 0;
      for (const row of rows) {
        const r = await db.query(
          "insert into public.owner_finance_transactions(user_id,fingerprint,occurred_at,kind,amount_cop) " +
          "values($1,$2,'2025-01-01T12:00:00Z','expense',$3) on conflict(user_id,fingerprint) do nothing returning id",
          [ownerA, movementFingerprint(row), row.amountCop]
        );
        inserted += r.rows.length;
      }
      assert.equal(inserted, pass === 0 ? 130 : 0);
    }

    await db.query(
      "insert into public.owner_finance_accounts(user_id,label,balance_cop,as_of_date) values($1,'Test cash',1234,'2025-02-03')",
      [ownerA]
    );
    await db.query(
      "insert into public.owner_finance_accounts(user_id,label,balance_cop,as_of_date) values($1,'Second cash',5000,'2025-02-03')",
      [ownerA]
    );
    await db.query(
      "insert into public.owner_finance_accounts(user_id,label,balance_cop,as_of_date) values($1,'test cash',2345,'2025-02-04') " +
      "on conflict(user_id,label_key) do update set balance_cop=excluded.balance_cop,as_of_date=excluded.as_of_date",
      [ownerA]
    );
    // Monotonic date guard + forced revision rotation.
    const accBeforeRev = (
      await db.query<{ id: string; revision: string; balance_cop: number }>(
        "select id,revision,balance_cop from public.owner_finance_accounts where label_key='test cash'"
      )
    ).rows[0];
    await assert.rejects(
      db.query("update public.owner_finance_accounts set as_of_date='2025-02-02' where id=$1", [accBeforeRev.id])
    );
    // Attempting to freeze revision explicitly is overwritten by trigger.
    await db.query(
      "update public.owner_finance_accounts set balance_cop=2345, revision=$2 where id=$1",
      [accBeforeRev.id, accBeforeRev.revision]
    );
    const acc1 = (
      await db.query<{ id: string; revision: string; balance_cop: number }>(
        "select id,revision,balance_cop from public.owner_finance_accounts where label_key='test cash'"
      )
    ).rows[0];
    assert.notEqual(acc1.revision, accBeforeRev.revision);

    const acc2 = (
      await db.query<{ id: string; revision: string; balance_cop: number }>(
        "select id,revision,balance_cop from public.owner_finance_accounts where label_key='second cash'"
      )
    ).rows[0];

    // Debts, events, reserves constraints.
    await assert.rejects(
      db.query(
        "insert into public.owner_finance_debts(user_id,creditor,principal_remaining_cop,amount_due_cop,status) values($1,'Synthetic',10,0,'settled')",
        [ownerA]
      )
    );
    await db.query(
      "insert into public.owner_finance_debts(user_id,creditor,principal_remaining_cop,amount_due_cop,status) values($1,'Synthetic',100,10,'active')",
      [ownerA]
    );
    await db.query(
      "insert into public.owner_finance_events(user_id,label,expected_on,amount_cop,kind) values($1,'Expected test','2025-02-20',50,'income')",
      [ownerA]
    );
    await db.query("update public.owner_finance_events set status='received' where user_id=$1", [ownerA]);
    await db.query(
      "insert into public.owner_finance_reserves(user_id,essential_cop,emergency_cop,horizon) values($1,222,33,'2025-02-21')",
      [ownerA]
    );
    await assert.rejects(
      db.query("update public.owner_finance_reserves set essential_cop=-1 where user_id=$1", [ownerA])
    );

    // 2. Write integrity: direct account-linked INSERT and tx UPDATE/DELETE are blocked even for service_role.
    await assert.rejects(
      db.query(
        "insert into public.owner_finance_transactions(user_id,fingerprint,occurred_at,kind,amount_cop,origin,account_id) " +
        "values($1,$2,'2025-02-05T12:00:00Z','expense',50,'manual',$3)",
        [ownerA, "a".repeat(64), acc1.id]
      ),
      /owner_finance_post_manual/
    );
    await assert.rejects(db.query("delete from public.owner_finance_transactions"));
    await assert.rejects(db.query("update public.owner_finance_transactions set amount_cop=1"));

    // 3. Strict idempotency & atomic posting via owner_finance_post_manual.
    const postCall =
      "select public.owner_finance_post_manual($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) as result";
    const fp1 = "e".repeat(64);
    const fp2 = "d".repeat(64);
    const fp3 = "c".repeat(64);

    // 3a. Normal atomic post.
    const posted = await db.query<{ result: { inserted: number; skipped: number; balanceUpdated: boolean; balanceCop: number } }>(
      postCall,
      [ownerA, acc1.id, acc1.revision, fp1, "2025-02-05T12:00:00Z", "expense", 100, "Test", "Fixture manual", "Cash"]
    );
    assert.equal(posted.rows[0].result.inserted, 1);
    assert.equal(posted.rows[0].result.balanceUpdated, true);
    assert.equal(Number(posted.rows[0].result.balanceCop), 2245);

    // 3b. Same fingerprint + identical content (with stale revision, simulating lost response & retry) => idempotent replay.
    const replay = await db.query<{ result: { inserted: number; skipped: number; balanceUpdated: boolean; balanceCop: number } }>(
      postCall,
      [ownerA, acc1.id, acc1.revision, fp1, "2025-02-05T12:00:00Z", "expense", 100, "Test", "Fixture manual", "Cash"]
    );
    assert.equal(replay.rows[0].result.inserted, 0);
    assert.equal(replay.rows[0].result.skipped, 1);
    assert.equal(replay.rows[0].result.balanceUpdated, false);
    assert.equal(Number(replay.rows[0].result.balanceCop), 2245);

    // 3c. Same fingerprint + DIFFERENT amount => explicit 23505 conflict.
    const acc1After1 = (
      await db.query<{ revision: string; balance_cop: number }>(
        "select revision,balance_cop from public.owner_finance_accounts where id=$1",
        [acc1.id]
      )
    ).rows[0];
    await assert.rejects(
      db.query(postCall, [ownerA, acc1.id, acc1After1.revision, fp1, "2025-02-05T12:00:00Z", "expense", 101, "Test", "Fixture manual", "Cash"]),
      (err: { code?: string }) => err.code === "23505"
    );

    // 3d. Same fingerprint + DIFFERENT account => explicit 23505 conflict.
    await assert.rejects(
      db.query(postCall, [ownerA, acc2.id, acc2.revision, fp1, "2025-02-05T12:00:00Z", "expense", 100, "Test", "Fixture manual", "Cash"]),
      (err: { code?: string }) => err.code === "23505"
    );

    // 3e. Stale account revision with NEW fingerprint => explicit 23514 rejection.
    await assert.rejects(
      db.query(postCall, [ownerA, acc1.id, acc1.revision, fp2, "2025-02-05T12:05:00Z", "expense", 50, "Test", "Stale rev", "Cash"]),
      (err: { code?: string }) => err.code === "23514"
    );

    // 3f. Second movement rotates revision; lost-response retry of fp1 with original acc1.revision STILL replays cleanly.
    const posted2 = await db.query<{ result: { inserted: number; balanceCop: number } }>(
      postCall,
      [ownerA, acc1.id, acc1After1.revision, fp2, "2025-02-05T12:10:00Z", "expense", 45, "Test", "Second manual", "Cash"]
    );
    assert.equal(posted2.rows[0].result.inserted, 1);
    assert.equal(Number(posted2.rows[0].result.balanceCop), 2200);
    const lateRetry = await db.query<{ result: { inserted: number; skipped: number; balanceUpdated: boolean; balanceCop: number } }>(
      postCall,
      [ownerA, acc1.id, acc1.revision, fp1, "2025-02-05T12:00:00Z", "expense", 100, "Test", "Fixture manual", "Cash"]
    );
    assert.equal(lateRetry.rows[0].result.inserted, 0);
    assert.equal(lateRetry.rows[0].result.skipped, 1);
    assert.equal(Number(lateRetry.rows[0].result.balanceCop), 2200);

    // 3g. Concurrent identical submissions on same account => single debit, no double charge.
    const acc1Latest = (
      await db.query<{ revision: string }>(
        "select revision from public.owner_finance_accounts where id=$1",
        [acc1.id]
      )
    ).rows[0];
    const [c1, c2] = await Promise.all([
      db.query<{ result: { inserted: number; skipped: number } }>(postCall, [ownerA, acc1.id, acc1Latest.revision, fp3, "2025-02-05T12:20:00Z", "expense", 200, "Test", "Concurrent", "Cash"]),
      db.query<{ result: { inserted: number; skipped: number } }>(postCall, [ownerA, acc1.id, acc1Latest.revision, fp3, "2025-02-05T12:20:00Z", "expense", 200, "Test", "Concurrent", "Cash"]),
    ]);
    assert.equal(c1.rows[0].result.inserted + c2.rows[0].result.inserted, 1);
    assert.equal(c1.rows[0].result.skipped + c2.rows[0].result.skipped, 1);
    const balAfterConcurrent = Number(
      (await db.query<{ balance_cop: number }>("select balance_cop from public.owner_finance_accounts where id=$1", [acc1.id])).rows[0].balance_cop
    );
    assert.equal(balAfterConcurrent, 2000);

    // 3h. Overdraft rejected & cross-owner account rejected.
    const acc1FinalRev = (
      await db.query<{ revision: string }>(
        "select revision from public.owner_finance_accounts where id=$1",
        [acc1.id]
      )
    ).rows[0];
    await assert.rejects(
      db.query(postCall, [ownerA, acc1.id, acc1FinalRev.revision, "b".repeat(64), "2025-02-05T12:30:00Z", "expense", 9999, "Test", "Overdraft", "Cash"]),
      (err: { code?: string }) => err.code === "23514"
    );
    await assert.rejects(
      db.query(postCall, [otherB, acc1.id, acc1FinalRev.revision, "b".repeat(64), "2025-02-05T12:30:00Z", "expense", 1, "Test", "Cross owner", "Cash"]),
      (err: { code?: string }) => err.code === "42501"
    );

    // 4. Direct PostgREST lockdown: authenticated (BOTH second identity AND owner JWT) & anon are 100% blocked.
    for (const uid of [otherB, ownerA]) {
      await asAuthenticated(uid);
      for (const t of tables) {
        await assert.rejects(db.query("select * from public." + t), (err: { code?: string }) => err.code === "42501");
      }
      await assert.rejects(
        db.query("insert into public.owner_finance_accounts(user_id,label,balance_cop,as_of_date) values($1,'Direct',1,'2025-02-03')", [uid]),
        (err: { code?: string }) => err.code === "42501"
      );
      await assert.rejects(
        db.query("update public.owner_finance_accounts set balance_cop=0"),
        (err: { code?: string }) => err.code === "42501"
      );
      await assert.rejects(
        db.query(postCall, [uid, acc1.id, acc1FinalRev.revision, "f".repeat(64), "2025-02-05T12:35:00Z", "expense", 1, "Test", "Direct RPC", "Cash"]),
        (err: { code?: string }) => err.code === "42501"
      );
    }

    await asAnon();
    for (const t of tables) {
      await assert.rejects(db.query("select * from public." + t), (err: { code?: string }) => err.code === "42501");
    }
    await assert.rejects(
      db.query(postCall, [ownerA, acc1.id, acc1FinalRev.revision, "f".repeat(64), "2025-02-05T12:35:00Z", "expense", 1, "Test", "Anon RPC", "Cash"]),
      (err: { code?: string }) => err.code === "42501"
    );

    // Verify zero tampering occurred.
    await asService();
    assert.equal(await count("owner_finance_transactions"), 133);
    assert.equal(
      Number((await db.query<{ balance_cop: number }>("select balance_cop from public.owner_finance_accounts where id=$1", [acc1.id])).rows[0].balance_cop),
      2000
    );
  } finally {
    await db.close();
  }
});
