const assert=require('node:assert/strict');
const {load,hash}=require('./check-photo-retention.cjs');
let upstream=0;
const fetcher=async()=>{upstream++;throw Error('Paid request must never happen')};
function db({error=null,throws=false,files=[],listError=null}){
 return {from(){const q={select(){return q},eq(){return q},order(){return q},limit(){return q},async maybeSingle(){if(throws)throw Error('offline');return {data:null,error}}};return q},storage:{from:()=>({list:async()=>({data:files,error:listError}),getPublicUrl:path=>({data:{publicUrl:'https://storage.example/'+path}})})}};
}
(async()=>{
 const req=()=>new Request('https://example/api/places/photo?ref=orphan&w=1600');
 for(const admin of [null,db({error:{code:'timeout'}}),db({throws:true}),db({listError:{code:'offline'}})]){
  const r=await load('app/api/places/photo/route.ts',admin,{GOOGLE_PLACES_API_KEY:'test'},fetcher).GET(req());
  assert.equal(r.status,503);assert.equal(r.headers.get('cache-control'),'no-store');
 }
 const h=hash('orphan');
 const orphanDb=db({files:[{name:h+'_320.jpg'},{name:h+'_720.png'},{name:'another_1600.jpg'}]});
 const r=await load('app/api/places/photo/route.ts',orphanDb,{GOOGLE_PLACES_API_KEY:'test'},fetcher).GET(req());
 assert.equal(r.status,302);assert.equal(r.headers.get('location'),'https://storage.example/'+h.slice(0,2)+'/'+h+'_720.png');
 assert.equal(upstream,0);
 console.log('PASS missing admin / DB returned error / DB exception / storage error: 503, Google=0; orphan file 720→1600 reuse Google=0');
})().catch(e=>{console.error(e);process.exitCode=1});
