import {NextRequest} from "next/server";
import {calculateCommission, commissionRulesVersion, type CommissionInputs} from "@/lib/commission";
import {crmConfig, payload, failure, privateJson, rpc, rows, uuid, nullableId, dateOnly, CrmError} from "@/lib/crm-office-api";
import {lisbonDay} from "@/lib/crm-calendar";
import {receiptKinds, receiptMethods, receiptParties, type FinanceDetail, type FinanceSummary} from "@/lib/crm-finance";

export const runtime="nodejs";
const maxAmount=9999999999.99;
function money(value:unknown, minimum=0, maximum=maxAmount) {
  if ((typeof value!=="string" && typeof value!=="number") || !/^\d{1,10}(?:\.\d{1,2})?$/.test(String(value))) {
    throw new CrmError("Indica um montante válido com até duas casas decimais.");
  }
  const amount=Number(value);
  if(amount<minimum || amount>maximum) throw new CrmError("O montante está fora do intervalo permitido.");
  return amount;
}
function date(value:unknown) {
  if(!dateOnly(value)) throw new CrmError("Indica uma data válida.");
  return value;
}
function cleanText(value:unknown, maximum:number, required=false) {
  const result=typeof value==="string"?value.trim():"";
  if(result.length>maximum || (required&&!result)) throw new CrmError("Revê os campos de texto.");
  return result;
}
function commissionInputs(raw:unknown):CommissionInputs {
  if(!raw || typeof raw!=="object" || Array.isArray(raw)) throw new CrmError("Revê os dados da calculadora.");
  const input=raw as Record<string,unknown>;
  if(typeof input.travelerCount!=="number" || !Number.isInteger(input.travelerCount) || input.travelerCount<1 || input.travelerCount>50 ||
     typeof input.selfTravels!=="boolean" || typeof input.shareSaving!=="boolean" || typeof input.cedeCommission!=="boolean") {
    throw new CrmError("Indica um número de viajantes entre 1 e 50 e revê as opções.");
  }
  return {
    commission:money(input.commission,0,1e8),travelerCount:input.travelerCount,travelerPrice:money(input.travelerPrice,0,1e8),
    selfTravels:input.selfTravels,costPerTraveler:money(input.costPerTraveler,0,1e8),shareSaving:input.shareSaving,
    cedeCommission:input.cedeCommission,requestedCession:money(input.requestedCession,0,1e8),
  };
}
export async function GET(request:NextRequest) {
  try {
    const config=await crmConfig(request);
    const tripId=request.nextUrl.searchParams.get("trip_id");
    if(tripId) {
      if(!uuid(tripId)) throw new CrmError("Viagem inválida.");
      const detail=await rpc<FinanceDetail|null>(config,"crm_finance_detail",{p_trip_id:tripId});
      if(!detail) throw new CrmError("A viagem já não existe.",404);
      return privateJson(detail);
    }
    const params=new URLSearchParams({select:"*",order:"next_due_on.asc.nullslast,trip_id"});
    if(request.nextUrl.searchParams.get("alerts")==="true") {
      params.set("status","neq.cancelled");
      params.set("or","(overdue_amount.gt.0,due_soon_amount.gt.0)");
    }
    return privateJson({trips:await rows<FinanceSummary>(config,"crm_trip_finance_overview",params)});
  } catch(cause) { return failure(cause); }
}

export async function POST(request:NextRequest) {
  try {
    const config=await crmConfig(request);
    const body=await payload(request);
    if(!uuid(body.trip_id) || typeof body.expected_version!=="number" ||
       !Number.isInteger(body.expected_version) || body.expected_version<0 || body.expected_version>2147483647) {
      throw new CrmError("Viagem ou versão inválida.");
    }
    if(!nullableId(body.id)) throw new CrmError("Registo inválido.");
    const id=body.id||null;
    let data:Record<string,unknown>;
    switch(body.action) {
      case "total_save":
        data={amount:money(body.amount)};
        break;
      case "schedule_save":
        data={id,label:cleanText(body.label,160,true),amount:money(body.amount,0.01),due_on:date(body.due_on)};
        break;
      case "build_plan":
        data={deposit_amount:money(body.deposit_amount),
          deposit_due_on:body.deposit_due_on?date(body.deposit_due_on):null,
          balance_due_on:body.balance_due_on?date(body.balance_due_on):null};
        break;
      case "receipt_save":
        if(typeof body.kind!=="string" || !Object.hasOwn(receiptKinds,body.kind) ||
           typeof body.method!=="string" || !Object.hasOwn(receiptMethods,body.method) ||
           typeof body.received_by!=="string" || !Object.hasOwn(receiptParties,body.received_by) || !nullableId(body.document_id)) {
          throw new CrmError("Revê o tipo, a confirmação e o comprovativo do movimento.");
        }
        if(date(body.paid_on)>lisbonDay(new Date().toISOString())) throw new CrmError("A data do movimento não pode estar no futuro.");
        data={id,kind:body.kind,amount:money(body.amount,0.01),paid_on:body.paid_on,method:body.method,
          received_by:body.received_by,document_id:body.document_id||null,reference:cleanText(body.reference,160),notes:cleanText(body.notes,2000)};
        break;
      case "schedule_delete":
      case "receipt_delete":
        if(!uuid(id)) throw new CrmError("Seleciona o registo a remover.");
        data={id};
        break;
      case "commission_save": {
        const inputs=commissionInputs(body.inputs);
        const result=calculateCommission(inputs);
        data={snapshot:{inputs,result,rules_version:commissionRulesVersion},apply_to_total:body.apply_to_total===true};
        break;
      }
      case "commission_clear":
        data={};
        break;
      default:
        throw new CrmError("Ação inválida.");
    }
    await rpc(config,"crm_finance_mutate",{p_trip_id:body.trip_id,p_expected_version:body.expected_version,p_action:body.action,p_data:data});
    return privateJson({ok:true});
  } catch(cause) { return failure(cause); }
}
