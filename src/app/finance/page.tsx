"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type FinanceRow = {date:string;kind:"income"|"expense"|"opening_balance"|"transfer";category:string;description:string;amountCop:number;paymentMethod:string};
type Preview = {received:number;newCount:number;duplicateCount:number;duplicateRows:number[];incomingCop:number;expenseCop:number;preview?:boolean;inserted?:number;skipped?:number};
type Ledger = {
 transactions:Array<{id:string;occurred_at:string;kind:string;amount_cop:number;category:string;description:string}>;
 accounts:Array<{id:string;label:string;balance_cop:number;as_of_date:string}>;
 debts:Array<{id:string;creditor:string;principal_remaining_cop:number;amount_due_cop:number;due_date:string|null;status:string}>;
 events:Array<{id:string;label:string;expected_on:string;amount_cop:number;kind:string;status:string}>;
};
const money = (value:number) => new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0}).format(value);
const writeHeaders = {"Content-Type":"application/json","x-oakhaven-finance-write":"1"};
const today = () => new Date().toLocaleDateString("en-CA",{timeZone:"America/Bogota"});
const headWords=(v:string)=>v.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim();
function tokenizeCsv(input:string):string[][] {
 const content=input.replace(/^\uFEFF/,"");
 const first=content.split(/\r?\n/,1)[0]||"";
 const sep=first.includes(";")&&!first.includes(",")?";":",";
 const out:string[][]=[];let line:string[]=[],cell="",quotes=false;
 for(let i=0;i<content.length;i++) {
   const ch=content[i];
   if(ch==='"'&&quotes&&content[i+1]==='"'){cell+='"';i++;continue;}
   if(ch==='"'){quotes=!quotes;continue;}
   if(ch===sep&&!quotes){line.push(cell);cell="";continue;}
   if((ch==="\n"||ch==="\r")&&!quotes){
     if(ch==="\r"&&content[i+1]==="\n") i++;
     line.push(cell);
     if(line.some(v=>v.trim()))out.push(line);
     line=[];cell="";continue;
   }
   cell+=ch;
 }
 if(quotes) throw new Error("Archivo CSV con comillas sin cerrar.");
 line.push(cell);if(line.some(v=>v.trim()))out.push(line);
 return out;
}
function parseCop(raw:string):number {
 const clean=raw.trim().replace(/[\s$COP]/gi,"");
 // "1.224.561,00", "1,224,561.00", "1224561.00", and "1224561" are supported.
 if(!clean) return NaN;
 let number=clean;
 if(clean.includes(",")&&clean.includes(".")){
   number=clean.lastIndexOf(",")>clean.lastIndexOf(".")
     ?clean.replace(/\./g,"").replace(",","."):clean.replace(/,/g,"");
 }else if(/^\d{1,3}(\.\d{3})+$/.test(clean)) number=clean.replace(/\./g,"");
 else if(/^\d{1,3}(,\d{3})+$/.test(clean)) number=clean.replace(/,/g,"");
 else if(clean.includes(",")) number=clean.replace(",",".");
 const amount=Number(number);
 return Number.isSafeInteger(amount)?amount:Number.isFinite(amount)&&amount>0?Math.round(amount):NaN;
}
function parseFinanceCsv(raw:string):FinanceRow[] {
 const lines=tokenizeCsv(raw);
 if(lines.length<2)throw new Error("El CSV está vacío.");
 const headers=lines[0].map(headWords);
 const index=(...keys:string[])=>headers.findIndex(h=>keys.includes(h));
 const columns={
 date:index("fecha","date"),kind:index("tipo","type"),category:index("categoria","category"),
 amount:index("monto","amount"),description:index("descripcion","description"),
 method:index("metodo de pago","metodo_pago","payment_method")
 };
 if([columns.date,columns.kind,columns.amount].some(x=>x<0)) throw new Error("Faltan columnas Fecha, Tipo o Monto.");
 const list=lines.slice(1).map((cells,pos)=>{
   const pick=(i:number)=>i<0?"":(cells[i]||"").trim();
   const date=pick(columns.date).replace(/^"|"$/g,"").replace(/\//g,"-").replace("T"," ");
   const originalType=headWords(pick(columns.kind)),description=pick(columns.description);
   const amountCop=parseCop(pick(columns.amount));
   if(!Number.isSafeInteger(amountCop)||amountCop<=0)throw new Error("Monto inválido en fila "+(pos+2));
   let kind:FinanceRow["kind"]=originalType==="ingreso"?"income":originalType==="gasto"?"expense":originalType==="transferencia"?"transfer":originalType==="saldo inicial"?"opening_balance":"expense";
   if(/^(inicial cuenta|inicial efectivo)$/i.test(description))kind="opening_balance";
   if(!/^\d{4}-\d{2}-\d{2}(?: \d{2}:\d{2})?$/.test(date))throw new Error("Fecha no reconocida en fila "+(pos+2));
   return {date,kind,category:pick(columns.category)||"Otros",description,amountCop,
      paymentMethod:pick(columns.method)||"Transferencia"};
 });
 if(list.length>150)throw new Error("Importa un máximo de 150 registros por archivo.");
 return list;
}
export default function PrivateFinancePage(){
 const [rows,setRows]=useState<FinanceRow[]>([]);
 const [preview,setPreview]=useState<Preview|null>(null);
 const [ledger,setLedger]=useState<Ledger|null>(null);
 const [error,setError]=useState("");
 const [message,setMessage]=useState("");
 const [busy,setBusy]=useState(false);
 const [checked,setChecked]=useState(false);
 const [account,setAccount]=useState({label:"",balanceCop:"",asOfDate:today()});
 const [debt,setDebt]=useState({creditor:"",principalRemainingCop:"",amountDueCop:"",dueDate:"",status:"active"});
 const [event,setEvent]=useState({label:"",expectedOn:today(),amountCop:"",kind:"income",status:"expected"});
 const totalBalance=useMemo(()=>ledger?.accounts.reduce((s,a)=>s+a.balance_cop,0)||0,[ledger]);
 const committed=useMemo(()=>ledger?.debts.filter(d=>d.status!=="settled").reduce((s,d)=>s+d.amount_due_cop,0)||0,[ledger]);
 const forecasts=useMemo(()=>ledger?.events.filter(e=>e.status==="expected"&&e.kind==="income").reduce((s,e)=>s+e.amount_cop,0)||0,[ledger]);
 async function refresh(){
   const res=await fetch("/api/finance/ledger",{cache:"no-store"});
   const json=await res.json();
   if(!res.ok) throw new Error(json.error||"No se pudo abrir la tesorería");
   setLedger(json as Ledger);
 }
 useEffect(()=>{refresh().catch(e=>setError(String(e.message||e)))},[]);
 async function onCsv(file:File|undefined){
   setError("");setMessage("");setPreview(null);setChecked(false);
   if(!file)return;
   if(file.size>300000){setError("El archivo es demasiado grande (máx. 300 KB).");return;}
   try{const parsed=parseFinanceCsv(await file.text());setRows(parsed);setMessage(parsed.length+" movimientos listos para vista previa; aún no guardados.");}
   catch(e){setRows([]);setError(e instanceof Error?e.message:"Error al leer el CSV");}
 }
 async function runImport(mode:"preview"|"commit"){
   if(busy||!rows.length)return;
   if(mode==="commit"&&(!checked||!preview))return;
   setBusy(true);setError("");setMessage("");
   try{
     const res=await fetch("/api/finance/import",{method:"POST",headers:writeHeaders,body:JSON.stringify({mode,rows})});
     const json=await res.json();
     if(!res.ok)throw new Error(json.error||"No fue posible importar");
     if(mode==="preview"){setPreview(json);setMessage("Vista previa completa. Confirma solo si los datos son correctos.");}
     else{setMessage("Insertados: "+json.inserted+". Omitidos: "+json.skipped+".");setRows([]);setPreview(null);setChecked(false);await refresh();}
   }catch(e){setError(e instanceof Error?e.message:"Error inesperado");}
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
 return <main className="min-h-screen bg-[#f4eedc] text-[#3a2e2b] p-4 md:p-8">
  <div className="max-w-5xl mx-auto space-y-5">
   <Link href="/cozy" className="underline text-sm">← Volver al pueblo</Link>
   <h1 className="text-3xl font-bold">Banco privado · Conciliación financiera</h1>
   <p className="text-sm">Tus saldos, deudas e ingresos previstos están separados de GP y XP. Los ingresos previstos NO forman parte del saldo disponible y los archivos permanecen en el navegador hasta que confirmes su importación.</p>
   {error&&<p role="alert" className="rounded-xl bg-red-100 text-red-900 p-3">{error}</p>}
   {message&&<p role="status" className="rounded-xl bg-green-100 text-green-900 p-3">{message}</p>}
   <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
    <div className={section}><div className="text-sm">Cuentas conciliadas</div><div className="text-2xl font-bold">{money(totalBalance)}</div></div>
    <div className={section}><div className="text-sm">Importes exigibles</div><div className="text-2xl font-bold">{money(committed)}</div></div>
    <div className={section}><div className="text-sm">Ingresos esperados (no disponibles)</div><div className="text-2xl font-bold">{money(forecasts)}</div></div>
   </div>
   <section className={section}>
    <h2 className="text-xl font-bold">1. Importar movimientos con vista previa</h2>
    <p className="text-sm">Selecciona un CSV UTF-8 con columnas Fecha, Tipo, Categoría, Monto, Descripción y Método de Pago. Revisa siempre antes de confirmar. No vuelvas a importar tus saldos iniciales como sueldos.</p>
    <input aria-label="Seleccionar CSV financiero" type="file" accept=".csv,text/csv" onChange={e=>void onCsv(e.currentTarget.files?.[0])}/>
    <p className="text-sm">Filas cargadas: {rows.length}</p>
    <button disabled={busy||rows.length===0} onClick={()=>void runImport("preview")} className="bg-amber-200 p-3 rounded-lg font-semibold disabled:opacity-40">Comprobar duplicados (sin guardar)</button>
    {preview&&<>
     <p className="text-sm">Recibidas: <b>{preview.received}</b> · Nuevas: <b>{preview.newCount}</b> · Duplicadas: <b>{preview.duplicateCount}</b></p>
     <p className="text-sm">Ingresos nuevos: {money(preview.incomingCop)} · Gastos nuevos: {money(preview.expenseCop)} (saldos iniciales excluidos)</p>
     <div className="overflow-auto max-h-56"><table className="w-full text-sm"><thead><tr><th>Fecha</th><th>Tipo</th><th>Monto</th><th>Concepto</th></tr></thead><tbody>
     {rows.slice(0,150).map((r,i)=><tr key={i} className="border-t"><td>{r.date}</td><td>{r.kind}</td><td>{money(r.amountCop)}</td><td>{r.description}</td></tr>)}
     </tbody></table></div>
     <label className="flex gap-2 items-center"><input type="checkbox" checked={checked} onChange={e=>setChecked(e.target.checked)}/> Revisé los importes, tipos y filas duplicadas. Autorizo guardar únicamente las nuevas.</label>
     <button disabled={busy||!checked||preview.newCount===0} onClick={()=>void runImport("commit")} className="bg-green-800 text-white p-3 rounded-lg font-semibold disabled:opacity-40">Confirmar importación privada</button>
    </>}
   </section>
   <section className={section}>
    <h2 className="text-xl font-bold">2. Cuentas reales</h2>
    <p className="text-sm">Introduce saldos conciliados a una fecha. Actualizar un saldo existente NO crea un ingreso.</p>
    <form className="grid grid-cols-1 sm:grid-cols-4 gap-2" onSubmit={e=>{e.preventDefault();void save("account",{label:account.label,balanceCop:Number(account.balanceCop),asOfDate:account.asOfDate})}}>
     <input className={input} placeholder="Cuenta (ej. ahorros)" required maxLength={120} value={account.label} onChange={e=>setAccount({...account,label:e.target.value})}/>
     <input className={input} type="number" min="0" placeholder="Saldo COP" required value={account.balanceCop} onChange={e=>setAccount({...account,balanceCop:e.target.value})}/>
     <input className={input} type="date" required value={account.asOfDate} onChange={e=>setAccount({...account,asOfDate:e.target.value})}/>
     <button className="bg-green-800 text-white rounded-lg p-2" disabled={busy}>Guardar cuenta</button>
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
     <button className="bg-green-800 text-white rounded-lg p-2" disabled={busy}>Guardar obligación</button>
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
     <button className="bg-green-800 text-white rounded-lg p-2" disabled={busy}>Guardar evento</button>
    </form>
    {ledger?.events.slice().sort((a,b)=>a.expected_on.localeCompare(b.expected_on)).map(e=><p key={e.id} className="text-sm">{e.expected_on} · {e.label} · {e.kind==="income"?"+":"−"}{money(e.amount_cop)} · {e.status}</p>)}
   </section>
   <section className={section}><h2 className="text-xl font-bold">Movimientos ya guardados</h2><p className="text-sm">Total persistido en el nuevo libro privado: {ledger?.transactions.length||0} registros (muestra hasta 2.000). El libro comienza vacío y nunca inserta datos de demostración.</p></section>
  </div>
 </main>;
}
