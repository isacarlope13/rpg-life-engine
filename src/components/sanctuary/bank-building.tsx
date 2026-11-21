"use client";
import { PrivateFinancePanel } from "@/components/finance/private-finance-panel";

interface BankBuildingProps {
  playerLevel:number; skillLevel?:number; totalGpEarned?:number; walletGp?:number; vaultGp?:number; vaultCapGp?:number; aegisShields?:number;
  onRefreshState?:()=>Promise<void>;
  onSubmitDirectSkillSession?:(payload:Record<string,unknown>)=>Promise<unknown>;
  onClose?:()=>void;
}
/** The bank no longer initializes local demo balances or historical personal fixtures. */
export function BankBuilding({onClose}:BankBuildingProps){
 return <section className="fixed inset-0 z-50 overflow-y-auto bg-[#f4eedc] text-[#3a2e2b] p-3 sm:p-6" role="dialog" aria-modal="true" aria-label="Banco privado de OakHaven"><div className="max-w-5xl mx-auto"><button type="button" onClick={onClose} className="rounded-lg border border-stone-400 px-4 py-2 font-semibold">← Volver al pueblo</button><PrivateFinancePanel/></div></section>;
}
