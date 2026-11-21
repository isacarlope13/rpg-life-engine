import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { movementFingerprint,validateFinanceRow } from "../src/lib/finance/finance-validation.ts";
test("isolated PostgreSQL finance migration: ownership, idempotent import, persistence and reconciliation",async()=>{
 const db=await PGlite.create();
 const a="30000000-0000-4000-8000-000000000001",b="30000000-0000-4000-8000-000000000002";
 try{
  await db.exec("create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;");
  await db.query("insert into auth.users values ($1),($2)",[a,b]);
  const sql=readFileSync("supabase/owner_finance_ledger.sql","utf8");
  await db.exec(sql);await db.exec(sql);
  const auth=async(id:string)=>{await db.exec("reset role; set role authenticated;");await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);};
  const tables=["owner_finance_transactions","owner_finance_accounts","owner_finance_debts","owner_finance_events"];
  const count=async(t:string)=>Number((await db.query<{n:number}>("select count(*)::int as n from public."+t)).rows[0].n);
  await auth(a);
  for(const t of tables)assert.equal(await count(t),0);
  const rows=Array.from({length:130},(_,i)=>validateFinanceRow({date:"2025-01-01",kind:"expense",category:"Test",description:"Synthetic "+i,amountCop:i+1,paymentMethod:"Cash"})!);
  let n=0;
  for(let pass=0;pass<2;pass++){
   n=0;
   for(const row of rows){
    const r=await db.query("insert into public.owner_finance_transactions(user_id,fingerprint,occurred_at,kind,amount_cop) values($1,$2,'2025-01-01T12:00:00Z','expense',$3) on conflict(user_id,fingerprint) do nothing returning id",[a,movementFingerprint(row),row.amountCop]);
    n+=r.rows.length;
   }
   assert.equal(n,pass===0?130:0);
  }
  await db.query("insert into public.owner_finance_accounts(user_id,label,balance_cop,as_of_date) values($1,'Test cash',1234,'2025-02-03')",[a]);
  await db.query("insert into public.owner_finance_accounts(user_id,label,balance_cop,as_of_date) values($1,'test cash',2345,'2025-02-04') on conflict(user_id,label_key) do update set balance_cop=excluded.balance_cop,as_of_date=excluded.as_of_date",[a]);
  await assert.rejects(db.query("update public.owner_finance_accounts set as_of_date='2025-02-02'"));
  assert.equal(await count("owner_finance_accounts"),1);
  assert.equal(Number((await db.query<{balance_cop:number}>("select balance_cop from public.owner_finance_accounts")).rows[0].balance_cop),2345);
  assert.equal(await count("owner_finance_transactions"),130);
  await assert.rejects(db.query("insert into public.owner_finance_debts(user_id,creditor,principal_remaining_cop,amount_due_cop,status) values($1,'Synthetic',10,0,'settled')",[a]));
  await db.query("insert into public.owner_finance_debts(user_id,creditor,principal_remaining_cop,amount_due_cop,status) values($1,'Synthetic',100,10,'active')",[a]);
  await db.query("insert into public.owner_finance_events(user_id,label,expected_on,amount_cop,kind) values($1,'Expected test','2025-02-20',50,'income')",[a]);
  await db.query("update public.owner_finance_events set status='received'");
  assert.equal(await count("owner_finance_events"),1);assert.equal(await count("owner_finance_transactions"),130);
  await auth(b);
  for(const t of tables)assert.equal(await count(t),0);
  await assert.rejects(db.query("insert into public.owner_finance_accounts(user_id,label,balance_cop,as_of_date) values($1,'Spoof',1,'2025-02-03')",[a]));
  await db.query("update public.owner_finance_accounts set balance_cop=0 where user_id=$1",[a]);
  await auth(a);assert.equal(await count("owner_finance_transactions"),130);
  assert.equal(Number((await db.query<{balance_cop:number}>("select balance_cop from public.owner_finance_accounts")).rows[0].balance_cop),2345);
  await assert.rejects(db.query("delete from public.owner_finance_transactions"));
  await db.exec("reset role; set role anon;");
  for(const t of tables)await assert.rejects(db.query("select * from public."+t));
 }finally{await db.close();}
});
