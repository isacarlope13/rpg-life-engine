import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { normalizeFinanceDate, validateFinanceRow, validateFinanceItem, movementFingerprint, planImport, signPreview, verifyPreview, transactionTimestamp } from "../src/lib/finance/finance-validation.ts";
import { parseFinanceCsv } from "../src/lib/finance/csv.ts";
const load=(p:string)=>readFileSync(new URL(p,import.meta.url),"utf8");
const row=validateFinanceRow({date:"2025-02-03 7:00",kind:"expense",category:"Example",description:"Synthetic transaction",amountCop:12345,paymentMethod:"Cash"})!;
test("finance migration keeps owner RLS and contains no data seeds",()=>{
 const sql=load("../supabase/owner_finance_ledger.sql");
 assert.match(sql,/enable row level security/);assert.match(sql,/auth\.uid\(\) = user_id/);
 assert.match(sql,/unique \(user_id, fingerprint\)/);
 assert.doesNotMatch(sql,/\binsert into\s+public\.owner_finance/i);
});
test("routes use owner session, CSRF, bounded payload and authenticated preview",()=>{
 const route=load("../src/app/api/finance/import/route.ts");
 const helper=load("../src/lib/finance/owner-ledger.ts");
 assert.match(route,/requireFinanceOwner\(req\)/);assert.match(route,/financeWriteAllowed\(req\)/);
 assert.match(route,/verifyPreview/);assert.match(route,/ignoreDuplicates:true/);
 assert.match(helper,/isAuthorizedSupabaseUserId/);assert.match(helper,/value.byteLength/);
 assert.match(helper,/buildAuthSetCookieHeaders/);
});
test("strict dates and money, opening balances are not income",()=>{
 assert.equal(normalizeFinanceDate("2025-02-03 7:00"),"2025-02-03 07:00");
 for(const d of ["2025-02-30","2025-03-02 24:00","2025-03-02 12:60"])assert.equal(normalizeFinanceDate(d),null);
 assert.equal(transactionTimestamp("2025-02-03 07:00"),"2025-02-03T07:00:00-05:00");
 assert.equal(validateFinanceRow({...row,amountCop:7.5}),null);
 assert.equal(validateFinanceRow({...row,kind:"unknown"}),null);
 assert.equal(validateFinanceRow({...row,kind:"income",description:"Inicial cuenta"})?.kind,"opening_balance");
 assert.equal(validateFinanceItem("debt",{creditor:"Test",principalRemainingCop:23,amountDueCop:0,status:"settled"}),null);
});
test("CSV parses local hour, quoted commas and COP without silently rounding",()=>{
 const header="Fecha,Tipo,Categoría,Monto,Descripción,Método de Pago\n";
 assert.equal(parseFinanceCsv(header+'2025-02-03 7:00,Gasto,Test,"$1,234.00","a,b",Efectivo')[0].amountCop,1234);
 for(const line of ["2025-02-03,Bogus,Test,100,x,Cash","2025-02-03,Gasto,Test,1.25,x,Cash","2025-02-03,Gasto,Test,100,x,Cash,extra"])
  assert.throws(()=>parseFinanceCsv(header+line));
});
test("dedup repeated batch, within-file and persisted, never conflates different amounts",()=>{
 const different={...row,amountCop:12346};
 let p=planImport([row,row,different],new Set());
 assert.equal(p.fresh.length,2);assert.deepEqual(p.duplicateRows,[1]);
 p=planImport([row,different],new Set([movementFingerprint(row),movementFingerprint(different)]));
 assert.equal(p.fresh.length,0);
 const equivalent=validateFinanceRow({...row,date:"2025-02-03T07:00",category:" example "})!;
 assert.equal(movementFingerprint(row),movementFingerprint(equivalent));
});
test("preview expiry, tampering, and foreign owner are rejected",()=>{
 const now=Date.now(),secret="fixture-only-signing-secret";
 const ticket=signPreview("owner-a",[row],secret,now);
 assert.ok(verifyPreview(ticket,"owner-a",[row],secret,now));
 assert.equal(verifyPreview(ticket,"owner-b",[row],secret,now),false);
 assert.equal(verifyPreview(ticket,"owner-a",[{...row,amountCop:1}],secret,now),false);
 assert.equal(verifyPreview(ticket,"owner-a",[row],secret,now+600001),false);
});
test("UI confirmation and forecasts remain separate",()=>{
 const ui=load("../src/components/finance/private-finance-panel.tsx");
 assert.match(ui,/!checked\|\|preview\.newCount===0/);
 assert.match(ui,/Ingresos esperados \(no disponibles\)/);
 assert.match(ui,/confirmed:mode==="commit"&&checked/);
 assert.match(ui,/Sin verificar/);
});

test("bank, private route and classic finance tab use one ledger; state does not inject history",()=>{
 const panel=load("../src/components/finance/private-finance-panel.tsx");
 for(const file of ["../src/app/finance/page.tsx","../src/components/sanctuary/bank-building.tsx","../src/components/rpg-dashboard.tsx"]){const src=load(file);assert.match(src, /<PrivateFinancePanel/);assert.doesNotMatch(src, /INITIAL_FINANCIAL_MOVEMENTS/);}
 assert.match(panel,/fetch\("\/api\/finance\/ledger"/);
 const state=load("../src/lib/state-builder.ts");assert.doesNotMatch(state,/financial_movements:\s*INITIAL_FINANCIAL_MOVEMENTS/);
 assert.match(load("../src/lib/demo-store.ts"),/store\.financialMovements = \[\]/);
});

import { projectCashflow } from "../src/lib/finance/cashflow.ts";
test("cashflow protects reserve; overdue debts are due today and same-day debit precedes expected salary",()=>{
 const p=projectCashflow({today:"2025-01-08",until:"2025-01-20",accounts:[{balance_cop:1000,as_of_date:"2025-01-08"}],reserveCop:400,
 debts:[{id:"one",creditor:"Test A",amount_due_cop:200,due_date:"2025-01-02",status:"overdue"},{id:"two",creditor:"Test B",amount_due_cop:500,due_date:"2025-01-20",status:"active"}],
 events:[{id:"one",label:"Possible salary",expected_on:"2025-01-20",amount_cop:800,kind:"income",status:"expected"},{id:"two",label:"Possible duplicate installment",expected_on:"2025-01-20",amount_cop:500,kind:"expense",status:"expected"}],additionalExpenseIds:[]});
 assert.equal(p.startingAfterReserve,600);assert.equal(p.timeline[0].date,"2025-01-08");
 assert.equal(p.timeline[1].kind,"debt");assert.equal(p.timeline[2].kind,"income");
 assert.equal(p.finalWithoutExpected,-100);assert.equal(p.finalWithExpected,700);
 assert.equal(p.maximumShortfallWithExpected,100);assert.deepEqual(p.unreviewedExpenseIds,["two"]);
});
test("cashflow excludes received or stale expected income, settled debts and items outside horizon",()=>{
 const p=projectCashflow({today:"2025-01-08",until:"2025-01-20",accounts:[{balance_cop:"1000",as_of_date:"2025-01-07"}],reserveCop:500,
 debts:[{id:"one",creditor:"Test",amount_due_cop:100,due_date:null,status:"active"},{id:"two",creditor:"Settled",amount_due_cop:0,due_date:null,status:"settled"}],
 events:[{id:"past",label:"Unconfirmed past",expected_on:"2025-01-01",amount_cop:400,kind:"income",status:"expected"},{id:"received",label:"Already reconciled",expected_on:"2025-01-10",amount_cop:600,kind:"income",status:"received"},{id:"later",label:"Outside horizon",expected_on:"2025-02-01",amount_cop:100,kind:"expense",status:"expected"},{id:"expense",label:"Extra expense",expected_on:"2025-01-15",amount_cop:75,kind:"expense",status:"expected"}],additionalExpenseIds:["expense","later"]});
 assert.equal(p.timeline.length,2);assert.equal(p.finalWithExpected,325);assert.equal(p.finalWithoutExpected,325);
 assert.ok(p.timeline[0].undated);assert.ok(p.issues.some(i=>i.includes("fecha distinta")));
 assert.throws(()=>projectCashflow({today:"2025-02-30",until:"2025-03-20",accounts:[],debts:[],events:[],reserveCop:0,additionalExpenseIds:[]}));
});
test("bank preserves LivingInteriorRoom and suppresses unverified specialist panels",()=>{
 const bank=load("../src/components/sanctuary/bank-building.tsx");
 assert.match(bank,/<LivingInteriorRoom/);assert.match(bank,/hideSpecialistAndLibrary/);
});

import { legacyFinanceHeld, isLegacyFinancialSkillAction, legacyFinanceHoldResponse } from "../src/lib/finance/guardian.ts";
test("guardian fails closed for private or cloud economy, permits isolated development only",async()=>{
 assert.equal(legacyFinanceHeld("supabase",{NODE_ENV:"test"}),true);
 assert.equal(legacyFinanceHeld("local_engine",{NODE_ENV:"production"}),true);
 assert.equal(legacyFinanceHeld("local_engine",{NODE_ENV:"test",OAKHAVEN_OWNER_USER_ID:"invalid"}),true);
 assert.equal(legacyFinanceHeld("local_engine",{NODE_ENV:"test"}),false);
 const r=legacyFinanceHoldResponse();assert.equal(r.status,409);
 assert.equal((await r.json()).code,"PRIVATE_FINANCE_RECONCILIATION_REQUIRED");
});
test("guardian distinguishes real economy actions from normal skills and library records",()=>{
 for(const action of ["redeem_wishlist","purify_boss","limit_break","set_debt_strategy","import_backup"])
  assert.equal(isLegacyFinancialSkillAction({action}),true);
 assert.equal(isLegacyFinancialSkillAction({action:"add_book",record_purchase_in_treasury:true}),true);
 assert.equal(isLegacyFinancialSkillAction({action:"add_cube",record_purchase_in_treasury:true}),true);
 for(const action of ["log_session","new_scramble","add_book","add_knitting_project","add_work_project_task"])
  assert.equal(isLegacyFinancialSkillAction({action}),false);
});
test("legacy finance handlers guard writes, while omni habit branch stays available",()=>{
 for(const path of ["quick-expense","receipt-scan","boss-counterattack","omni","skill-session"]){
  const src=load("../src/app/api/shortcuts/"+path+"/route.ts");
  assert.match(src,/legacyFinanceHeld\(authCtx.mode\)/);
  assert.match(src,/return legacyFinanceHoldResponse\(\)/);
 }
 const omni=load("../src/app/api/shortcuts/omni/route.ts");
 assert.ok(omni.indexOf('detected.intent === "habit_session"')<omni.indexOf("if (legacyFinanceHeld(authCtx.mode))"));
 const skill=load("../src/app/api/shortcuts/skill-session/route.ts");
 assert.ok(skill.indexOf("isLegacyFinancialSkillAction(body)")<skill.indexOf('if (body.action === "redeem_wishlist"'));
});
