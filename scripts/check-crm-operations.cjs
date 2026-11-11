const assert = require("node:assert/strict");
const ts = require("typescript");
const fs = require("node:fs");
const base=require("node:path").resolve(__dirname, "..") + "/";
let calls=[], mails=0, lastMail, authorized=true, reply={ok:true,status:200,data:{}};
const env={SUPABASE_SECRET_KEY:"synthetic-only",CRM_SMTP_HOST:"example.invalid",CRM_SMTP_USER:"synthetic@example.invalid",CRM_SMTP_PASSWORD:"synthetic",CRM_NOTIFICATION_TO:"synthetic@example.invalid",CRON_SECRET:"synthetic-cron",VERCEL_ENV:"production"};
function load(path){
 const output=ts.transpileModule(fs.readFileSync(base+path,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 const mod={exports:{}};
 const req=(name)=>{
  if(name==="next/server")return {NextResponse:{json:(data,options={})=>({status:options.status||200,body:data,headers:options.headers})}};
  if(name==="@/lib/crm-api")return {isAuthorizedStudioUser:async()=>authorized,supabaseAdminConfig:()=>({url:"https://db.example.invalid",headers:{apikey:"synthetic"}})};
  if(name==="nodemailer")return {createTransport:()=>({sendMail:async(mail)=>{mails++;lastMail=mail;}})};
  if(name.startsWith("@/"))return load("src/"+name.slice(2)+".ts");
  return require(name);
 };
 new Function("require","module","exports","fetch","process",output)(req,mod,mod.exports,async(url,init={})=>{calls.push({url,init});return typeof reply==="function"?reply(url,init):{ok:reply.ok,status:reply.status,headers:new Headers(reply.headers),json:async()=>reply.data};},{env});
 return mod.exports;
}
const id="12345678-1234-4123-8123-123456789abc";
const request=(body,headers={})=>({json:async()=>body,text:async()=>JSON.stringify(body),headers:new Headers(headers)});
(async()=>{
 const trips=load("src/app/api/crm/trips/[id]/route.ts");
 const body={status:"planning",destination:"Synthetic",departure_date:"2027-04-06",return_date:"2027-04-17",client_ids:[id],currency:"EUR"};
 reply.data={id,client_ids:[id]};
 let result=await trips.PATCH(request(body),{params:Promise.resolve({id})});
 assert.equal(result.status,200);assert.equal(calls.length,1);assert.ok(calls[0].url.endsWith("/rpc/crm_update_trip"));assert.equal(calls[0].init.method,"POST");
 calls=[];reply={ok:false,status:400,data:{message:"client_not_found"}};
 result=await trips.PATCH(request(body),{params:Promise.resolve({id})});
 assert.equal(result.status,409);assert.equal(calls.length,1);
 const documents=load("src/app/api/crm/documents/[id]/route.ts");
 calls=[];reply={ok:true,status:200,data:[{id}]};
 result=await documents.DELETE(request({}),{params:Promise.resolve({id})});
 assert.equal(result.status,200);assert.equal(calls.length,1);assert.equal(calls[0].init.method,"DELETE");
 calls=[];reply.data=[];
 result=await documents.DELETE(request({}),{params:Promise.resolve({id})});assert.equal(result.status,404);
 const params={params:Promise.resolve({id})};
 calls=[];reply={ok:false,status:400,data:{message:"trip_has_finance"}};
 result=await trips.DELETE(request({}),params);
 assert.equal(result.status,409);assert.match(result.body.error,/Arquivar viagem/);
 const leads=load("src/app/api/crm/leads/[id]/route.ts");
 reply={ok:true,status:200,data:[{archived_at:"2026-11-11T00:00:00Z"}]};
 result=await leads.PATCH(request({archived:true}),params);
 assert.equal(result.status,200);assert.ok(result.body.archived_at);
 reply.data=[{archived_at:null}];
 result=await leads.PATCH(request({archived:false}),params);
 assert.equal(result.status,200);assert.equal(result.body.archived_at,null);
 reply={ok:false,status:400,data:{message:"lead_has_links"}};
 result=await leads.DELETE(request({}),params);assert.equal(result.status,409);
 reply={ok:true,status:200,data:[{id}]};
 result=await leads.DELETE(request({}),params);assert.equal(result.status,200);
 authorized=false;calls=[];
 result=await leads.DELETE(request({}),params);assert.equal(result.status,401);assert.equal(calls.length,0);
 authorized=true;

 const allLeads=load("src/app/api/crm/leads/route.ts");
 const records=Array.from({length:1101},(_,i)=>({id:i,status:"new"}));
 calls=[];
 reply=(url,init)=>{
  const query=new URL(url).searchParams;
  const offset=Number(query.get("offset"));
  assert.equal(query.get("order"),"created_at.desc,id");
  const page=records.slice(offset,offset+300);
  const total=init.headers.Prefer==="count=exact"?records.length:"*";
  return {ok:true,status:206,headers:new Headers({"Content-Range":offset+"-"+(offset+page.length-1)+"/"+total}),json:async()=>page};
 };
 result=await allLeads.GET(request({}));
 assert.equal(result.status,200);assert.deepEqual(result.body.leads,records);assert.equal(calls.length,4);

 const {combineIdentityPages,readIdentityPage}=load("src/lib/crm-document-ocr.ts");
 const read=(text)=>readIdentityPage([text],"2026-11-11");
 const passport=read("PASSPORT\nFULL NAME: ANA SILVA\nDATE OF BIRTH: 1990-04-06");
 const identityCard=read("CARTÃO DE CIDADÃO\nVALIDADE: 2031-04-06");
 assert.equal(passport.full_name,"Ana Silva");assert.equal(identityCard.expires_on,"2031-04-06");
 assert.throws(()=>combineIdentityPages([passport,identityCard]),/páginas têm dados diferentes/);
 const unrelated=read("PASSPORT\nDATE OF EXPIRY: 2031-04-06");
 assert.equal(combineIdentityPages([passport,unrelated]).expires_on,"");
 const matching={...passport,full_name:"",document_number:"AB123456",expires_on:"2031-04-06"};
 const combined=combineIdentityPages([{...passport,document_number:"AB123456"},matching]);
 assert.equal(combined.expires_on,"2031-04-06");assert.equal(combined.full_name,"Ana Silva");

 const partial=read("NOME COMPLETO: ANA SILVA\nDATA DE NASCIMENTO: 06/04/1990\nN.º DO DOCUMENTO: AB123456");
 assert.equal(partial.document_type,null);assert.equal(partial.full_name,"Ana Silva");assert.equal(partial.birth_date,"1990-04-06");assert.equal(partial.document_number,"AB123456");
 assert.equal(read("PASSPORT\nPASSPORT NO. AB123456\nPASSPORT NO. CD123456").document_number,"");
 assert.equal(read("PASSPORT\nPASSPORT NO.\n2031-04-06").document_number,"");
 assert.equal(combineIdentityPages([passport,{...passport,expires_on:"2031-04-06"}]).expires_on,"2031-04-06");
 assert.deepEqual(read("SEM DADOS"),{document_type:null,full_name:"",birth_date:"",expires_on:"",document_number:""});

 const accentedPassport=readIdentityPage([
  "PASSAPORTE\n[01] PINTO EXEMPLO\n[02] JOÃO",
  "PPPRTPINTO<EXEMPLO<<JOAO<<<<<<<<<<<<<<<<<<<<<<\nL898902C36UTO7408122F1204159ZE184226B<<<<<10",
 ],"2026-11-11");
 assert.equal(accentedPassport.full_name,"João Pinto Exemplo");
 assert.equal(accentedPassport.document_number,"L898902C3");
 assert.equal(accentedPassport.expires_on,"2012-04-15");
 assert.equal(read("PASSAPORTE\nVálido até 05.06.2031").expires_on,"2031-06-05");

 const form=load("src/app/api/trip-requests/route.ts");
 const lead={full_name:"Synthetic Test",email:"synthetic@example.invalid",destination:"Synthetic",adults:2,children_count:2,children_ages:[1,7],budget:"1500_2000",date_flexible:true,travel_period:"Segunda quinzena de abril",consent_privacy:true};
 calls=[];
 result=await form.POST(request({...lead,travel_period:" "}));
 assert.equal(result.status,400);assert.equal(result.body.field,"dates");assert.equal(calls.length,0);
 calls=[];reply={ok:false,status:400,data:{message:"rate_limited"}};
 result=await form.POST(request(lead,{"x-forwarded-for":"192.0.2.1"}));assert.equal(result.status,429);assert.equal(mails,0);assert.ok(calls[0].url.endsWith("/rpc/crm_submit_public_request"));const payload=JSON.parse(calls[0].init.body);assert.equal(payload.p_lead.travel_period,lead.travel_period);assert.match(payload.p_client_hash,/^[a-f0-9]{64}$/);assert.ok(!calls[0].init.body.includes("192.0.2.1"));
 reply={ok:true,status:200,data:{duplicate:true}};result=await form.POST(request(lead));assert.equal(result.status,200);assert.equal(mails,0);
 reply={ok:true,status:200,data:{duplicate:false}};result=await form.POST(request(lead));assert.equal(result.status,200);assert.equal(mails,1);assert.match(lastMail.text,/Período aproximado: Segunda quinzena de abril/);
 reply={ok:true,status:200,data:{duplicate:true}};
 result=await form.POST(request({...lead,travel_period:null,departure_date:"2027-04-06",return_date:"2027-04-17"}));
 assert.equal(result.status,200);
 const cron=load("src/app/api/crm/checkin-reminders/route.ts");
 calls=[];result=await cron.GET(request({},{"x-vercel-cron":"1"}));assert.equal(result.status,401);assert.equal(calls.length,0);
 const drive=load("src/app/api/crm/drive/route.ts");
 authorized=false;calls=[];result=await drive.GET(request({}));assert.equal(result.status,401);assert.equal(calls.length,0);
 const upload=load("src/lib/crm-drive-upload.ts").uploadCrmDriveFile;
 const file=new File([new Uint8Array(6*1024*1024)],"Synthetic.pdf",{type:"application/pdf"});
 const uploadedCalls=[];
 const send=async(url,init)=>{uploadedCalls.push({url,init});return uploadedCalls.length===1?{ok:true,headers:new Headers({Location:"https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=synthetic"})}:{ok:true,json:async()=>({id:"synthetic_file_id",name:file.name,mimeType:file.type})};};
 await upload(file,"synthetic-token","synthetic-folder",send);
 assert.equal(uploadedCalls.length,2);assert.equal(uploadedCalls[1].init.method,"PUT");assert.equal(uploadedCalls[1].init.body,file);
 let attempts=0;await assert.rejects(upload(file,"synthetic-token","synthetic-folder",async()=>{attempts++;return {ok:true,headers:new Headers({Location:"https://untrusted.invalid/upload/drive/files"})};}));assert.equal(attempts,1);
 console.log("PASS: atomic RPC-only trip save; missing-client rollback error; document delete/404; public rate limit; hashed IP; dedup suppresses mail; new request notifies; cron rejects forged header; Drive requires CRM auth; archive and guarded deletes; pagination beyond 1,000; document isolation; flexible period validation and notification.");
})().catch(error=>{console.error(error);process.exitCode=1});

