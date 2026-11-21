import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export type ParsedFinanceRow = {
  date: string; kind: "income"|"expense"|"transfer"|"opening_balance";
  category: string; description: string; amountCop: number; paymentMethod: string;
};
const maxMoney=100_000_000_000;
export function validDate(value:unknown): value is string {
  if(typeof value!=="string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const d=new Date(value+"T12:00:00Z");
  return Number.isFinite(d.valueOf()) && d.toISOString().slice(0,10)===value;
}
export function normalizeFinanceDate(value:unknown):string|null {
  if(typeof value!=="string")return null;
  const m=/^(\d{4}-\d{2}-\d{2})(?:[ T](\d{1,2}):(\d{2}))?$/.exec(value.trim());
  if(!m||!validDate(m[1]))return null;
  if(m[2]===undefined)return m[1];
  if(Number(m[2])>23||Number(m[3])>59)return null;
  return m[1]+" "+m[2].padStart(2,"0")+":"+m[3];
}
export const normalizeLabel=(value:string)=>value.normalize("NFC").trim().replace(/\s+/g," ");
const canonical=(value:string)=>normalizeLabel(value).toLowerCase();
const money=(v:unknown)=>Number.isSafeInteger(v)&&Number(v)>=0&&Number(v)<=maxMoney;
const label=(v:unknown):v is string=>typeof v==="string"&&v.trim().length>0&&v.length<=120;
export function validateFinanceRow(item:unknown):ParsedFinanceRow|null{
  if(!item||typeof item!=="object")return null;
  const v=item as Record<string,unknown>;
  const date=normalizeFinanceDate(v.date);
  if(!date||!["income","expense","transfer","opening_balance"].includes(String(v.kind)))return null;
  if(!money(v.amountCop)||Number(v.amountCop)<=0)return null;
  if(typeof v.category!=="string"||v.category.length>100||typeof v.description!=="string"||v.description.length>300||typeof v.paymentMethod!=="string"||v.paymentMethod.length>80)return null;
  const description=normalizeLabel(v.description);
  const kind=/^(inicial cuenta|inicial efectivo|saldo inicial)$/i.test(description)?"opening_balance":v.kind as ParsedFinanceRow["kind"];
  return {date,kind,category:normalizeLabel(v.category)||"Otros",description,amountCop:Number(v.amountCop),paymentMethod:normalizeLabel(v.paymentMethod)};
}
export function movementFingerprint(v:ParsedFinanceRow):string{
  return createHash("sha256").update(JSON.stringify([v.date,v.kind,canonical(v.category),v.amountCop,canonical(v.description),canonical(v.paymentMethod)])).digest("hex");
}
export function planImport(rows:ParsedFinanceRow[],existing:ReadonlySet<string>){
  const seen=new Set<string>(),duplicateRows:number[]=[];
  const fresh=rows.flatMap((row,index)=>{
    const fingerprint=movementFingerprint(row);
    if(existing.has(fingerprint)||seen.has(fingerprint)){duplicateRows.push(index);return [];}
    seen.add(fingerprint);
    return [{row,fingerprint}];
  });
  return {fresh,duplicateRows};
}
export function transactionTimestamp(date:string):string{
  return date.length===10?date+"T12:00:00-05:00":date.replace(" ","T")+":00-05:00";
}
export function validateFinanceItem(kind:string,value:unknown):Record<string,unknown>|null{
  if(!value||typeof value!=="object")return null;
  const v=value as Record<string,unknown>;
  if(kind==="account"&&label(v.label)&&money(v.balanceCop)&&validDate(v.asOfDate))
    return {label:normalizeLabel(v.label),balance_cop:v.balanceCop,as_of_date:v.asOfDate};
  if(kind==="debt"&&label(v.creditor)&&money(v.principalRemainingCop)&&money(v.amountDueCop)&&
    ["active","overdue","settled","arrangement"].includes(String(v.status))&&
    (v.status!=="settled"||(v.principalRemainingCop===0&&v.amountDueCop===0))&&
    (v.dueDate==null||validDate(v.dueDate)))
    return {creditor:normalizeLabel(v.creditor),principal_remaining_cop:v.principalRemainingCop,amount_due_cop:v.amountDueCop,due_date:v.dueDate||null,status:v.status,updated_at:new Date().toISOString()};
  if(kind==="event"&&label(v.label)&&validDate(v.expectedOn)&&money(v.amountCop)&&Number(v.amountCop)>0&&
    ["income","expense"].includes(String(v.kind))&&["expected","received","cancelled"].includes(String(v.status)))
    return {label:normalizeLabel(v.label),expected_on:v.expectedOn,amount_cop:v.amountCop,kind:v.kind,status:v.status};
  return null;
}
// Bind the preview to the owner, canonical rows, and expiry. No details are embedded in the ticket.
const previewMac=(owner:string,rows:ParsedFinanceRow[],expiry:number,secret:string)=>
  createHmac("sha256",secret).update(JSON.stringify(["oakhaven-finance-preview-v1",owner,expiry,rows])).digest("hex");
export function signPreview(owner:string,rows:ParsedFinanceRow[],secret:string,now=Date.now()):string{
  const expiry=now+10*60_000;
  return expiry+"."+previewMac(owner,rows,expiry,secret);
}
export function verifyPreview(ticket:unknown,owner:string,rows:ParsedFinanceRow[],secret:string,now=Date.now()):boolean{
  if(typeof ticket!=="string"||!secret)return false;
  const match=/^(\d{13})\.([a-f0-9]{64})$/.exec(ticket);
  if(!match)return false;
  const expiry=Number(match[1]);
  if(expiry<now||expiry>now+10*60_000)return false;
  const expected=previewMac(owner,rows,expiry,secret);
  return timingSafeEqual(Buffer.from(expected,"hex"),Buffer.from(match[2],"hex"));
}
