import { NextResponse } from "next/server";
import { requireFinanceOwner, financeWriteAllowed, validateFinanceRow, movementFingerprint, noStore } from "@/lib/finance/owner-ledger";

const maxBatch = 150;
export async function POST(req: Request) {
  const owner = await requireFinanceOwner(req);
  if (!owner?.db) return NextResponse.json({error:"Unauthorized"}, {status:401,headers:noStore});
  if (!financeWriteAllowed(req)) return NextResponse.json({error:"Invalid request origin"}, {status:403,headers:noStore});
  if (Number(req.headers.get("content-length")||"0") > 300_000) return NextResponse.json({error:"Payload too large"},{status:413,headers:noStore});
  const raw=await req.text().catch(()=>"");
  if(raw.length>300_000)return NextResponse.json({error:"Payload too large"},{status:413,headers:noStore});
  const body=(()=>{try{return JSON.parse(raw)}catch{return null}})() as { mode?:string; rows?:unknown[] }|null;
  if (!body || !["preview","commit"].includes(body.mode||"") || !Array.isArray(body.rows) ||
      body.rows.length===0 || body.rows.length>maxBatch)
    return NextResponse.json({error:"Provide 1–150 rows and preview/commit mode"}, {status:400,headers:noStore});
  const parsed=body.rows.map(validateFinanceRow);
  if(parsed.some(x=>x===null)) return NextResponse.json({error:"Invalid rows; nothing imported"},{status:400,headers:noStore});
  const rows=parsed.filter((v):v is NonNullable<typeof v>=>v!==null);
  const fingerprints=rows.map(movementFingerprint);
  // Duplicate detection both within file and already persisted for the owner.
  const {data:existing,error:queryError}=await owner.db.from("owner_finance_transactions")
    .select("fingerprint").eq("user_id",owner.userId).in("fingerprint",[...new Set(fingerprints)]);
  if(queryError) return NextResponse.json({error:"Ledger unavailable; run migration before importing"},{status:503,headers:noStore});
  const existingSet=new Set((existing||[]).map(x=>x.fingerprint));
  const seen=new Set<string>();
  const duplicates: number[]=[];
  const fresh=rows.flatMap((row,index)=>{
    const fingerprint=fingerprints[index];
    if(existingSet.has(fingerprint)||seen.has(fingerprint)){duplicates.push(index);return [];}
    seen.add(fingerprint);
    return [{user_id:owner.userId,fingerprint,
      occurred_at:(row.date.length===10?row.date+"T12:00:00-05:00":row.date.replace(" ","T")+":00-05:00"),
      kind:row.kind,category:row.category,description:row.description,
      amount_cop:row.amountCop,payment_method:row.paymentMethod,origin:"csv"}];
  });
  // Never touch the database on preview.
  if(body.mode==="preview") return NextResponse.json({
    ok:true,preview:true,received:rows.length,newCount:fresh.length,
    duplicateCount:duplicates.length,duplicateRows:duplicates,
    incomingCop:fresh.filter(r=>r.kind==="income").reduce((a,r)=>a+r.amount_cop,0),
    expenseCop:fresh.filter(r=>r.kind==="expense").reduce((a,r)=>a+r.amount_cop,0)
  },{headers:noStore});
  if(fresh.length===0) return NextResponse.json({ok:true,inserted:0,skipped:duplicates.length},{headers:noStore});
  const {data,error}=await owner.db.from("owner_finance_transactions")
    .upsert(fresh,{onConflict:"user_id,fingerprint",ignoreDuplicates:true})
    .select("id");
  if(error) return NextResponse.json({error:"Import failed; no success confirmed"},{status:503,headers:noStore});
  return NextResponse.json({ok:true,inserted:data?.length||0,skipped:rows.length-(data?.length||0)},
    {headers:noStore});
}
