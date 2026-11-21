import { requireFinanceOwner,financeWriteAllowed,financeResponse,readFinanceJson,validateFinanceItem } from "@/lib/finance/owner-ledger";

const tableMap={account:"owner_finance_accounts",debt:"owner_finance_debts",event:"owner_finance_events",reserve:"owner_finance_reserves"} as const;
export async function GET(req:Request){
  const owner=await requireFinanceOwner(req);
  const reply=(body:unknown,status=200)=>financeResponse(owner,body,status);
  if(!owner)return reply({error:"Unauthorized"},401);
  const keys=["transactions","accounts","debts","events","reserves"] as const;
  const tables=["owner_finance_transactions","owner_finance_accounts","owner_finance_debts","owner_finance_events","owner_finance_reserves"] as const;
  const out:Record<string,unknown>={ok:true};
  // Paginate each table; PostgREST may impose a 1000-row limit. Fail explicitly at the safety cap.
  for(let i=0;i<tables.length;i++){
    const all:unknown[]=[];
    for(let offset=0;offset<10_000;offset+=500){
      let q=owner.db.from(tables[i]).select("*").eq("user_id",owner.userId);
      if(i===0)q=q.order("occurred_at",{ascending:false});
      const {data,error}=await q.order(i===4?"user_id":"id").range(offset,offset+499);
      if(error)return reply({error:"Ledger unavailable"},503);
      all.push(...(data||[]));
      if(!data||data.length<500)break;
    }
    if(all.length>=10_000)return reply({error:"Ledger exceeds display limit; review pagination"},503);
    out[keys[i]]=all;
  }
  return reply(out);
}
export async function POST(req:Request){
  const owner=await requireFinanceOwner(req);
  const reply=(body:unknown,status=200)=>financeResponse(owner,body,status);
  if(!owner)return reply({error:"Unauthorized"},401);
  if(!financeWriteAllowed(req))return reply({error:"Invalid request origin"},403);
  const payload=await readFinanceJson(req,8_192);
  if(!payload.ok)return reply({error:"Invalid or oversized payload"},payload.status);
  const body=payload.body as {kind?:string;item?:unknown}|null;
  const kind=body?.kind;
  if(kind!=="account"&&kind!=="debt"&&kind!=="event"&&kind!=="reserve")return reply({error:"Invalid finance record"},400);
  const table=tableMap[kind],cleaned=validateFinanceItem(kind,body?.item);
  if(!cleaned)return reply({error:"Invalid finance record"},400);
  const onConflict=kind==="reserve"?"user_id":kind==="event"?"user_id,label_key,expected_on,kind":kind==="debt"?"user_id,creditor_key":"user_id,label_key";
  const {error}=await owner.db.from(table).upsert({...cleaned,user_id:owner.userId},{onConflict});
  if(error)return reply({error:error.code==="23514"?"Invalid balance, stale snapshot or constraint violation":"Save rejected"},error.code==="23514"?409:503);
  return reply({ok:true});
}
