import { createHash } from "node:crypto";
import { isAuthorizedSupabaseUserId } from "@/lib/single-user-guard";
import { resolveAuthenticatedUser } from "@/lib/auth";

export type FinanceSession = {
  userId: string;
  db: NonNullable<Awaited<ReturnType<typeof resolveAuthenticatedUser>>>["userClient"];
};
export async function requireFinanceOwner(request: Request) {
  const session = await resolveAuthenticatedUser(request);
  if (!session || session.mode !== "supabase" || !session.userClient ||
      !isAuthorizedSupabaseUserId(session.userId)) return null;
  return { userId: session.userId, db: session.userClient };
}
// CSRF defense for cookie-backed financial writes; fail closed for missing Origin.
export function financeWriteAllowed(request: Request): boolean {
  const origin = request.headers.get("origin");
  const expected = new URL(request.url).origin;
  return origin === expected &&
    request.headers.get("x-oakhaven-finance-write") === "1" &&
    !["cross-site", "same-site"].includes(request.headers.get("sec-fetch-site") || "");
}
export const noStore = { "Cache-Control": "no-store" };
export type ParsedFinanceRow = {
  date: string; kind: "income"|"expense"|"transfer"|"opening_balance";
  category: string; description: string; amountCop: number; paymentMethod: string;
};
const maxMoney = 100_000_000_000;
export function validateFinanceRow(item: unknown): ParsedFinanceRow | null {
  if (!item || typeof item !== "object") return null;
  const v = item as Record<string, unknown>;
  if (typeof v.date !== "string" || !/^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2})?$/.test(v.date)) return null;
  const parsed = new Date(v.date.slice(0,10)+"T12:00:00Z");
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0,10) !== v.date.slice(0,10)) return null;
  if (!["income","expense","transfer","opening_balance"].includes(String(v.kind))) return null;
  if (!Number.isSafeInteger(v.amountCop) || Number(v.amountCop)<=0 || Number(v.amountCop)>maxMoney) return null;
  if (typeof v.category !== "string" || v.category.length>100 || typeof v.description !== "string" || v.description.length>300) return null;
  if (typeof v.paymentMethod !== "string" || v.paymentMethod.length>80) return null;
  return {date:v.date, kind:v.kind as ParsedFinanceRow["kind"], category:v.category.trim()||"Otros",
    description:v.description.trim(),amountCop:Number(v.amountCop),paymentMethod:v.paymentMethod.trim()};
}
export function movementFingerprint(v:ParsedFinanceRow):string {
  return createHash("sha256").update(JSON.stringify([
    v.date.replace("T"," ").trim(),v.kind,v.category.toLowerCase().normalize("NFC"),
    v.amountCop,v.description.toLowerCase().normalize("NFC"),v.paymentMethod.toLowerCase().normalize("NFC")
  ])).digest("hex");
}
export function validateFinanceItem(kind:string, value:unknown): Record<string,unknown> | null {
  if(!value || typeof value!=="object") return null;
  const v=value as Record<string,unknown>;
  const money=(n:unknown)=>Number.isSafeInteger(n)&&Number(n)>=0&&Number(n)<=maxMoney;
  const label=(n:unknown)=>typeof n==="string" && n.trim().length>0 && n.length<=120;
  const date=(n:unknown)=>typeof n==="string" && /^\d{4}-\d{2}-\d{2}$/.test(n) && !Number.isNaN(Date.parse(n));
  if(kind==="account" && label(v.label) && money(v.balanceCop) && date(v.asOfDate))
    return {label:(v.label as string).trim(),balance_cop:v.balanceCop,as_of_date:v.asOfDate};
  if(kind==="debt" && label(v.creditor) && money(v.principalRemainingCop) && money(v.amountDueCop) &&
      ["active","overdue","settled","arrangement"].includes(String(v.status)) &&
      (v.status!=="settled" || (v.principalRemainingCop===0 && v.amountDueCop===0)) &&
      (v.dueDate==null || date(v.dueDate)))
    return {creditor:(v.creditor as string).trim(),principal_remaining_cop:v.principalRemainingCop,
      amount_due_cop:v.amountDueCop,due_date:v.dueDate||null,status:v.status,updated_at:new Date().toISOString()};
  if(kind==="event" && label(v.label) && date(v.expectedOn) && money(v.amountCop) && Number(v.amountCop)>0 &&
      ["income","expense"].includes(String(v.kind)) && ["expected","received","cancelled"].includes(String(v.status)))
    return {label:(v.label as string).trim(),expected_on:v.expectedOn,amount_cop:v.amountCop,kind:v.kind,status:v.status};
  return null;
}
