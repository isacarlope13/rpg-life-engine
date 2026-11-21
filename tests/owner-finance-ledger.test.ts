import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const load=(p:string)=>readFileSync(new URL(p, import.meta.url),"utf8");

test("finance migration defines RLS + owner-scoped unique indexes",()=>{
 const sql=load("../supabase/owner_finance_ledger.sql");
 for(const table of ["owner_finance_transactions","owner_finance_accounts","owner_finance_debts","owner_finance_events"]){
   assert.match(sql,new RegExp("create table if not exists public\\."+table));
 }
 assert.match(sql,/enable row level security/);
 assert.match(sql,/auth\.uid\(\) = user_id/);
 assert.match(sql,/unique \(user_id, fingerprint\)/);
 assert.doesNotMatch(sql,/\binsert into\s+public\.owner_finance/i,"No personal ledger seeds are allowed");
});

test("finance endpoints require owner, origin and explicit write header",()=>{
 const importRoute=load("../src/app/api/finance/import/route.ts");
 const ledgerRoute=load("../src/app/api/finance/ledger/route.ts");
 const helper=load("../src/lib/finance/owner-ledger.ts");
 for(const route of [importRoute,ledgerRoute]){
   assert.match(route,/requireFinanceOwner\(req\)/);
   assert.match(route,/financeWriteAllowed\(req\)/);
   assert.match(route,/user_id:owner\.userId/);
   assert.match(route,/headers:noStore/);
 }
 assert.match(helper,/isAuthorizedSupabaseUserId/);
 assert.match(helper,/x-oakhaven-finance-write/);
 assert.match(importRoute,/body\.mode==="preview"/);
 assert.match(importRoute,/movementFingerprint/);
 assert.match(importRoute,/ignoreDuplicates:true/);
});

test("import UI requires explicit review and excludes forecast from current liquidity",()=>{
 const ui=load("../src/app/finance/page.tsx");
 assert.match(ui,/!checked\\|\\|preview\\.newCount===0/);
 assert.match(ui,/newCount===0/);
 assert.match(ui,/Ingresos esperados \(no disponibles\)/);
 assert.match(ui,/opening_balance/);
 assert.doesNotMatch(ui,/372879|43000|600000|1000000|120000/,"Never embed private figures as defaults");
});
