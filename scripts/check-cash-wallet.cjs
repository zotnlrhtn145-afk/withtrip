const ts=require('typescript'),fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('assert/strict');
function load(file){const filename=path.resolve(__dirname,'../shared',file+'.ts');const module={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{module,exports:module.exports,require:n=>load(n.replace('./','')),Intl,console});return module.exports}
const {cashWallets,cashAmount}=load('cash-wallet');const ids=['a','b','c'];let seq=0;
const e=(person,amount,kind='deposit',currency='KRW')=>({id:String(++seq),person_id:person,amount,kind,currency,fx_rate:currency==='KRW'?1:0.052,created_at:String(seq).padStart(8,'0')});
const spend=(amount,parts=[],currency='KRW')=>({id:'x',amount,parts,currency});
let entries=ids.map(id=>e(id,100000));let wallet=cashWallets(entries,[spend(240000)],ids)[0];assert.equal(wallet.remaining,60000);assert.deepEqual(Array.from(wallet.people,p=>p.balance),[20000,20000,20000]);
entries.push(e('a',10000,'refund'));wallet=cashWallets(entries,[spend(240000)],ids)[0];assert.equal(wallet.remaining,50000);assert.equal(wallet.people[0].balance,10000);
entries.push(e('a',10000,'refund'),e('b',20000,'refund'),e('c',20000,'refund'));wallet=cashWallets(entries,[spend(240000)],ids)[0];assert.equal(wallet.remaining,0);assert.equal(wallet.people.reduce((s,p)=>s+p.balance,0),0);
wallet=cashWallets([e('a',200000),e('b',100000)],[spend(120000,[{id:'a',amount:null},{id:'c',amount:null}])],ids)[0];assert.deepEqual(Array.from(wallet.people,p=>p.balance),[140000,100000,-60000]);assert.equal(wallet.people.reduce((s,p)=>s+p.balance,0),wallet.remaining);
wallet=cashWallets([e('a',10,'deposit','USD'),e('b',10,'deposit','USD')],[spend(0.01,[],'USD')],['b','a'])[0];assert.equal(wallet.spent,0.01);assert.equal(wallet.people.find(p=>p.id==='a').owed,0.01);assert.equal(wallet.people.find(p=>p.id==='b').owed,0);
assert.equal(cashWallets([e('a',100,'deposit','JPY'),e('a',100,'deposit','VND')],[],['a']).length,2);
assert.equal(cashAmount('1.1','VND'),null);assert.equal(cashAmount('1.01','USD'),1.01);assert.equal(cashAmount('-5','KRW'),null);assert.equal(cashAmount('1e3','KRW'),null);
assert.throws(()=>cashWallets([e('a',10)],[spend(10,[{id:'a',amount:20}])],['a']));
console.log('PASS 공동 지갑: 균등·차등입금·분담대상·추가입금/부분환급·전액환급·통화분리·최소단위·입력검증');
