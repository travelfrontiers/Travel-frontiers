export type AuthorizedFetch=(url:string,init?:RequestInit)=>Promise<Response>;
export type OfficeClient={id:string;birth_date?:string|null;full_name:string;email:string|null;phone:string|null;language:"pt"|"en"|"fr";internal_notes:string|null};
export type OfficeLead={id:string;full_name:string;destination:string|null;client_id:string|null;status:string;departure_date:string|null;return_date:string|null};
export type OfficeTrip={id:string;destination:string|null;client_id:string|null;client_ids:string[];lead_id:string|null;reference:string|null;departure_date:string|null;return_date:string|null;status:string};
export type EntityContext={type:"client"|"lead"|"trip"|"proposal";id:string;label?:string};
export type OpenTarget=EntityContext & {taskId?:string;finance?:boolean};
export type Proposal={id:string;title:string;status:"draft"|"sent"|"accepted"|"declined"|"archived";current_version:number;client_id:string|null;lead_id:string|null;trip_id:string|null;created_at:string;updated_at:string;confirmation_note:string|null;client_name?:string|null;total_amount?:number;currency?:string;valid_until?:string|null;destination?:string|null};
export type ProposalVersion={id:string;proposal_id:string;version:number;title:string;total_amount:number;currency:string;valid_until:string|null;destination:string|null;departure_date:string|null;return_date:string|null;operator:string|null;conditions:string|null;inclusions:string|null;exclusions:string|null;notes:string|null;document_id:string|null;created_at:string};
export type ChecklistItem={id?:string;title:string;anchor:"departure"|"return"|"manual";offset_days:number;phase:"before"|"during"|"after";sort_order:number;active?:boolean};
export type ChecklistTemplate={id:string;name:string;travel_type:string;active:boolean;auto_apply:boolean;items:ChecklistItem[];updated_at:string};
export type CalendarEntry={id:string;date:string;title:string;detail:string;kind:"departure"|"return"|"task"|"followup"|"document"|"proposal"|"payment";done:boolean;target:OpenTarget;clientIds:string[]};
export const travelTypeLabels:Record<string,string>={all:"Todos os tipos",general:"Geral",beach:"Praia",circuit:"Circuito",city:"Cidade",honeymoon:"Lua de mel",family:"Família",business:"Negócios",custom:"Outro"};
export const proposalStatusLabels:Record<string,string>={draft:"Rascunho",sent:"Enviada",accepted:"Aceite por email",declined:"Recusada",archived:"Arquivada"};
export const officeInput="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-orange-700 focus:ring-2 focus:ring-orange-700/20";
export const officeButton="rounded-full bg-orange-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50";
export const officeSecondary="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50";

