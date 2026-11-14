const assert = require("node:assert/strict");
const ts = require("typescript");
const fs = require("node:fs");
const base=require("node:path").resolve(__dirname, "..") + "/";
const modules = new Map();
let calls=[], mails=0, lastMail, authorized=true, reply={ok:true,status:200,data:{}};
const env={SUPABASE_SECRET_KEY:"synthetic-only",CRM_SMTP_HOST:"example.invalid",CRM_SMTP_USER:"synthetic@example.invalid",CRM_SMTP_PASSWORD:"synthetic",CRM_NOTIFICATION_TO:"synthetic@example.invalid",CRON_SECRET:"synthetic-cron",VERCEL_ENV:"production"};
function load(path){
 if(modules.has(path)) return modules.get(path).exports;
 const output=ts.transpileModule(fs.readFileSync(base+path,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 const mod={exports:{}};
 modules.set(path,mod);
 const req=(name)=>{
  if(name==="next/server")return {NextResponse:{json:(data,options={})=>({status:options.status||200,body:data,headers:options.headers})}};
  if(name==="@/lib/crm-api")return {isAuthorizedStudioUser:async()=>authorized,supabaseAdminConfig:()=>({url:"https://db.example.invalid",headers:{apikey:"synthetic"}})};
  if(name==="nodemailer")return {createTransport:()=>({sendMail:async(mail)=>{mails++;lastMail=mail;}})};
  if(name.startsWith("@/"))return load("src/"+name.slice(2)+".ts");
  if(name.startsWith("."))return load(require("node:path").posix.join(require("node:path").posix.dirname(path),name)+".ts");
  return require(name);
 };
 new Function("require","module","exports","fetch","process",output)(req,mod,mod.exports,async(url,init={})=>{calls.push({url,init});return typeof reply==="function"?reply(url,init):{ok:reply.ok,status:reply.status,headers:new Headers(reply.headers),json:async()=>reply.data,text:async()=>reply.status===204?"":JSON.stringify(reply.data)};},{env});
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

 const manual={full_name:"Pedido fictício",source:"whatsapp",phone:"+351000000000",follow_up_date:"2026-11-20"};
 calls=[];reply={ok:true,status:201,data:[{id,...manual,status:"new"}]};
 result=await allLeads.POST(request(manual));
 assert.equal(result.status,201);
 assert.equal(JSON.parse(calls[0].init.body).email,null);
 assert.equal(JSON.parse(calls[0].init.body).follow_up_date,manual.follow_up_date);
 calls=[];result=await allLeads.POST(request({...manual,source:"public_form"}));
 assert.equal(result.status,400);assert.equal(calls.length,0);
 calls=[];result=await leads.PATCH(request({...manual,action:"edit_details",client_id:id}),params);
 assert.equal(result.status,200);assert.ok(!Object.hasOwn(JSON.parse(calls[0].init.body),"client_id"));
 assert.match(new URL(calls[0].url).searchParams.get("source"),/whatsapp/);

 const templateApi=load("src/app/api/crm/email/templates/route.ts");
 calls=[];reply={ok:true,status:200,data:[{template_key:"received",subject:"Edited",body:"Dear {{cliente}}"}]};
 result=await templateApi.GET({nextUrl:new URL("https://example.invalid/?language=en")});
 assert.equal(result.status,200);assert.equal(result.body.templates.find(item=>item.key==="received").subject,"Edited");
 assert.ok(result.body.templates.some(item=>item.key==="quote"));
 calls=[];reply={ok:true,status:204,data:null};
 result=await templateApi.POST(request({key:"received",language:"en",subject:"Edited",body:"Dear {{cliente}}"}));
 assert.equal(result.status,200);assert.equal(JSON.parse(calls[0].init.body).language,"en");assert.equal(calls.length,1);
 calls=[];authorized=false;result=await templateApi.POST(request({key:"received",language:"en",subject:"Edited",body:"Dear {{cliente}}"}));
 assert.equal(result.status,401);assert.equal(calls.length,0);authorized=true;

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
 const noisyPassport=read("P<PRTEXEMPLO<<ANA<MARIA<<<<<<<<<<<<<<<<<<<<<<\nAB12345671PRT9002155F3205013<<<<<<<<<<<<<<Q@Q");
 assert.equal(noisyPassport.document_number,"AB1234567");
 assert.equal(noisyPassport.birth_date,"1990-02-15");
 assert.equal(noisyPassport.expires_on,"2032-05-01");
 const passportCover = "PASSAPORTE\n[01] SILVA EXEMPLO\n[02] ANA MARIA\n[05] 12.09.1990\n[11] 25.09.2035\nDATE OF BIRTH: 12.09.2022\nDATE OF EXPIRY: 27.08.2035";
 const checkDigit = value => String([...value].reduce((sum, character, index) =>
  sum + Math.max(0, "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ".indexOf(character)) * [7, 3, 1][index % 3], 0) % 10);
 const validNumber = "XY123456";
 const numberCheck = checkDigit(validNumber + "<");
 const dateTail = "F350925" + checkDigit("350925");
 const birthCheck = checkDigit("900912");
 const foldedRows = ["PRT900912", birthCheck + dateTail].join("\n");
 const damagedRow = numberCheck + "PRTOAO912" + birthCheck + dateTail;
 const recoveredPassport = readIdentityPage([passportCover, foldedRows, damagedRow], "2026-11-13", [validNumber]);
 assert.deepEqual(recoveredPassport, {document_type:"passport",full_name:"Ana Maria Silva Exemplo",birth_date:"1990-09-12",expires_on:"2035-09-25",document_number:validNumber});
 assert.equal(readIdentityPage([passportCover, foldedRows, damagedRow], "2026-11-13", ["XY123457"]).document_number, "");
 assert.equal(readIdentityPage([passportCover, damagedRow], "2026-11-13", [validNumber]).document_number, "");
 assert.equal(readIdentityPage([passportCover, foldedRows, damagedRow], "2026-11-13", [validNumber, "XY223356"]).document_number, "");
 const optional = "12345678<<<<<<";
 const checkedOptional = optional + checkDigit(optional);
 const compositeCheck = checkDigit(validNumber + "<" + numberCheck + "900912" + birthCheck + dateTail.slice(1) + checkedOptional);
 const numberlessRow = "PRT900912" + birthCheck + dateTail + checkedOptional + compositeCheck;
 assert.equal(readIdentityPage([passportCover, numberlessRow], "2026-11-13", [validNumber]).document_number, validNumber);
 assert.equal(readIdentityPage([passportCover, numberlessRow], "2026-11-13", ["XY123457"]).document_number, "");
 assert.equal(read("PASSAPORTE\nVálido até 05.06.2031").expires_on,"2031-06-05");
 const alternative=read("PASSAPORTE\nSobrenome / Surname\nCOSTA TESTE\nGiven name(s): MARTA JOANA\nPassport No.\nXY123456\nD.O.B. 12/09/1990\nDate of expiration 25/09/2035");
 assert.deepEqual(alternative,{document_type:"passport",full_name:"Marta Joana Costa Teste",birth_date:"1990-09-12",expires_on:"2035-09-25",document_number:"XY123456"});

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

