const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const root=require('node:path').resolve(__dirname,'..');
const ts=require(root+'/node_modules/typescript');
function load(file, deps={}, fetcher=()=>{throw Error('unexpected network')}) {
 const exp={}; const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 vm.runInNewContext(code,{exports:exp,require:k=>{if(k in deps)return deps[k];throw Error('Unexpected dependency '+k)},fetch:fetcher,process:{env:{GEMINI_API_KEY:'test',GOOGLE_PLACES_API_KEY:'test'}},URL,Request,Response,AbortController,setTimeout,clearTimeout,console});return exp;
}
const helper=load(root+'/lib/explicit-caption-places.ts');
const caption='Things to Do in Ho Chi Minh City\n📍 Breadventure\n24 Do Quang Street, Thao Dien Ward, Thu Duc City, Ho Chi Minh City, Vietnam 70000';
assert.equal(helper.extractExplicitCaptionPlaces(caption)[0].name,'Breadventure');
for(const bad of ['📍 @account\n24 Do Quang Street','📍 Breadventure\nOpen Friday 10–20','📍 Breadventure\n','📍 #추천\n24 Do Quang Street'])assert.equal(helper.extractExplicitCaptionPlaces(bad).length,0);
assert.equal(helper.extractExplicitCaptionPlaces('📍 첫가게\n서울 성동구 왕십리로 24\n📍 두가게\n24 Do Quang Street').length,2);
// Public search response verified on 2026-09-28; network is mocked in regression.
const result={id:'google:ChIJ72-cTScndTEROzm9sVbc1AU',placeName:'Breadventure',address:'24 Đ. Đỗ Quang, An Khánh, Hồ Chí Minh, 베트남',lat:10.803713,lng:106.728971,rating:4.3};
const hit={place_id:result.id.replace('google:',''),name:result.placeName,formatted_address:result.address,geometry:{location:{lat:result.lat,lng:result.lng}},rating:result.rating,types:['bakery'],photos:[]};
let ai=0,media=0;
const deps={
 '@/lib/explicit-caption-places':helper,'@/shared/social-post-url':{normalizeThreadsUrl:()=>null},'next/server':{NextResponse:Response},
 '@/lib/rate-limit':{checkRateLimit:async()=>null},'@/lib/place-cover-image':{resolveRequestOrigin:()=>'',resolveCoverImageUrl:()=>'',buildPlacePhotoProxyUrl:()=>''},
 '@/lib/classify-subcategory-server':{isClassifyKind:()=>true,classifySubCategories:()=>{throw Error('AI classify retried')}},
 '@/lib/place-subcategories':{guessSubCategory:()=>''},'@/lib/youtube':{isYoutubeUrl:()=>false},
 '@/lib/gemini-models':{flashModelCandidates:async()=>['first','second'],isBillingProblem:()=>false,isTransient:()=>false},
 '@/lib/places-cache':{inferCategoryFromTypes:()=> 'restaurant',readPlacesByGoogleIds:async()=>new Map([[hit.place_id,{phone:'test'}]]),writePlaces:async()=>{}},
};
const route=load(root+'/app/api/resolve-instagram/route.ts',deps,async url=>{
 const u=String(url);
 if(u.includes('generateContent')){ai++;return new Response('payment required',{status:402})}
 if(u.includes('/geocode/'))return Response.json({status:'OK',results:[{geometry:hit.geometry}]});
 if(u.includes('/textsearch/'))return Response.json({status:'OK',results:[hit]});
 media++;throw Error('Unexpected fetch '+new URL(u).hostname);
});
(async()=>{
 const run=c=>route.POST(new Request('https://www.withtrip.co.kr/api/resolve-instagram',{method:'POST',body:JSON.stringify({caption:c,imageUrls:['https://example.com/photo.jpg']})})).then(r=>r.json());
 const ok=await run(caption);assert.equal(ok.places[0].place.placeName,'Breadventure');assert.equal(ok.places[0].confidence,'high');assert.equal(ai,1);assert.equal(media,0);
 ai=0;const fail=await run('이 영상 속 빵집에 다녀왔어요');assert.equal(fail.reason,'ai_billing_unavailable');assert.equal(fail.retryable,false);assert.equal(ai,1);assert.equal(media,0);
 console.log('PASS: actual caption + public search fixture, explicit/multiple/negative parsing, 402 once, no image/classification retry, accurate unavailable response');
})().catch(e=>{console.error(e);process.exitCode=1});
