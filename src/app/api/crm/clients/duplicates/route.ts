import {NextRequest} from "next/server";
import {crmConfig,payload,failure,privateJson,rpc,uuid,dateOnly,CrmError} from "@/lib/crm-office-api";
import {lisbonDay} from "@/lib/crm-calendar";
export const runtime="nodejs";
export async function GET(request:NextRequest){try{const config=await crmConfig(request);return privateJson({pairs:await rpc(config,"crm_duplicate_candidates",{})});}catch(cause){return failure(cause);}}
export async function POST(request:NextRequest){try{
 const config=await crmConfig(request),body=await payload(request),fields=body.fields as Record<string,unknown>;
 if(body.confirmed!==true||!uuid(body.source_id)||!uuid(body.target_id)||body.source_id===body.target_id||!fields||typeof fields!=="object")throw new CrmError("Confirma duas fichas diferentes.");
 const birthDate=fields.birth_date;
 if(birthDate!==undefined&&birthDate!==""&&birthDate!==null&&(!dateOnly(birthDate)||birthDate>lisbonDay(new Date().toISOString())))throw new CrmError("Indica uma data de nascimento válida.");
 const fullName=typeof fields.full_name==="string"?fields.full_name.trim():"";
 const email=typeof fields.email==="string"?fields.email.trim().toLowerCase():"";
 const phone=typeof fields.phone==="string"?fields.phone.trim():"";
 const notes=typeof fields.internal_notes==="string"?fields.internal_notes.trim():"";
 if(fullName.length<2||fullName.length>160||email.length>254||email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||phone.length>40||notes.length>4000||!["pt","en","fr"].includes(String(fields.language)))throw new CrmError("Revê os dados finais da ficha a manter.");
 await rpc(config,"crm_merge_clients",{p_source:body.source_id,p_target:body.target_id,p_fields:{full_name:fullName,email,phone,language:fields.language,internal_notes:notes,...(birthDate===undefined?{}:{birth_date:birthDate||null})}});
 return privateJson({client_id:body.target_id});
}catch(cause){return failure(cause);}}

