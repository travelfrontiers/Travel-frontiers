/* Regression checks: actual handlers, simulated network, no real data or emails. */
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
let ts;try{ts=require("typescript");}catch{ts=require("/opt/homebrew/lib/node_modules/openclaw/node_modules/typescript/lib/typescript.js");}
let authorized=true,calls=[],replies=[];
const id="12345678-1234-4123-8123-123456789abc",second="22345678-1234-4123-8123-123456789abc";
function load(file){
 const source=ts.transpileModule(fs.readFileSync(path.join(__dirname,"..",file),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,mod={exports:{}};
 const req=name=>name==="next/server"?{NextResponse:{json:(body,options={})=>({body,status:options.status||200})}}:name==="@/lib/crm-api"?{isAuthorizedStudioUser:async()=>authorized,supabaseAdminConfig:()=>({url:"https://synthetic.invalid",headers:{apikey:"synthetic"}})}:name.startsWith("@/")?load("src/"+name.slice(2)+".ts"):require(name);
 new Function("require","module","exports","fetch",source)(req,mod,mod.exports,async(url,init={})=>{calls.push({url,init});const reply=replies.shift();if(!reply)throw new Error("Unexpected fetch: "+url);return {ok:reply.status===undefined||reply.status<400,status:reply.status||200,json:async()=>reply.data,headers:new Headers(reply.headers||{})};});return mod.exports;
}
const request=(body={},query="")=>({text:async()=>JSON.stringify(body),json:async()=>body,headers:new Headers(),nextUrl:new URL("https://synthetic.invalid/"+query)});
const reset=(...items)=>{calls=[];replies=items;};
(async()=>{
 const calendar=load("src/lib/crm-calendar.ts");
 assert.equal(calendar.addDays("2027-03-28",1),"2027-03-29");
 assert.equal(calendar.addDays("2028-02-28",1),"2028-02-29");
 assert.deepEqual(calendar.calendarDays("2027-04-01","week"),["2027-03-29","2027-03-30","2027-03-31","2027-04-01","2027-04-02","2027-04-03","2027-04-04"]);
 assert.equal(calendar.calendarDays("2027-02-28","month").length,42);
 assert.equal(calendar.lisbonDay("2027-04-01T23:30:00Z"),"2027-04-02");
 const proposal=load("src/app/api/crm/proposals/route.ts"),templates=load("src/app/api/crm/checklist-templates/route.ts"),activity=load("src/app/api/crm/activity/route.ts"),duplicates=load("src/app/api/crm/clients/duplicates/route.ts"),agenda=load("src/app/api/crm/calendar/route.ts"),tasks=load("src/app/api/crm/tasks/[id]/route.ts");
 authorized=false;reset();for(const route of [proposal,templates,activity,duplicates,agenda])assert.equal((await route.GET(request())).status,401);assert.equal(calls.length,0);authorized=true;
 reset({data:[],headers:{"content-range":"*/0"}});
 const linkedProposals=await proposal.GET(request({},`?trip_id=${id}&status=accepted`));
 assert.equal(linkedProposals.status,200);assert.deepEqual(linkedProposals.body,{proposals:[],total:0});
 const proposalFilters=new URL(calls[0].url).searchParams;
 assert.equal(proposalFilters.get("trip_id"),`eq.${id}`);assert.equal(proposalFilters.get("status"),"eq.accepted");
 reset();assert.equal((await proposal.GET(request({},"?trip_id=invalid"))).status,400);assert.equal(calls.length,0);
 const valid={action:"save",id:null,client_id:id,expected_version:0,data:{title:"Synthetic quote",total_amount:1234.56,currency:"EUR",departure_date:"2027-04-06",return_date:"2027-04-17"}};
 reset({data:{id,current_version:1}});let r=await proposal.POST(request(valid));assert.equal(r.status,201);assert.equal(calls.length,1);assert.ok(calls[0].url.endsWith("/rpc/crm_save_proposal"));
 reset({status:400,data:{message:"stale_version"}});r=await proposal.POST(request({...valid,id,expected_version:1}));assert.equal(r.status,409);assert.equal(calls.length,1);
 for(const patch of [{return_date:"2027-04-01"},{departure_date:"2027-02-30"},{total_amount:""},{total_amount:-1},{currency:"EURO"}]){reset();assert.equal((await proposal.POST(request({...valid,data:{...valid.data,...patch}}))).status,400);assert.equal(calls.length,0);}
 reset();assert.equal((await duplicates.POST(request({source_id:id,target_id:second,fields:{},confirmed:false}))).status,400);assert.equal(calls.length,0);
 reset();assert.equal((await agenda.GET(request({},"?from=2027-01-01&to=2028-01-01"))).status,400);assert.equal(calls.length,0);
 reset();assert.equal((await templates.POST(request({action:"save",name:"Test",travel_type:"all",active:true,auto_apply:true,items:[{id,anchor:"departure",offset_days:-3,phase:"before",title:"Test"},{id,anchor:"departure",offset_days:1,phase:"during",title:"Other"}]}))).status,400);assert.equal(calls.length,0);
 const task={id,title:"Synthetic task",due_at:"2027-04-01T11:00:00Z",source_service_id:null,template_item_id:second,template_override:false};
 reset({data:[task]},{data:[{...task,completed:true}]});r=await tasks.PATCH(request({title:task.title,due_date:"2027-04-01",completed:true}),{params:Promise.resolve({id})});assert.equal(r.status,200);let body=JSON.parse(calls[1].init.body);assert.equal(body.due_at,task.due_at);assert.equal(body.template_override,false);
 reset({data:[task]},{data:[{...task,title:"Changed"}]});await tasks.PATCH(request({title:"Changed",due_date:"2027-04-01",completed:false}),{params:Promise.resolve({id})});assert.equal(JSON.parse(calls[1].init.body).template_override,true);
 reset({data:[{...task,source_service_id:second}]},{data:[task]});await tasks.PATCH(request({title:"Try changing a flight task",due_date:null,completed:true}),{params:Promise.resolve({id})});assert.deepEqual(JSON.parse(calls[1].init.body),{completed:true});
 reset({status:204});r=await tasks.DELETE(request(),{params:Promise.resolve({id})});assert.equal(r.status,200);assert.ok(calls[0].url.endsWith("/rpc/crm_delete_task"));
 reset({status:400,data:{message:"flight_managed_task"}});assert.equal((await tasks.DELETE(request(),{params:Promise.resolve({id})})).status,409);
 const trip={id:"33345678-1234-4123-8123-123456789abc",destination:"Synthetic",client_id:id,crm_trip_clients:[{client_id:second}]};
 reset({data:[{...trip,departure_date:"2027-04-02",return_date:null}]},{data:[{id,trip_id:trip.id,title:"Task across midnight",due_at:"2027-04-01T23:30:00Z",completed:false,crm_trips:trip}]},{data:[]},{data:[]},{data:[]},{data:[]});
 r=await agenda.GET(request({},"?from=2027-04-02&to=2027-04-02"));assert.equal(r.status,200);assert.equal(r.body.entries.length,2);assert.equal(r.body.entries[1].date,"2027-04-02");assert.ok(r.body.entries.every(e=>e.clientIds.includes(second)));
 reset({data:[],headers:{"content-range":"*/0"}});r=await activity.GET(request({},"?client_id="+id));assert.equal(r.status,200);assert.deepEqual(r.body.events,[]);assert.ok(calls[0].url.includes("client_id=eq."));
 console.log("PASS: calendar/DST/leap years; authorization; proposal trip filter, version conflict and field validation; manual merge confirmation; template IDs; task override/completion/flight protection; RPC task deletion; calendar includes all travelers; dossier history filter.");
})().catch(error=>{console.error(error);process.exitCode=1;});
