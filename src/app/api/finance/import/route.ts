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
  const body=payload.body as {mode?:string;rows?:unknown[];confirmed?:boolean;previewTicket?:unknown;source?:unknown;accountId?:unknown;accountRevision?:unknown}|null;
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
  const accountId=body.accountId==null?null:body.accountId;
  const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if(accountId!==null&&(source!=="manual"||typeof accountId!=="string"||!UUID.test(accountId)))
    return reply({error:"Invalid account selection"},400);
  let accountRevision:string|null=null;
  let accountPreview:{label:string;before:number;after:number;revision:string}|null=null;
  if(accountId!==null){
    if(rows[0].date.length!==16||Date.parse(transactionTimestamp(rows[0].date))>Date.now())
      return reply({error:"Provide the actual date and time of the completed movement"},400);
    if(body.mode==="preview"){
      const {data:account,error}=await owner.db.from("owner_finance_accounts")
        .select("label,balance_cop,as_of_date,revision").eq("user_id",owner.userId).eq("id",accountId).maybeSingle();
      if(error||!account)return reply({error:"Account unavailable"},409);
      const before=Number(account.balance_cop),after=before+(rows[0].kind==="income"?rows[0].amountCop:-rows[0].amountCop);
      if(rows[0].date.slice(0,10)<account.as_of_date||!Number.isSafeInteger(after)||after<0||after>100_000_000_000)
        return reply({error:"Movement predates reconciliation or produces an invalid balance. Review the account first."},409);
      accountRevision=account.revision;
      accountPreview={label:account.label,before,after,revision:account.revision};
    }else{
      if(typeof body.accountRevision!=="string"||!UUID.test(body.accountRevision))return reply({error:"Account preview required"},409);
      accountRevision=body.accountRevision;
    }
  }
  const signingSecret=secret+"|finance-source:"+source+"|account:"+(accountId||"none")+"|revision:"+(accountRevision||"none");
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
    accountPreview:fresh.length?accountPreview:null,
    previewTicket:signPreview(owner.userId,rows,signingSecret)
  });
  if(!fresh.length)return reply({ok:true,inserted:0,skipped:rows.length,balanceUpdated:false});
  if(accountId!==null){
    const row=rows[0];
    const {data,error}=await owner.db.rpc("owner_finance_post_manual",{
      p_account_id:accountId,p_expected_revision:accountRevision,p_fingerprint:movementFingerprint(row),
      p_occurred_at:transactionTimestamp(row.date),p_kind:row.kind,p_amount_cop:row.amountCop,
      p_category:row.category,p_description:row.description,p_payment_method:row.paymentMethod
    });
    if(error)return reply({error:"Account posting rejected; review the latest reconciliation and preview again."},error.code==="23514"||error.code==="42501"||error.code==="22023"?409:503);
    return reply({ok:true,...data});
  }
  const inserts=fresh.map(({row,fingerprint})=>({user_id:owner.userId,fingerprint,
    occurred_at:transactionTimestamp(row.date),kind:row.kind,category:row.category,description:row.description,
    amount_cop:row.amountCop,payment_method:row.paymentMethod,origin:source}));
  // The unique constraint and ON CONFLICT DO NOTHING are the concurrency-safe duplicate barrier.
  const {data,error}=await owner.db.from("owner_finance_transactions")
    .upsert(inserts,{onConflict:"user_id,fingerprint",ignoreDuplicates:true}).select("id");
  if(error)return reply({error:"Import failed; no success confirmed"},503);
  return reply({ok:true,inserted:data?.length||0,skipped:rows.length-(data?.length||0)});
}
