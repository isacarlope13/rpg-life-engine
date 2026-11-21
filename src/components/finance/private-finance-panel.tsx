"use client";
import { useEffect, useMemo, useState } from "react";
import { parseFinanceCsv } from "@/lib/finance/csv";
import { projectCashflow, isCalendarDate } from "@/lib/finance/cashflow";

type FinanceRow = {date:string;kind:"income"|"expense"|"opening_balance"|"transfer";category:string;description:string;amountCop:number;paymentMethod:string};
type Preview = {received:number;newCount:number;duplicateCount:number;duplicateRows:number[];incomingCop:number;expenseCop:number;previewTicket:string;preview?:boolean;inserted?:number;skipped?:number};
type Ledger = {
 transactions:Array<{id:string;occurred_at:string;kind:string;amount_cop:number;category:string;description:string}>;
 accounts:Array<{id:string;label:string;balance_cop:number;as_of_date:string}>;
 debts:Array<{id:string;creditor:string;principal_remaining_cop:number;amount_due_cop:number;due_date:string|null;status:string}>;
 events:Array<{id:string;label:string;expected_on:string;amount_cop:number;kind:string;status:string}>;
};
const money = (value:number) => new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0}).format(value);
const writeHeaders = {"Content-Type":"application/json","x-oakhaven-finance-write":"1"};
const today = () => {const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Bogota",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());return ["year","month","day"].map(k=>parts.find(p=>p.type===k)?.value).join("-");};
const horizonDefault=()=>{const d=new Date(today()+"T12:00:00Z");d.setUTCDate(d.getUTCDate()+60);return d.toISOString().slice(0,10);};
export function PrivateFinancePanel(){
 const [rows,setRows]=useState<FinanceRow[]>([]);
 const [preview,setPreview]=useState<Preview|null>(null);
 const [ledger,setLedger]=useState<Ledger|null>(null);
 const [error,setError]=useState("");
 const [message,setMessage]=useState("");
 const [busy,setBusy]=useState(false);
 const [reading,setReading]=useState(false);
 const [checked,setChecked]=useState(false);
 const [reserve,setReserve]=useState("");
 const [horizon,setHorizon]=useState(horizonDefault);
 const [additionalExpenses,setAdditionalExpenses]=useState<string[]>([]);
 const [account,setAccount]=useState({label:"",balanceCop:"",asOfDate:today()});
 const [debt,setDebt]=useState({creditor:"",principalRemainingCop:"",amountDueCop:"",dueDate:"",status:"active"});
 const [event,setEvent]=useState({label:"",expectedOn:today(),amountCop:"",kind:"income",status:"expected"});
 const totalBalance=useMemo(()=>ledger?.accounts.reduce((s,a)=>s+Number(a.balance_cop),0)||0,[ledger]);
 const committed=useMemo(()=>ledger?.debts.filter(d=>d.status!=="settled").reduce((s,d)=>s+Number(d.amount_due_cop),0)||0,[ledger]);
 const reserveAmount=reserve.trim()!==""&&Number.isSafeInteger(Number(reserve))&&Number(reserve)>=0?Number(reserve):null;
 const projection=useMemo(()=>{
   if(!ledger||!ledger.accounts.length||reserveAmount===null||!isCalendarDate(horizon)||horizon<today())return null;
   try{return projectCashflow({today:today(),until:horizon,accounts:ledger.accounts,debts:ledger.debts,events:ledger.events,reserveCop:reserveAmount,additionalExpenseIds:additionalExpenses});}
   catch{return null;}
 },[ledger,reserveAmount,horizon,additionalExpenses]);
 const forecasts=useMemo(()=>ledger?.events.filter(e=>e.status==="expected"&&e.kind==="income").reduce((s,e)=>s+Number(e.amount_cop),0)||0,[ledger]);
 async function refresh(){
   const res=await fetch("/api/finance/ledger",{cache:"no-store"});
   const json=await res.json();
   if(!res.ok){setLedger(null);throw new Error(json.error||"No se pudo abrir la tesorería");}
   setLedger(json as Ledger);
   setAdditionalExpenses([]); // Reconfirm overlap exclusions after each server refresh.
 }
 useEffect(()=>{refresh().catch(e=>setError(String(e.message||e)))},[]);
 async function onCsv(file:File|undefined){
   setError("");setMessage("");setPreview(null);setChecked(false);setRows([]);
   if(!file)return;
   if(file.size>300000){setError("El archivo es demasiado grande (máx. 300 KB).");return;}
   setReading(true);
   try{const parsed=parseFinanceCsv(await file.text());setRows(parsed);setMessage(parsed.length+" movimientos listos para vista previa; aún no guardados.");}
   catch(e){setRows([]);setError(e instanceof Error?e.message:"Error al leer el CSV");}
   finally{setReading(false);}
 }
 async function runImport(mode:"preview"|"commit"){
   if(busy||reading||!rows.length)return;
   if(mode==="commit"&&(!checked||!preview))return;
   setBusy(true);setError("");setMessage("");
   try{
     const res=await fetch("/api/finance/import",{method:"POST",headers:writeHeaders,body:JSON.stringify({mode,rows,confirmed:mode==="commit"&&checked,previewTicket:mode==="commit"?preview?.previewTicket:undefined})});
     const json=await res.json();
     if(!res.ok)throw new Error(json.error||"No fue posible importar");
     if(mode==="preview"){setChecked(false);setPreview(json);setMessage("Vista previa completa. Confirma solo si los datos son correctos.");}
     else{setMessage("Insertados: "+json.inserted+". Omitidos: "+json.skipped+".");setRows([]);setPreview(null);setChecked(false);await refresh();}
   }catch(e){setPreview(null);setChecked(false);setError(e instanceof Error?e.message:"Error inesperado");}
   finally{setBusy(false);}
 }
 async function save(kind:"account"|"debt"|"event",item:Record<string,unknown>){
   if(busy)return;setBusy(true);setError("");setMessage("");
   try{
     const res=await fetch("/api/finance/ledger",{method:"POST",headers:writeHeaders,body:JSON.stringify({kind,item})});
     const data=await res.json();if(!res.ok)throw new Error(data.error||"Error al guardar");
     setMessage("Registro guardado en tu cuenta privada.");await refresh();
   }catch(e){setError(e instanceof Error?e.message:"Error inesperado");}
   finally{setBusy(false);}
 }
 const input="rounded-lg border border-stone-300 bg-white p-2 text-stone-950 w-full";
 const section="rounded-2xl border border-stone-300 bg-white p-5 space-y-3 shadow-sm";
 return <section className="bg-[#f4eedc] text-[#3a2e2b] rounded-2xl p-3 sm:p-5">
  <div className="max-w-5xl mx-auto space-y-5">
   <h1 className="text-3xl font-bold">Banco privado · Conciliación financiera</h1>
   <p className="text-sm">Tus saldos, deudas e ingresos previstos están separados de GP y XP. Los ingresos previstos NO forman parte del saldo disponible y la vista previa envía los registros al servidor autenticado sin guardarlos. Solo confirmar permite persistir los nuevos.</p>
   {error&&<p role="alert" className="rounded-xl bg-red-100 text-red-900 p-3">{error}</p>}
   {message&&<p role="status" className="rounded-xl bg-green-100 text-green-900 p-3">{message}</p>}
   <div className="rounded-xl bg-amber-50 border border-amber-300 p-3 text-sm">Los saldos se concilian por cuenta; el historial y las previsiones no se suman automáticamente. Los compromisos de deuda y los pagos futuros pueden referirse a la misma cuota: no los sumes dos veces. El GP no equivale a dinero bancario disponible.</div>
   <section className={section}>
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-xl font-bold">Guardian Financiero</h2><span className="rounded-lg bg-amber-100 border border-amber-300 px-2 py-1 text-xs font-bold">Canjes reales pausados</span></div>
    <p className="text-sm">Las recompensas GP siguen siendo progreso del juego, no saldo bancario. Los canjes monetarios y las operaciones antiguas de deuda permanecen bloqueados hasta validar una integración transaccional con reservas y obligaciones reales.</p>
    <p className="text-xs">Puedes registrar tus hábitos y habilidades normalmente. Registra gastos reales en el libro privado; concilia los saldos por cuenta. El calendario no ejecuta pagos.</p>
   </section>
   <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
    <div className={section}><div className="text-sm">Cuentas conciliadas</div><div className="text-2xl font-bold">{ledger?.accounts.length?money(totalBalance):"Sin conciliar"}</div></div>
    <div className={section}><div className="text-sm">Importes exigibles</div><div className="text-2xl font-bold">{ledger?.debts.length?money(committed):"Sin verificar"}</div></div>
    <div className={section}><div className="text-sm">Ingresos esperados (no disponibles)</div><div className="text-2xl font-bold">{ledger?money(forecasts):"Sin verificar"}</div></div>
   </div>
   <section className={section}>
    <h2 className="text-xl font-bold">Plan de caja prudente</h2>
    <p className="text-sm">Introduce una reserva esencial de prueba. Es una simulación en memoria, no una orden de pago ni un cambio de saldo. No usa ingresos esperados.</p>
    <label className="block text-sm">Reserva para necesidades (COP)<input type="number" min="0" step="1" value={reserve} onChange={e=>setReserve(e.target.value)} className={input}/></label>
    {ledger?.accounts.length&&reserveAmount!==null&&ledger.debts.length>0?<div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      <p>Margen después de reserva e importes exigibles: <strong>{money(Math.max(0,totalBalance-reserveAmount-committed))}</strong></p>
      <p>Faltante para cubrir lo anterior: <strong>{money(Math.max(0,reserveAmount+committed-totalBalance))}</strong></p>
    </div>:<p className="text-sm">Conciliar cuentas, revisar obligaciones y definir la reserva antes de estimar el margen.</p>}
    <p className="text-xs">No constituye dinero libre autorizado: puede haber otras obligaciones, saldos desactualizados o pagos pendientes de registrar.</p>
   </section>
   <section className={section}>
    <h2 className="text-xl font-bold">Calendario de caja · dos escenarios</h2>
    <p className="text-sm">Usa la reserva anterior para todo este horizonte, añade el presupuesto de gastos imprescindibles que falte y revisa que no se duplique con los pagos del calendario. Los ingresos esperados siguen siendo estimaciones; no autorizan gastos ni canjes de GP.</p>
    <label className="block text-sm">Proyectar hasta<input type="date" min={today()} value={horizon} onChange={e=>setHorizon(e.target.value)} className={input}/></label>
    {ledger?.events.filter(e=>e.kind==="expense"&&e.status==="expected"&&e.expected_on<=horizon).map(e=><label key={e.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={additionalExpenses.includes(e.id)} onChange={ev=>setAdditionalExpenses(prev=>ev.target.checked?[...prev,e.id]:prev.filter(id=>id!==e.id))}/> Añadir {e.label} · {money(Number(e.amount_cop))} ({e.expected_on}) únicamente si no está incluida en deudas o reserva.</label>)}
    {projection?<>
      {projection.issues.map((issue,i)=><p key={i} role="status" className="text-sm text-amber-900">{issue}</p>)}
      <div className="grid sm:grid-cols-2 gap-2">
        <div className="rounded-xl border border-stone-300 p-3"><p className="text-sm">Sin ingresos previstos</p><strong>{money(projection.finalWithoutExpected)}</strong><p className="text-xs">Mayor faltante: {money(projection.maximumShortfallWithoutExpected)}</p></div>
        <div className="rounded-xl border border-stone-300 p-3"><p className="text-sm">Si llegan los ingresos previstos</p><strong>{money(projection.finalWithExpected)}</strong><p className="text-xs">Mayor faltante: {money(projection.maximumShortfallWithExpected)}</p></div>
      </div>
      <p className="text-xs">Saldo inicial menos reserva: {money(projection.startingAfterReserve)}. En una misma fecha se consideran primero las salidas. Una deuda sin vencimiento se reserva desde hoy. Los ingresos con fecha pasada requieren conciliación antes de contarse.</p>
      <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr><th>Fecha</th><th>Concepto</th><th>Movimiento</th><th>Sin ingresos futuros</th><th>Con ingresos futuros</th></tr></thead><tbody>{projection.timeline.map(item=><tr key={item.id} className="border-t"><td>{item.date}</td><td>{item.label}{item.overdue?" (vencido)":item.undated?" (sin fecha)":""}</td><td>{item.kind==="income"?"+":"−"}{money(item.amount)}</td><td>{money(item.withoutExpected)}</td><td>{money(item.withExpected)}</td></tr>)}</tbody></table></div>
    </>:<p className="text-sm">Define un horizonte válido, concilia tus cuentas y completa la reserva para calcular.</p>}
    <p className="text-xs font-bold">Simulación orientativa. No habilita recompensas ni modifica datos reales. No uses estos importes como dinero libre confirmado.</p>
   </section>
   <section className={section}>
    <h2 className="text-xl font-bold">1. Importar movimientos con vista previa</h2>
    <p className="text-sm">Selecciona un CSV UTF-8 con columnas Fecha, Tipo, Categoría, Monto, Descripción y Método de Pago. Revisa siempre antes de confirmar. No vuelvas a importar tus saldos iniciales como sueldos.</p>
    <input aria-label="Seleccionar CSV financiero" type="file" disabled={busy||reading} accept=".csv,text/csv" onChange={e=>void onCsv(e.currentTarget.files?.[0])}/>
    <p className="text-sm">Filas cargadas: {rows.length}</p>
    <button disabled={busy||reading||!ledger||rows.length===0} onClick={()=>void runImport("preview")} className="bg-amber-200 p-3 rounded-lg font-semibold disabled:opacity-40">Comprobar duplicados (sin guardar)</button>
    {preview&&<>
     <p className="text-sm">Recibidas: <b>{preview.received}</b> · Nuevas: <b>{preview.newCount}</b> · Duplicadas: <b>{preview.duplicateCount}</b></p>
     <p className="text-sm">Ingresos nuevos: {money(preview.incomingCop)} · Gastos nuevos: {money(preview.expenseCop)} (saldos iniciales excluidos)</p>
     <div className="overflow-auto max-h-56"><table className="w-full text-sm"><thead><tr><th>Fecha</th><th>Tipo</th><th>Monto</th><th>Concepto</th><th>Revisión</th></tr></thead><tbody>
     {rows.slice(0,150).map((r,i)=><tr key={i} className="border-t"><td>{r.date}</td><td>{r.kind}</td><td>{money(r.amountCop)}</td><td>{r.description}</td><td>{preview.duplicateRows.includes(i)?"Coincidencia exacta; se omite":"Nuevo"}</td></tr>)}
     </tbody></table></div>
     <label className="flex gap-2 items-center"><input type="checkbox" checked={checked} onChange={e=>setChecked(e.target.checked)}/> Revisé los importes, tipos y coincidencias exactas (si dos operaciones legítimas parecen iguales, no confirmar hasta conciliarlas). Autorizo guardar únicamente las nuevas.</label>
     <button disabled={busy||reading||!ledger||!checked||preview.newCount===0} onClick={()=>void runImport("commit")} className="bg-green-800 text-white p-3 rounded-lg font-semibold disabled:opacity-40">Confirmar importación privada</button>
    </>}
   </section>
   <section className={section}>
    <h2 className="text-xl font-bold">2. Cuentas reales</h2>
    <p className="text-sm">Introduce saldos conciliados a una fecha. Actualizar un saldo existente NO crea un ingreso.</p>
    <form className="grid grid-cols-1 sm:grid-cols-4 gap-2" onSubmit={e=>{e.preventDefault();void save("account",{label:account.label,balanceCop:Number(account.balanceCop),asOfDate:account.asOfDate})}}>
     <input className={input} placeholder="Cuenta (ej. ahorros)" required maxLength={120} value={account.label} onChange={e=>setAccount({...account,label:e.target.value})}/>
     <input className={input} type="number" min="0" placeholder="Saldo COP" required value={account.balanceCop} onChange={e=>setAccount({...account,balanceCop:e.target.value})}/>
     <input className={input} type="date" required value={account.asOfDate} onChange={e=>setAccount({...account,asOfDate:e.target.value})}/>
     <button className="bg-green-800 text-white rounded-lg p-2" disabled={busy||!ledger}>Guardar cuenta</button>
    </form>
    {ledger?.accounts.map(a=><p key={a.id} className="text-sm">{a.label} · {money(a.balance_cop)} · conciliado {a.as_of_date}</p>)}
   </section>
   <section className={section}>
    <h2 className="text-xl font-bold">3. Obligaciones</h2>
    <p className="text-sm">Registra cada acreedor una sola vez. «Saldo pendiente» y «valor exigible hoy» son conceptos diferentes. Un registro como saldado queda en cero exigible.</p>
    <form className="grid sm:grid-cols-3 gap-2" onSubmit={e=>{e.preventDefault();void save("debt",{creditor:debt.creditor,principalRemainingCop:Number(debt.principalRemainingCop),amountDueCop:Number(debt.amountDueCop),dueDate:debt.dueDate||null,status:debt.status})}}>
     <input className={input} placeholder="Acreedor" maxLength={120} required value={debt.creditor} onChange={e=>setDebt({...debt,creditor:e.target.value})}/>
     <input className={input} type="number" min="0" placeholder="Saldo pendiente COP" required value={debt.principalRemainingCop} onChange={e=>setDebt({...debt,principalRemainingCop:e.target.value})}/>
     <input className={input} type="number" min="0" placeholder="Importe exigible COP" required value={debt.amountDueCop} onChange={e=>setDebt({...debt,amountDueCop:e.target.value})}/>
     <input className={input} type="date" value={debt.dueDate} onChange={e=>setDebt({...debt,dueDate:e.target.value})}/>
     <select className={input} value={debt.status} onChange={e=>setDebt({...debt,status:e.target.value})}><option value="active">Activa</option><option value="overdue">Vencida</option><option value="arrangement">Acuerdo</option><option value="settled">Saldada</option></select>
     <button className="bg-green-800 text-white rounded-lg p-2" disabled={busy||!ledger}>Guardar obligación</button>
    </form>
    {ledger?.debts.map(d=><p key={d.id} className="text-sm">{d.creditor} · saldo {money(d.principal_remaining_cop)} · exigible {money(d.amount_due_cop)} · {d.status} · {d.due_date||"Sin fecha"}</p>)}
   </section>
   <section className={section}>
    <h2 className="text-xl font-bold">4. Calendario de ingresos y pagos previstos</h2>
    <p className="text-sm">Una entrada esperada no se suma al efectivo hasta recibirla y conciliarla. Su estado puede actualizarse con el mismo nombre y fecha.</p>
    <form className="grid sm:grid-cols-3 gap-2" onSubmit={e=>{e.preventDefault();void save("event",{label:event.label,expectedOn:event.expectedOn,amountCop:Number(event.amountCop),kind:event.kind,status:event.status})}}>
     <input className={input} placeholder="Concepto previsto" required maxLength={120} value={event.label} onChange={e=>setEvent({...event,label:e.target.value})}/>
     <input className={input} type="date" value={event.expectedOn} required onChange={e=>setEvent({...event,expectedOn:e.target.value})}/>
     <input className={input} type="number" min="1" placeholder="Monto COP" required value={event.amountCop} onChange={e=>setEvent({...event,amountCop:e.target.value})}/>
     <select className={input} value={event.kind} onChange={e=>setEvent({...event,kind:e.target.value})}><option value="income">Ingreso previsto</option><option value="expense">Pago previsto</option></select>
     <select className={input} value={event.status} onChange={e=>setEvent({...event,status:e.target.value})}><option value="expected">Esperado</option><option value="received">Recibido / realizado</option><option value="cancelled">Cancelado</option></select>
     <button className="bg-green-800 text-white rounded-lg p-2" disabled={busy||!ledger}>Guardar evento</button>
    </form>
    {ledger?.events.slice().sort((a,b)=>a.expected_on.localeCompare(b.expected_on)).map(e=><p key={e.id} className="text-sm">{e.expected_on} · {e.label} · {e.kind==="income"?"+":"−"}{money(e.amount_cop)} · {e.status}</p>)}
   </section>
   <section className={section}><h2 className="text-xl font-bold">Movimientos ya guardados</h2><p className="text-sm">Total persistido en el nuevo libro privado: {ledger?ledger.transactions.length:"sin verificar"} registros. El libro comienza vacío y nunca inserta datos de demostración.</p><div className="overflow-auto max-h-80"><table className="w-full text-sm"><thead><tr><th>Fecha</th><th>Tipo</th><th>Monto</th><th>Concepto</th></tr></thead><tbody>{ledger?.transactions.map(t=><tr key={t.id} className="border-t"><td>{new Date(t.occurred_at).toLocaleString("es-CO",{timeZone:"America/Bogota"})}</td><td>{t.kind}</td><td>{money(t.amount_cop)}</td><td>{t.description}</td></tr>)}</tbody></table></div></section>
  </div>
 </section>;
}
