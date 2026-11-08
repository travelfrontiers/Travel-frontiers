import type {CalendarEntry} from "./crm-office-types";
export function addDays(day:string,count:number){const date=new Date(day+"T12:00:00Z");date.setUTCDate(date.getUTCDate()+count);return date.toISOString().slice(0,10);}
export function calendarDays(anchor:string,mode:"month"|"week"){
 const date=new Date(anchor+"T12:00:00Z");if(mode==="month")date.setUTCDate(1);
 const start=addDays(date.toISOString().slice(0,10),-((date.getUTCDay()+6)%7));
 return Array.from({length:mode==="month"?42:7},(_,index)=>addDays(start,index));
}
export function lisbonDay(timestamp:string){return new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Lisbon",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(timestamp));}
export const calendarKinds:Record<CalendarEntry["kind"],string>={departure:"Partida",return:"Regresso",task:"Tarefa",followup:"Próximo contacto",document:"Validade de documento",proposal:"Validade de proposta"};
