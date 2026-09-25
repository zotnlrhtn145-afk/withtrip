const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const root = require('node:path').resolve(__dirname, '..');
const ts = require(root + '/node_modules/typescript');
let rows = [], upstream = 0, uploads = 0;
const db = {
  from() {
    let filters = [];
    const q = {
      select() { return q; }, eq(k,v) { filters.push(r=>r[k]===v); return q; },
      gte(k,v) { filters.push(r=>r[k]>=v); return q; }, order() { return q; }, limit() { return q; },
      in(k,v) { filters.push(r=>v.includes(r[k])); return q; },
      maybeSingle: async()=>({data: rows.find(r=>filters.every(f=>f(r))) ?? null}),
      upsert: async row=>{ rows.push(row); return {error:null}; },
      then(resolve) { resolve({data:rows.filter(r=>filters.every(f=>f(r)))}); }
    }; return q;
  },
  storage: {from:()=>({
    getPublicUrl: path=>({data:{publicUrl:'https://storage.example/'+path}}),
    list:async()=>({data:[],error:null}),
    upload:async()=>{uploads++;return {error:null};}
  })}
};
function load(file, admin=db, env={GOOGLE_PLACES_API_KEY:'test'}, fetcher=async()=>{
  upstream++; return new Response(new Uint8Array([1,2,3]),{headers:{'content-type':'image/jpeg'}});
}) {
  const mod={exports:{}};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(root+'/'+file,'utf8'),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
  }).outputText,{
    module:mod,exports:mod.exports,URL,Response,AbortController,setTimeout,clearTimeout,console,
    process:{env}, fetch:fetcher,
    require:p=>p==='node:crypto'?crypto:p==='next/server'?{NextResponse:class extends Response {
      static redirect(url,opts){return new Response(null,{...opts,headers:{...opts.headers,Location:url}});}
    }}:p.endsWith('supabase-admin')?{getSupabaseAdmin:()=>admin}:
    p.endsWith('photo-request-guard')?{createPhotoRequestGuard:()=>async(k,fn)=>fn()}:
    p.endsWith('rate-limit')?{checkRateLimit:async()=>null}:
    p.endsWith('place-photo-recovery')?{recoverPlacePhoto:async()=>null}:(()=>{throw Error(p)})()
  }); return mod.exports;
}
const hash=ref=>crypto.createHash('sha256').update(ref).digest('hex');
const request=ref=>new Request('https://example/api/places/photo?ref='+ref+'&w=500');
async function test() {
  rows=[{photo_ref_hash:hash('old'),width:500,storage_path:'old.jpg',fetched_at:'2000-01-01'}];
  const route=load('app/api/places/photo/route.ts',db,{});
  for(const w of [80,500,1600]) assert.equal((await route.GET(new Request('https://example/api/places/photo?ref=old&w='+w))).headers.get('location'),'https://storage.example/old.jpg');
  assert.equal(upstream,0,'old stored photo needs neither Google key nor request');
  const batch=load('app/api/places/photo/urls/route.ts');
  const result=await batch.POST(new Request('https://example/api/places/photo/urls',{method:'POST',body:JSON.stringify({refs:['old','missing'],w:1600})}));
  assert.equal((await result.json()).urls.old,'https://storage.example/old.jpg');
  const fresh=load('app/api/places/photo/route.ts');
  await fresh.GET(request('new')); await fresh.GET(new Request('https://example/api/places/photo?ref=new&w=720')); await fresh.GET(new Request('https://example/api/places/photo?ref=new&w=1600'));
  assert.equal(upstream,1); assert.equal(uploads,1);
  const bad=load('app/api/places/photo/route.ts',db,{GOOGLE_PLACES_API_KEY:'test'},async()=>new Response('html',{headers:{'content-type':'text/html'}}));
  assert.equal((await bad.GET(request('invalid'))).status,502);
  assert.equal(uploads,1);
  console.log('PASS old storage without Google key, repeat users, batch old storage, first fetch/save then reuse, invalid image rejected');
}
if(require.main===module) test().catch(e=>{console.error(e);process.exitCode=1});
module.exports={load,hash};
