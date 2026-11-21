import type { ParsedFinanceRow as FinanceRow } from "./finance-validation.ts";
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
 if(!clean||!/^\d[\d.,]*$/.test(clean)) return NaN;
 let number=clean;
 if(clean.includes(",")&&clean.includes(".")){
   number=clean.lastIndexOf(",")>clean.lastIndexOf(".")
     ?clean.replace(/\./g,"").replace(",","."):clean.replace(/,/g,"");
 }else if(/^\d{1,3}(\.\d{3})+$/.test(clean)) number=clean.replace(/\./g,"");
 else if(/^\d{1,3}(,\d{3})+$/.test(clean)) number=clean.replace(/,/g,"");
 else if(clean.includes(",")) number=clean.replace(",",".");
 const amount=Number(number);
 return Number.isSafeInteger(amount)?amount:NaN;
}
export function parseFinanceCsv(raw:string):FinanceRow[] {
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
   if(cells.length!==headers.length)throw new Error("Número de columnas inválido en fila "+(pos+2));
   const pick=(i:number)=>i<0?"":(cells[i]||"").trim();
   const date=pick(columns.date).replace(/^"|"$/g,"").replace(/\//g,"-").replace("T"," ");
   const originalType=headWords(pick(columns.kind)),description=pick(columns.description);
   const amountCop=parseCop(pick(columns.amount));
   if(!Number.isSafeInteger(amountCop)||amountCop<=0||amountCop>100_000_000_000)throw new Error("Monto inválido en fila "+(pos+2));
   const kinds:Record<string,FinanceRow["kind"]>={ingreso:"income",gasto:"expense",transferencia:"transfer","saldo inicial":"opening_balance"};
   if(!Object.hasOwn(kinds,originalType))throw new Error("Tipo no reconocido en fila "+(pos+2));
   let kind=kinds[originalType];
   if(/^(inicial cuenta|inicial efectivo)$/i.test(description))kind="opening_balance";
   if(!/^\d{4}-\d{2}-\d{2}(?: \d{1,2}:\d{2})?$/.test(date))throw new Error("Fecha no reconocida en fila "+(pos+2));
   return {date,kind,category:pick(columns.category)||"Otros",description,amountCop,
      paymentMethod:pick(columns.method)||"Transferencia"};
 });
 if(list.length>150)throw new Error("Importa un máximo de 150 registros por archivo.");
 return list;
}
