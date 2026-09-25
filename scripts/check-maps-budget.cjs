const fs=require('fs'),vm=require('vm'),ts=require('typescript'),assert=require('node:assert/strict'),crypto=require('crypto');
let allowed=false,reservations=0,network=0,fail=false;
const db={rpc:async()=>{reservations++;return fail?{error:{code:'offline'},data:null}:{data:{allowed},error:null}}};
function load(file,deps,extra={}) {const m={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:m,exports:m.exports,URL,Response,Request,console,setTimeout,clearTimeout,process:{env:{}},require:p=>{if(!(p in deps))throw Error(p);return deps[p]},...extra});return m.exports;}
const budget=load('lib/google-maps-budget.ts',{'node:crypto':crypto,'@/lib/supabase-admin':{getSupabaseAdmin:()=>db}});
(async()=>{
const cases=[['https://maps.googleapis.com/maps/api/place/photo','photo',1],['https://places.googleapis.com/v1/places/p/photos/r/media','photo',1],['https://places.googleapis.com/v1/places:searchText','textsearch',1],['https://places.googleapis.com/v1/places:searchNearby','nearbysearch',1],['https://maps.googleapis.com/maps/api/distancematrix/json?origins=a|b&destinations=c|d|e','distance_matrix',6],['https://maps.googleapis.com/maps/api/distancematrix/json?origins=enc:abc&destinations=c','distance_matrix',0],['https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix','unsupported',0]];
for(const [url,op,units] of cases){const c=budget.mapsCharge(url);assert.equal(c.operation,op);assert.equal(c.units,units)}
assert.equal(budget.mapsCharge('https://storage.example/image.jpg'),null);
assert.equal(budget.mapsCharge('https://generativelanguage.googleapis.com/v1beta/models/model:generateContent'),null);
assert.equal(await budget.reserveMapsSpend('photo'),false);allowed=true;assert.equal(await budget.reserveMapsSpend('photo'),true);fail=true;assert.equal(await budget.reserveMapsSpend('photo'),false);fail=false;
let ctx={fetch:async()=>{network++;return Response.json({ok:true})}};
const meter=load('lib/api-meter.ts',{'@/lib/google-maps-budget':budget,'@/lib/supabase-admin':{getSupabaseAdmin:()=>null},'next/server':{after:()=>{}},'next/headers':{headers:async()=>new Headers()}},{globalThis:ctx});
meter.installFetchMeter();allowed=false;const before=network;
const blocked=await Promise.all(Array.from({length:40},()=>ctx.fetch('https://maps.googleapis.com/maps/api/place/details/json')));
assert(blocked.every(x=>x.status===503));assert.equal(network,before,'no dispatch on blocked concurrent calls');
await ctx.fetch('https://storage.example/image.jpg');assert.equal(network,before+1);
await ctx.fetch('https://places.googleapis.com/unknown/new-api');assert.equal(network,before+1,'unknown Maps endpoints fail closed');
allowed=true;await ctx.fetch('https://maps.googleapis.com/maps/api/place/photo');assert.equal(network,before+2);fail=true;await ctx.fetch('https://maps.googleapis.com/maps/api/place/photo');assert.equal(network,before+2,'DB failure blocks dispatch');
const action=fs.readFileSync('app/%5Fadmin/actions.ts','utf8').split('export async function approveMapsBudgetAction')[1];assert(action.indexOf('await assertAdmin()')<action.indexOf('.rpc('));assert(action.includes('approve-100000'));
for(const name of ['nearby-map','mini-map','trip-route-map']) assert(fs.readFileSync('components/'+name+'.tsx','utf8').includes('<GoogleMapPermit><APIProvider'));
console.log('PASS billing classifier, matrix element costs, 40 concurrent denied calls Google=0, stored files unaffected, unknown endpoints/DB failure denied, explicit admin approval guard');
})().catch(e=>{console.error(e);process.exitCode=1});
