const fs=require('fs'),vm=require('vm'),ts=require('typescript'),assert=require('node:assert/strict');
let uid='ordinary-user';const counters=new Map();
const context={exports:{},Buffer,Date,process:{env:{SUPABASE_SERVICE_ROLE_KEY:'test-only-secret'}},require:n=>n==='server-only'?{}:n==='node:crypto'?require(n):n==='next/server'?{NextResponse:{json:(body,options)=>({body,status:options.status})}}:n.includes('place-share-server')?{shareAuth:async()=>({user:uid?{id:uid}:null})}:{getSupabaseAdmin:()=>({rpc:async(_,{p_bucket})=>{const n=(counters.get(p_bucket)||0)+1;counters.set(p_bucket,n);return{data:n}}})}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(require('path').join(__dirname,'../lib/widy-quota.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);
const m=context.exports;
(async()=>{
 for(let i=0;i<10;i++)assert.equal((await m.checkWidyQuota({})).response,null);
 assert.equal((await m.checkWidyQuota({})).response.status,429);
 uid='b54b0242-cdba-4935-b906-2aeb4e429661';for(let i=0;i<12;i++)assert.equal((await m.checkWidyQuota({})).response,null);
 uid='bc385599-4d9f-4d50-bbe8-d1e5aa0c0392';for(let i=0;i<12;i++)assert.equal((await m.checkWidyQuota({})).response,null);
 const ticket=m.createWidyPlaceTicket(uid,'식당');assert.equal(await m.consumeWidyPlaceTicket({},ticket,'카페'),false);
 assert.equal(await m.consumeWidyPlaceTicket({},ticket,'식당'),true);assert.equal(await m.consumeWidyPlaceTicket({},ticket,'식당'),false);
 const other=m.createWidyPlaceTicket('someone-else','식당');assert.equal(await m.consumeWidyPlaceTicket({},other,'식당'),false);
 uid=null;assert.equal((await m.checkWidyQuota({})).response.status,401);
 assert.equal(m.widyQuotaDay(new Date('2026-09-20T14:59:59Z')),'2026-09-20');assert.equal(m.widyQuotaDay(new Date('2026-09-20T15:00:00Z')),'2026-09-21');
 console.log('PASS: 하루 10/11회, 두 예외 계정, 인증, 한국 자정 경계, 서명 검색어/사용자, 재사용 차단');
})().catch(e=>{console.error(e);process.exitCode=1});
