/**
 * Temporary fail-closed boundary for the legacy economy while real cash
 * reconciliation and an atomic redemption workflow are not yet integrated.
 * No environment switch or client-provided "balance" authorizes real spending.
 */
import { getSingleUserAccessConfig, type SingleUserEnv } from "../single-user-guard.ts";

export function legacyFinanceHeld(mode: "supabase"|"local_engine",env:SingleUserEnv=process.env):boolean {
  const cfg=getSingleUserAccessConfig(env);
  return mode==="supabase"||cfg.privateMode||env.NODE_ENV==="production";
}

const financialActions=new Set(["redeem_wishlist","purify_boss","limit_break","set_debt_strategy","import_backup"]);
export function isLegacyFinancialSkillAction(body:{action?:unknown;record_purchase_in_treasury?:unknown}):boolean{
  return (typeof body.action==="string"&&financialActions.has(body.action))||
    ((body.action==="add_cube"||body.action==="add_book")&&Boolean(body.record_purchase_in_treasury));
}

export const financeHoldMessage="Operación financiera anterior pausada. Usa el Libro Financiero privado para registrar y conciliar operaciones reales. Los GP no autorizan pagos.";
export function legacyFinanceHoldResponse(){
  return Response.json({success:false,code:"PRIVATE_FINANCE_RECONCILIATION_REQUIRED",error:financeHoldMessage},{status:409,headers:{"Cache-Control":"private, no-store"}});
}
