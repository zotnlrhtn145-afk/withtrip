const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('node:assert/strict'),ts=require('typescript');
const cache=new Map();
function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file);const exports={};cache.set(file,exports);const src=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;vm.runInNewContext(src,{exports,Date,require:n=>n.startsWith('@/')?load(n.slice(2)+'.ts'):n.startsWith('.')?load(path.resolve(path.dirname(file),n)+'.ts'):require(n)});return exports;}
const {selectWidyContext:select,widyContextText:serialize}=load('lib/widy-trip-context.ts');
const stay=(id,name,address,start,end,lat,lng)=>({id,name,address,check_in_date:start,check_out_date:end,check_in_time:'15:00',check_out_time:'11:00',lat,lng,booking_code:'SECRET_BOOKING',memo:'PRIVATE_MEMO',guest_ids:['PRIVATE_GUEST'],phone_number:'PRIVATE_PHONE'});
const context={trip:{city:null,location:'고베 & 오사카 · 일본',title:'일본 여행',country_code:null,start_date:'2026-10-01',end_date:'2026-10-06'},stays:[stay('osaka','Osaka Hotel','大阪市','2026-10-03','2026-10-06',34.69,135.5),stay('kobe','Kobe Hotel','神戸市','2026-10-01','2026-10-03',34.69,135.19)],transports:[{transport_type:'FLIGHT',from_label:'ICN',to_label:'KIX',depart_date:'2026-10-01',depart_time:'09:00',arrive_date:'2026-10-01',arrive_time:'11:00',booking_code:'SECRET_BOOKING'}],schedules:[{day_number:2,place_name:'Harborland',visit_time:'14:00',address:'Kobe',memo:'PRIVATE_MEMO'}]};
assert.equal(select(context,'일본 고베 우리 숙소 주변 와규 고기집 있어?').stay.id,'kobe');
assert.equal(select(context,'고베 메이너트 주변 와규','osaka').stay.id,'kobe','wrong model suggestion cannot override explicit city');
assert.equal(select(context,'2일차 숙소 근처 와규').stay.id,'kobe');
assert.equal(select(context,'3일차 숙소 근처').stay.id,'osaka','checkout date switches stays');
assert.equal(select(context,'2026-10-04 숙소 주변').city,'오사카');
assert.equal(select(context,'숙소 근처 맛집').needsStay,true,'no arbitrary first stay');
assert.equal(select(context,'숙소 근처 맛집','other-trip-id').needsStay,true);
assert.equal(select(context,'6일차 숙소 근처','osaka').needsStay,true,'checkout is not overnight');
assert.equal(select(context,'고베 숙소 근처').country,'JP');
const text=serialize(context);for(const wanted of ['Harborland','14:00','KIX','11:00','神戸','2026-10-03'])assert(text.includes(wanted));for(const secret of ['SECRET_BOOKING','PRIVATE_MEMO','PRIVATE_PHONE','PRIVATE_GUEST'])assert(!text.includes(secret));
assert.equal(select({...context,stays:[{...context.stays[1],lat:null,lng:null}]},'고베 주변').accommodation,null);
console.log('PASS persisted multi-city hotels, Japanese addresses, date/checkout selection, ambiguous/foreign ID guards, flights/schedule context, secret-field exclusion');
module.exports={load,context};
