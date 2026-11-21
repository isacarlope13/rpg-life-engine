import { NextResponse } from "next/server";
import { requireFinanceOwner,financeWriteAllowed,validateFinanceItem,noStore } from "@/lib/finance/owner-ledger";
const tableMap={account:"owner_finance_accounts",debt:"owner_finance_debts",event:"owner_finance_events"} as const;
export async function GET(req: Request) {
  const owner=await requireFinanceOwner(req);
  if (!owner?.db) return NextResponse.json({error:"Unauthorized"},{status:401,headers:noStore});
  const keys=["transactions","accounts","debts","events"] as const;
  const tables=["owner_finance_transactions","owner_finance_accounts","owner_finance_debts","owner_finance_events"] as const;
  const out:Record<string,unknown>={ok:true};
  for(let i=0;i<tables.length;i++){
    let q=owner.db.from(tables[i]).select("*").eq("user_id",owner.userId).limit(2000);
    if(i===0)q=q.order("occurred_at",{ascending:false});
    const {data,error}=await q;
    if(error) return NextResponse.json({error:"Ledger unavailable; migration required"},{status:503,headers:noStore});
    out[keys[i]]=data||[];
  }
  return NextResponse.json(out,{headers:noStore});
}
export async function POST(req: Request) {
  const owner=await requireFinanceOwner(req);
  if(!owner?.db) return NextResponse.json({error:"Unauthorized"},{status:401,headers:noStore});
  if(!financeWriteAllowed(req)) return NextResponse.json({error:"Invalid request origin"},{status:403,headers:noStore});
  const body=await req.json().catch(()=>null) as {kind?:string;item?:unknown}|null;
  const kind=body?.kind||"";
  const table=tableMap[kind as keyof typeof tableMap];
  const cleaned=validateFinanceItem(kind,body?.item);
  if(!table || !cleaned) return NextResponse.json({error:"Invalid finance record"},{status:400,headers:noStore});
  const onConflict=kind==="event"?"user_id,label,expected_on,kind":kind==="debt"?"user_id,creditor":"user_id,label";
  const {error}=await owner.db.from(table).upsert({...cleaned,user_id:owner.userId},{onConflict});
  if(error)return NextResponse.json({error:"Save rejected"},{status:503,headers:noStore});
  return NextResponse.json({ok:true},{headers:noStore});
}
