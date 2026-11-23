/** Pure projection only: no writes, no rewards, no bank operations. */
export type CashflowDebt={id:string;creditor:string;amount_due_cop:number|string;due_date:string|null;status:string};
export type CashflowEvent={id:string;label:string;expected_on:string;amount_cop:number|string;kind:string;status:string};
export type CashflowAccount={balance_cop:number|string;as_of_date:string};
export type CashflowItem={id:string;date:string;label:string;kind:"debt"|"expense"|"income";amount:number;undated:boolean;overdue:boolean};
export function isCalendarDate(value:string):boolean {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const t=new Date(value+"T12:00:00Z");
  return Number.isFinite(t.valueOf())&&t.toISOString().slice(0,10)===value;
}
function amount(v:number|string):number {
  const n=Number(v);if(!Number.isSafeInteger(n)||n<0)throw new Error("Invalid COP amount");
  return n;
}
export function projectCashflow(input:{
  today:string;until:string;accounts:CashflowAccount[];debts:CashflowDebt[];events:CashflowEvent[];
  reserveCop:number;additionalExpenseIds:readonly string[];
}){
  if(!isCalendarDate(input.today)||!isCalendarDate(input.until)||input.until<input.today)throw new Error("Invalid projection horizon");
  const reserve=amount(input.reserveCop);
  const cash=input.accounts.reduce((s,a)=>s+amount(a.balance_cop),0);
  const issues:string[]=[];
  if(!input.accounts.length)issues.push("No hay cuentas conciliadas.");
  if(input.accounts.some(a=>a.as_of_date!==input.today))issues.push("Hay saldos con fecha distinta de hoy: verifica movimientos posteriores y fechas futuras.");
  const items:CashflowItem[]=[];
  for(const d of input.debts){
    if(d.status==="settled"||amount(d.amount_due_cop)===0)continue;
    const valid=d.due_date!==null&&isCalendarDate(d.due_date);
    const dueDate=valid?d.due_date!:input.today;
    const date=dueDate<input.today?input.today:dueDate;
    if(!valid)issues.push("Hay una deuda sin vencimiento confirmado: se reserva desde hoy.");
    if(date<=input.until)items.push({id:"debt:"+d.id,date,label:d.creditor,kind:"debt",amount:amount(d.amount_due_cop),undated:!valid,overdue:dueDate<input.today||d.status==="overdue"});
  }
  const selected=new Set(input.additionalExpenseIds);
  const unreviewedExpenseIds:string[]=[];
  for(const e of input.events){
    if(e.status!=="expected"||!isCalendarDate(e.expected_on))continue;
    if(e.kind==="income"){
      if(e.expected_on<input.today){issues.push("Hay ingresos previstos cuya fecha pasó: concilia si se recibieron.");continue;}
      if(e.expected_on<=input.until)items.push({id:"event:"+e.id,date:e.expected_on,label:e.label,kind:"income",amount:amount(e.amount_cop),undated:false,overdue:false});
    }else if(e.kind==="expense"){
      const date=e.expected_on<input.today?input.today:e.expected_on;
      if(date>input.until)continue;
      if(!selected.has(e.id)){unreviewedExpenseIds.push(e.id);continue;}
      items.push({id:"event:"+e.id,date,label:e.label,kind:"expense",amount:amount(e.amount_cop),undated:false,overdue:e.expected_on<input.today});
    }
  }
  if(unreviewedExpenseIds.length)issues.push("Hay pagos previstos excluidos: revisa si son cuotas ya contempladas o gastos adicionales.");
  // Outflows first on the same day: salary on a due date is not guaranteed before payment.
  const priority={debt:0,expense:1,income:2};
  items.sort((a,b)=>a.date.localeCompare(b.date)||priority[a.kind]-priority[b.kind]||a.id.localeCompare(b.id));
  let base=cash-reserve,withExpected=base,minBase=base,minExpected=base;
  const timeline=items.map(item=>{
    if(item.kind==="income")withExpected+=item.amount;
    else{base-=item.amount;withExpected-=item.amount;}
    minBase=Math.min(minBase,base);minExpected=Math.min(minExpected,withExpected);
    return {...item,withoutExpected:base,withExpected};
  });
  return {cash,reserve,startingAfterReserve:cash-reserve,timeline,
    finalWithoutExpected:base,finalWithExpected:withExpected,
    maximumShortfallWithoutExpected:Math.max(0,-minBase),maximumShortfallWithExpected:Math.max(0,-minExpected),
    unreviewedExpenseIds,issues};
}
