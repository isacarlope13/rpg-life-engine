import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSingleUserAccessConfig, isAuthorizedSupabaseUserId } from "@/lib/single-user-guard";
import { resolveAuthenticatedUser, buildAuthSetCookieHeaders } from "@/lib/auth";
import { getAppBaseUrl } from "@/lib/app-url";
import { isSupabaseConfigured, supabaseUrl } from "@/lib/supabase";
export { validateFinanceRow, movementFingerprint, planImport, transactionTimestamp, validateFinanceItem, signPreview, verifyPreview } from "./finance-validation";

// Dedicated server-only service_role client. Never falls back to the anon key.
function createFinanceServiceClient():SupabaseClient|null{
  const serviceKey=(process.env.SUPABASE_SERVICE_ROLE_KEY||"").trim();
  if(!isSupabaseConfigured||!serviceKey||serviceKey.startsWith("tu-"))return null;
  return createClient(supabaseUrl,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
}

export async function requireFinanceOwner(request:Request){
  const config=getSingleUserAccessConfig();
  if(!config.ownerUserId||config.ownerConfigInvalid)return null;
  const session=await resolveAuthenticatedUser(request);
  if(!session||session.mode!=="supabase"||!session.userClient||!isAuthorizedSupabaseUserId(session.userId))return null;
  const db=createFinanceServiceClient();
  if(!db)return null;
  return {userId:session.userId,db,refreshedTokens:session.refreshedTokens};
}
export type FinanceOwner=NonNullable<Awaited<ReturnType<typeof requireFinanceOwner>>>;
export const noStore={"Cache-Control":"private, no-store"};
// Trusted configured public origin in production, not arbitrary forwarded Host headers.
export function financeWriteAllowed(request:Request):boolean{
  const origin=request.headers.get("origin");
  const expected=new URL(process.env.NODE_ENV==="production"?getAppBaseUrl():request.url).origin;
  return origin===expected && request.headers.get("x-oakhaven-finance-write")==="1" &&
    /^application\/json(?:;|$)/i.test(request.headers.get("content-type")||"") &&
    !["cross-site","same-site"].includes(request.headers.get("sec-fetch-site")||"");
}
export function financeResponse(owner:FinanceOwner|null,body:unknown,status=200){
  const res=NextResponse.json(body,{status,headers:noStore});
  if(owner?.refreshedTokens)for(const header of buildAuthSetCookieHeaders(owner.refreshedTokens))res.headers.append("Set-Cookie",header);
  return res;
}
// Bound the actual request stream in bytes, independently of Content-Length.
export async function readFinanceJson(req:Request,maxBytes:number):Promise<{ok:true;body:unknown}|{ok:false;status:number}>{
  if(Number(req.headers.get("content-length")||"0")>maxBytes)return {ok:false,status:413};
  if(!req.body)return {ok:false,status:400};
  const reader=req.body.getReader();
  const decoder=new TextDecoder("utf-8",{fatal:true});
  let bytes=0,raw="";
  try{
    while(true){
      const {done,value}=await reader.read();
      if(done)break;
      bytes+=value.byteLength;
      if(bytes>maxBytes){await reader.cancel();return {ok:false,status:413};}
      raw+=decoder.decode(value,{stream:true});
    }
    raw+=decoder.decode();
    return {ok:true,body:JSON.parse(raw)};
  }catch{return {ok:false,status:400};}
  finally{reader.releaseLock();}
}
