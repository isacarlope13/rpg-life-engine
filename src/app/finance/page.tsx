import Link from "next/link";
import { PrivateFinancePanel } from "@/components/finance/private-finance-panel";

export default function PrivateFinancePage(){
 return <main className="min-h-screen bg-[#f4eedc] p-4 md:p-8"><div className="max-w-5xl mx-auto"><Link href="/cozy" className="underline text-sm text-stone-800">← Volver al pueblo</Link><PrivateFinancePanel/></div></main>;
}
