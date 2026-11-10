import {NextRequest} from "next/server";
import {crmConfig,payload,failure,privateJson,rpc,dateOnly,uuid,CrmError} from "@/lib/crm-office-api";
import {lisbonDay} from "@/lib/crm-calendar";

export const runtime="nodejs";

export async function POST(request:NextRequest) {
  try {
    const config=await crmConfig(request),body=await payload(request);
    const name=typeof body.full_name==="string"?body.full_name.trim():"";
    const number=typeof body.document_number==="string"?body.document_number.trim():"";
    const today=lisbonDay(new Date().toISOString());
    if(!uuid(body.client_id) || body.reviewed!==true || typeof body.expected_updated_at!=="string" ||
       body.expected_updated_at.length>50 || !Number.isFinite(Date.parse(body.expected_updated_at)) ||
       !["passport","identity_card"].includes(String(body.document_type)) ||
       name.length<2 || name.length>160 || number.length<1 || number.length>80 ||
       !dateOnly(body.birth_date) || !dateOnly(body.expires_on) || body.birth_date>today || body.expires_on<body.birth_date) {
      throw new CrmError("Confirma o cliente, o tipo, o nome, o número e as datas do documento.");
    }
    const result=await rpc(config,"crm_save_scanned_document",{
      p_client_id:body.client_id,p_expected_updated_at:body.expected_updated_at,
      p_document_type:body.document_type,p_document_number:number,p_expires_on:body.expires_on,
      p_full_name:name,p_birth_date:body.birth_date,
    });
    return privateJson(result);
  } catch(cause) { return failure(cause); }
}
