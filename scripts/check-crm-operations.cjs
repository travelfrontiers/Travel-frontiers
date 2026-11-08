const assert = require("node:assert/strict");
const ts = require("typescript");
const fs = require("node:fs");
const base=require("node:path").resolve(__dirname, "..") + "/";
let calls=[], mails=0, authorized=true, reply={ok:true,status:200,data:{}};
const env={SUPABASE_SECRET_KEY:"synthetic-only",CRM_SMTP_HOST:"example.invalid",CRM_SMTP_USER:"synthetic@example.invalid",CRM_SMTP_PASSWORD:"synthetic",CRM_NOTIFICATION_TO:"synthetic@example.invalid",CRON_SECRET:"synthetic-cron",VERCEL_ENV:"production"};
function load(path){
 const output=ts.transpileModule(fs.readFileSync(base+path,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 const mod={exports:{}};
 const req=(name)=>{
  if(name==="next/server")return {NextResponse:{json:(data,options={})=>({status:options.status||200,body:data,headers:options.headers})}};
  if(name==="@/lib/crm-api")return {isAuthorizedStudioUser:async()=>authorized,supabaseAdminConfig:()=>({url:"https://db.example.invalid",headers:{apikey:"synthetic"}})};
  if(name==="nodemailer")return {createTransport:()=>({sendMail:async()=>{mails++;}})};
  return require(name);
 };
 new Function("require","module","exports","fetch","process",output)(req,mod,mod.exports,async(url,init={})=>{calls.push({url,init});return {ok:reply.ok,status:reply.status,json:async()=>reply.data};},{env});
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
 const form=load("src/app/api/trip-requests/route.ts");
 const lead={full_name:"Synthetic Test",email:"synthetic@example.invalid",destination:"Synthetic",adults:2,children_count:2,children_ages:[1,7],budget:"1500_2000",date_flexible:true,consent_privacy:true};
 calls=[];reply={ok:false,status:400,data:{message:"rate_limited"}};
 result=await form.POST(request(lead,{"x-forwarded-for":"192.0.2.1"}));assert.equal(result.status,429);assert.equal(mails,0);assert.ok(calls[0].url.endsWith("/rpc/crm_submit_public_request"));const payload=JSON.parse(calls[0].init.body);assert.match(payload.p_client_hash,/^[a-f0-9]{64}$/);assert.ok(!calls[0].init.body.includes("192.0.2.1"));
 reply={ok:true,status:200,data:{duplicate:true}};result=await form.POST(request(lead));assert.equal(result.status,200);assert.equal(mails,0);
 reply={ok:true,status:200,data:{duplicate:false}};result=await form.POST(request(lead));assert.equal(result.status,200);assert.equal(mails,1);
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
 console.log("PASS: atomic RPC-only trip save; missing-client rollback error; document delete/404; public rate limit; hashed IP; dedup suppresses mail; new request notifies; cron rejects forged header; Drive requires CRM auth.");
})().catch(error=>{console.error(error);process.exitCode=1});

