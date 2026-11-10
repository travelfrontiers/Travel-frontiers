import {NextRequest} from "next/server";
import {crmConfig,payload,failure,privateJson,rpc,uuid,dateOnly,CrmError} from "@/lib/crm-office-api";
export const runtime="nodejs";
export async function GET(request:NextRequest){try{
 const config=await crmConfig(request),search=request.nextUrl.searchParams;
 const offset=Number(search.get("offset")||0);if(!Number.isInteger(offset)||offset<0||offset>100000)throw new CrmError("Página inválida.");
 const q=new URLSearchParams({select:"*",order:"created_at.desc,id.desc",limit:"40",offset:String(offset)});
 for(const key of ["client_id","trip_id","lead_id","proposal_id"]){const value=search.get(key);if(value){if(!uuid(value))throw new CrmError("Ficha inválida.");q.set(key,"eq."+value);}}
 const type=search.get("entity_type");if(type){if(!["client","trip","lead","proposal","document","proposal_version","payment","task","service","template"].includes(type))throw new CrmError("Tipo inválido.");q.set("entity_type","eq."+type);}
 const action=search.get("action");if(action){if(!["insert","update","delete","merge","note"].includes(action))throw new CrmError("Ação inválida.");q.set("action","eq."+action);}
 const after=search.get("after");if(after){if(!dateOnly(after))throw new CrmError("Data inválida.");q.set("created_at","gte."+after+"T00:00:00Z");}
 const text=(search.get("q")||"").trim().slice(0,100).replace(/[*,%()]/g,"");if(text)q.set("label","ilike.*"+text+"*");
 if(search.get("hide_system")==="true")q.set("actor","eq.admin");
 const response=await fetch(config.url+"/rest/v1/crm_activity?"+q,{headers:{...config.headers,Prefer:"count=exact"},cache:"no-store"});
 if(!response.ok)throw new CrmError("Não foi possível carregar o histórico.",502);
 return privateJson({events:await response.json(),total:Number(response.headers.get("content-range")?.split("/")[1]||0)});
}catch(cause){return failure(cause);}}
export async function POST(request:NextRequest){try{
 const config=await crmConfig(request),body=await payload(request);
 if(!["client","lead","trip","proposal"].includes(String(body.entity_type))||!uuid(body.entity_id)||typeof body.note!=="string"||body.note.trim().length<2||body.note.trim().length>2000)throw new CrmError("Escolhe uma ficha e escreve uma nota entre 2 e 2000 caracteres.");
 await rpc(config,"crm_add_activity_note",{p_type:body.entity_type,p_id:body.entity_id,p_note:body.note.trim()});
 return privateJson({ok:true},201);
}catch(cause){return failure(cause);}}

