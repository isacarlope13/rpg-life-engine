import { requireFinanceOwner,financeWriteAllowed,financeResponse,readFinanceJson,validateFinanceRow,movementFingerprint,planImport,transactionTimestamp,signPreview,verifyPreview } from "@/lib/finance/owner-ledger";

function bogotaDate():string{
  const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Bogota",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
  return ["year","month","day"].map(k=>parts.find(p=>p.type===k)?.value).join("-");
}
export async function POST(req:Request){
  const owner=await requireFinanceOwner(req);
  const reply=(body:unknown,status=200)=>financeResponse(owner,body,status);
  if(!owner)return reply({error:"Unauthorized"},401);
  if(!financeWriteAllowed(req))return reply({error:"Invalid request origin"},403);
  const secret=process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if(!secret)return reply({error:"Preview signing unavailable"},503);
  const payload=await readFinanceJson(req,300_000);
  if(!payload.ok)return reply({error:"Invalid or oversized payload"},payload.status);
  const body=payload.body as {mode?:string;rows?:unknown[];confirmed?:boolean;previewTicket?:unknown;source?:unknown}|null;
  if(!body||!["preview","commit"].includes(body.mode||"")||!Array.isArray(body.rows)||body.rows.length<1||body.rows.length>150)
    return reply({error:"Provide 1–150 rows and preview/commit mode"},400);
  const source=body.source===undefined?"csv":body.source;
  if(source!=="csv"&&source!=="manual")return reply({error:"Unknown source"},400);
  if(source==="manual"&&body.rows.length!==1)return reply({error:"Manual registration requires one row"},400);
  const parsed=body.rows.map(validateFinanceRow);
  if(parsed.some(v=>v===null))return reply({error:"Invalid rows; nothing imported"},400);
  const rows=parsed.filter((v):v is NonNullable<typeof v>=>v!==null);
  if(source==="manual"&&(!["expense","income"].includes(rows[0].kind)||!rows[0].description||!rows[0].paymentMethod||rows[0].date.slice(0,10)>bogotaDate()))
    return reply({error:"Manual entries require an actual income or expense, concept, payment method and non-future date"},400);
  const signingSecret=secret+"|finance-source:"+source;
  if(body.mode==="commit"&&(body.confirmed!==true||!verifyPreview(body.previewTicket,owner.userId,rows,signingSecret)))
    return reply({error:"Preview missing, altered or expired. Review again."},409);
  const fingerprints=[...new Set(rows.map(movementFingerprint))];
  const {data:existing,error:queryError}=await owner.db.from("owner_finance_transactions")
    .select("fingerprint").eq("user_id",owner.userId).in("fingerprint",fingerprints);
  if(queryError)return reply({error:"Ledger unavailable"},503);
  const {fresh,duplicateRows}=planImport(rows,new Set<string>((existing||[]).map(x=>x.fingerprint)));
  if(body.mode==="preview")return reply({
    ok:true,preview:true,received:rows.length,newCount:fresh.length,duplicateCount:duplicateRows.length,duplicateRows,
    incomingCop:fresh.filter(x=>x.row.kind==="income").reduce((a,x)=>a+x.row.amountCop,0),
    expenseCop:fresh.filter(x=>x.row.kind==="expense").reduce((a,x)=>a+x.row.amountCop,0),
    previewTicket:signPreview(owner.userId,rows,secret)
  });
  if(!fresh.length)return reply({ok:true,inserted:0,skipped:rows.length});
  const inserts=fresh.map(({row,fingerprint})=>({user_id:owner.userId,fingerprint,
    occurred_at:transactionTimestamp(row.date),kind:row.kind,category:row.category,description:row.description,
    amount_cop:row.amountCop,payment_method:row.paymentMethod,origin:source}));
  // The unique constraint and ON CONFLICT DO NOTHING are the concurrency-safe duplicate barrier.
  const {data,error}=await owner.db.from("owner_finance_transactions")
    .upsert(inserts,{onConflict:"user_id,fingerprint",ignoreDuplicates:true}).select("id");
  if(error)return reply({error:"Import failed; no success confirmed"},503);
  return reply({ok:true,inserted:data?.length||0,skipped:rows.length-(data?.length||0)});
}
