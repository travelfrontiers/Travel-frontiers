import type {calculateCommission, CommissionInputs} from "./commission";

export const receiptKinds = {
  customer_payment: "Pagamento do cliente",
  customer_refund: "Reembolso ao cliente",
  commission_payment: "Comissão recebida",
  commission_refund: "Comissão devolvida",
} as const;
export const receiptMethods = {transfer:"Transferência",card:"Cartão",cash:"Numerário",other:"Outro"} as const;
export const receiptParties = {agency:"GupiTravel",consultant:"Consultor"} as const;
export const commissionStates = {
  uncalculated:"Por calcular",awaiting:"A confirmar",confirmed:"Confirmada",partial:"Parcialmente recebida",received:"Recebida",settled:"Regularizada",
} as const;
export type CommissionReview = {
  id:number;kind:"confirmation"|"settlement";amount:number;currency:string;effective_on:string;reference:string;notes:string|null;created_at:string;
  document_id:string|null;estimated_at_settlement:number|null;received_at_settlement:number|null;
  document?:{file_name:string;drive_file_id:string}|null;
};
export type FinanceSummary = {
  trip_id:string;destination:string|null;reference:string|null;client_name:string|null;status:string;currency:string;archived_at:string|null;
  total_amount:number|null;customer_received:number;customer_refunded:number;customer_net:number;balance:number|null;
  scheduled_total:number;unscheduled_amount:number|null;overdue_amount:number;overdue_count:number;
  due_soon_amount:number;next_due_on:string|null;commission_expected:number|null;commission_net:number;
  commission_balance:number|null;version:number;
  operator?:string|null;departure_date?:string|null;return_date?:string|null;traveler_id?:string|null;traveler_ids?:string[];
  commission_confirmed?:number|null;commission_confirmed_on?:string|null;
  commission_to_receive?:number|null;commission_discrepancy?:number|null;
  commission_state?:keyof typeof commissionStates;commission_has_discrepancy?:boolean;
};
export type PaymentSchedule = {
  id:string;trip_id:string;label:string;amount:number;due_on:string;amount_remaining:number;
  currency:string;destination:string|null;client_ids:string[];client_id:string|null;
};
export type Receipt = {
  id:string;kind:keyof typeof receiptKinds;amount:number;paid_on:string;method:keyof typeof receiptMethods;
  received_by:keyof typeof receiptParties;reference:string|null;notes:string|null;document_id:string|null;
};
export type FinanceDetail = {
  summary:FinanceSummary;adults:number|null;children_count:number|null;traveler_count:number;
  commission:{inputs:CommissionInputs;result:ReturnType<typeof calculateCommission>;rules_version:string;saved_at:string;
    source:{total_amount:number|null;currency:string;adults:number|null;children_count:number|null}}|null;
  reviews?:CommissionReview[];
  schedule:PaymentSchedule[];receipts:Receipt[];files:{id:string;file_name:string;drive_file_id:string}[];
};
export function formatMoney(value:number|null,currency:string) {
  if(value===null) return "Por definir";
  try {return new Intl.NumberFormat("pt-PT",{style:"currency",currency,minimumFractionDigits:2,maximumFractionDigits:2}).format(value);}
  catch {return value.toFixed(2)+" "+currency;}
}
export const formatFinanceDate=(value:string)=>value.split("-").reverse().join("/");
