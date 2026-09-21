const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),ts=require(process.cwd()+'/node_modules/typescript');
const src=ts.transpileModule(fs.readFileSync('app/api/widy-turn/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const {load,context}=require('./check-widy-trip-context.cjs');
const qid='11111111-1111-4111-8111-111111111111',tid='22222222-2222-4222-8222-222222222222';
function setup(opts={}){const callbacks=[],writes=[], routeCalls=[];const user=opts.auth===false?null:{id:'me'};
 function query(table,admin){let op='select', value;const c={}; for(const name of ['select','eq','is','in','neq','order','limit'])c[name]=()=>c;
 c.insert=v=>{op='insert';value=v;return c};c.update=v=>{op='update';value=v;return c};
 function result(){if(op!=='select'){writes.push({table,admin,op,value});return {error:admin&&op==='insert'&&opts.duplicate?{code:'23505'}:null,data:null}}
 if(table==='trips')return{data:opts.context?.trip??{city:'Hanoi',country_code:'VN',start_date:'2026-09-20',end_date:'2026-09-22'}};
 if(table==='trip_accommodations')return {data:opts.context?.stays??[],error:opts.contextError?{code:'db'}:null};
 if(table==='trip_transports')return {data:opts.context?.transports??[]};
 if(table==='trip_schedules')return {data:opts.context?.schedules??[]};
 if(table==='widy_turns')return{data:opts.turns??[]};return{data:[]}}
 c.maybeSingle=async()=>table==='trip_messages'?{data:opts.missing?null:{id:qid,trip_id:tid,content:opts.question??'hello'}}:result();c.then=(yes,no)=>Promise.resolve(result()).then(yes,no);return c;}
 const db={from:t=>query(t,false),rpc:async()=>({data:opts.member!==false})},admin={from:t=>query(t,true)};
 const exports={};vm.runInNewContext(src,{exports,Request,Headers,URL,Date,require:n=>{
 if(n==='@/lib/widy-trip-context')return load('lib/widy-trip-context.ts');
 if(n==='node:crypto')return{randomUUID:()=> '33333333-3333-4333-8333-333333333333'};
 if(n==='next/server')return{after:fn=>callbacks.push(fn),NextResponse:{json:(data,init)=>new Response(JSON.stringify(data),init)}};
 if(n.includes('place-share-server'))return{shareAuth:async()=>({db,user})};if(n.includes('supabase-admin'))return{getSupabaseAdmin:()=>admin};
 return{POST:async req=>{routeCalls.push(await req.json());return new Response(JSON.stringify(opts.route??{mode:'chat',reply:'done'}))}};
 }});return{...exports,callbacks,writes,routeCalls};}
const req=()=>new Request('https://example.test/api/widy-turn',{method:'POST',headers:{Authorization:'Bearer test'},body:JSON.stringify({questionId:qid})});
(async()=>{for(const [opt,status]of [[{auth:false},401],[{missing:true},404],[{member:false},403]]){const s=setup(opt);assert.equal((await s.POST(req())).status,status);assert.equal(s.writes.length,0);assert.equal(s.callbacks.length,0)}
 const dup=setup({duplicate:true});assert.equal((await dup.POST(req())).status,202);assert.equal(dup.callbacks.length,0);
 const ok=setup();assert.equal((await ok.POST(req())).status,202);assert.equal(ok.routeCalls.length,0);await ok.callbacks[0]();assert.equal(ok.routeCalls.length,1);const reply=ok.writes.find(w=>w.table==='trip_messages');assert.equal(reply.admin,false);assert.equal(reply.value.reply_to,qid);assert.equal(reply.value.content,'done');assert.equal(ok.writes.at(-1).value.state,'done');
 const invalid=setup({route:{mode:'schedule',schedule:{title:'Cafe',day:99,time:'99:99'}}});await invalid.POST(req());await invalid.callbacks[0]();assert(!invalid.writes.some(w=>w.table==='trip_schedules'));
 const contextual=setup({context,question:'고베 우리 숙소 주변 와규',route:{mode:'places',search:'고베 숙소 주변 와규'}});await contextual.POST(req());await contextual.callbacks[0]();assert.equal(contextual.routeCalls.length,2);assert.equal(contextual.routeCalls[1].accommodation.lng,135.19);assert.equal(contextual.routeCalls[1].city,'고베');assert(contextual.routeCalls[0].tripContext.includes('KIX'));assert(contextual.routeCalls[1].tripContext.includes('Harborland'));assert.deepEqual(contextual.routeCalls[1].existingNames,['Harborland']);
 const unavailable=setup({contextError:true});await unavailable.POST(req());await unavailable.callbacks[0]();assert.equal(unavailable.routeCalls.length,0);assert.equal(unavailable.writes.at(-1).value.state,'failed');
 const ambiguous=setup({context,question:'숙소 주변',route:{mode:'places',search:'숙소 주변'}});await ambiguous.POST(req());await ambiguous.callbacks[0]();assert.equal(ambiguous.routeCalls.length,1);assert(ambiguous.writes.find(w=>w.table==='trip_messages').value.content.includes('기준 숙소'));
 const stale=setup({turns:[{state:'running',created_at:'2000-01-01',question_id:qid}]});const body=await(await stale.GET(new Request('https://example.test/api/widy-turn?tripId='+tid))).json();assert.equal(body.turns[0].state,'failed');
 console.log('PASS auth/ownership/participant, duplicate enqueue, after-response persistence, user-RLS writes, schedule bounds, stale recovery');})();
