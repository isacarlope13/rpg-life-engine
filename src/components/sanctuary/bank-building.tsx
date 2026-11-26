"use client";
import { LivingInteriorRoom, type InteriorStationDefinition } from "@/components/sanctuary/living-interior-room";
import { PrivateFinancePanel } from "@/components/finance/private-finance-panel";

interface BankBuildingProps {
  playerLevel:number; skillLevel?:number; totalGpEarned?:number; walletGp?:number; vaultGp?:number; vaultCapGp?:number; aegisShields?:number;
  onRefreshState?:()=>Promise<void>;
  onSubmitDirectSkillSession?:(payload:Record<string,unknown>)=>Promise<unknown>;
  onClose?:()=>void;
}
/** The bank no longer initializes local demo balances or historical personal fixtures. */
export function BankBuilding({onClose}:BankBuildingProps){
 const stations:InteriorStationDefinition[]=[{id:"ledger",name:"Tesorería privada",icon:"📒",description:"Cuentas conciliadas, calendario y obligaciones",stationType:"vault"}];
 return <LivingInteriorRoom buildingId="banco_oakhaven" buildingName="Banco de OakHaven" domain="work" districtName="Plaza Central" icon="🏦"
  tagline="Tesorería privada · datos conciliados" stations={stations} activeStationId="ledger" onSelectStation={()=>{}} onClose={onClose}
  hideSpecialistAndLibrary roomTheme={{wallColor:"#3D2B1F",floorPattern:"stone",ambientWarmth:"candlelight"}}>
  <PrivateFinancePanel/>
 </LivingInteriorRoom>;
}
