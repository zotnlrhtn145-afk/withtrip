const fs = require("node:fs")
const path = require("node:path")
const vm = require("node:vm")
const assert = require("node:assert/strict")
const ts = require("typescript")
const root = path.resolve(__dirname, "..", "shared")
const modules = new Map()
function load(name) {
  if (modules.has(name)) return modules.get(name)
  const code = ts.transpileModule(fs.readFileSync(path.join(root, name + ".ts"), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const mod = { exports: {} }; modules.set(name, mod.exports)
  vm.runInThisContext("(function(require,module,exports){" + code + "\n})")((id) => load(id.replace("./", "")), mod, mod.exports)
  return mod.exports
}
const { settlementMoney, settlementSummary, sharesKrw } = load("settlement-currency")
const { splitExpense } = load("expense-share")
const { toKrw, calibrateFeeRate } = load("fx")
const e = (amount, currency, fxRate, feeRate = .023, calibrated = false) => ({ amount, currency, fxRate, feeRate, calibrated })
const tests = []
function test(name, run) { run(); tests.push(name); console.log("PASS " + name) }
test("VND converts to KRW first and retains local amount/rate", () => {
  const m = e(100000, "VND", .052)
  const p = settlementMoney(m, m.feeRate, false)
  assert.equal(p.amountKrw, 5320); assert.equal(p.primary, "약 5,320원")
  assert.match(p.local, /100,000 VND/); assert.match(p.rate, /1 VND = 0.052원/)
  assert.equal(m.amount, 100000)
})
test("KRW never receives foreign card fees", () => {
  const p = settlementMoney(e(20000, "KRW", 1), .15, false)
  assert.equal(p.amountKrw, 20000); assert.equal(p.primary, "20,000원"); assert.equal(p.local, "")
})
test("Mixed currencies and historical rates sum per expense", () => {
  const s = settlementSummary([e(1000000, "VND", .056), e(1000000, "VND", .057), e(20000, "KRW", 1)])
  assert.equal(s.totalKrw, 135599); assert.equal(s.foreign.length, 1)
  assert.match(s.foreign[0], /2,000,000 VND/); assert.match(s.foreign[0], /0.056~0.057/)
})
test("Round each payment before summing, never aggregate FX", () => {
  const s = settlementSummary([e(1, "USD", 1300.4), e(1, "USD", 1300.4), e(1, "USD", 1300.4)])
  assert.equal(s.totalKrw, 3990); assert.notEqual(s.totalKrw, toKrw(e(3, "USD", 1300.4)))
})
test("Each currency keeps a distinct local record", () => {
  const s = settlementSummary([e(100000, "VND", .05), e(1000, "JPY", 10), e(100, "USD", 1300)])
  assert.equal(s.foreign.length, 3); assert.match(s.foreign[0], /VND/); assert.match(s.foreign[1], /JPY/); assert.match(s.foreign[2], /USD/)
})
test("Zero and calibrated payer fees preserved", () => {
  const s = settlementSummary([e(1000000, "VND", .056, 0, true), e(1000000, "VND", .057, .01, true)])
  assert.equal(s.totalKrw, 113570); assert.equal(s.estimated, false); assert.equal(s.primary, "113,570원")
})
test("Missing FX cannot be mistaken for 1 KRW", () => {
  for (const fxRate of [0, null, undefined, NaN, Infinity, -1]) {
    const m = e(100000, "VND", fxRate)
    assert.equal(settlementMoney(m, .023, false).amountKrw, null)
    assert.equal(settlementSummary([m, e(1000, "KRW", 1)]).totalKrw, null)
  }
})
test("Foreign fixed participant amounts convert before splitting", () => {
  const m = e(100000, "VND", .052)
  const parts = [{ id: "payer", amount: 50000 }, { id: "guest", amount: null }]
  const r = splitExpense(toKrw(m), sharesKrw(m, parts, .023))
  assert.equal(r.problem, null); assert.equal(r.byPerson.get("payer"), 2660); assert.equal(r.byPerson.get("guest"), 2660)
  assert.equal(parts[0].amount, 50000)
})
test("All-fixed fractional allocations reconcile the final KRW", () => {
  const m = e(.02, "USD", 50, 0)
  for (const parts of [[{ id: "a", amount: .01 }, { id: "b", amount: .01 }], [{ id: "a", amount: .01 }, { id: "b", amount: .01 }, { id: "c", amount: null }]]) {
    const r = splitExpense(toKrw(m, 0), sharesKrw(m, parts, 0))
    assert.equal(r.problem, null); assert.equal([...r.byPerson.values()].reduce((a,b)=>a+b,0), 1)
  }
})
test("Incorrect raw fixed shares are not silently corrected", () => {
  const m = e(100000, "VND", .052)
  const r = splitExpense(toKrw(m), sharesKrw(m, [{ id: "a", amount: 200000 }, { id: "b", amount: null }], .023))
  assert.equal(r.problem, "over")
})
test("Existing carryover is already KRW", () => {
  const total = settlementSummary([e(100000, "VND", .052), e(20000, "KRW", 1)]).totalKrw
  assert.equal(Math.round(Math.max(0, total - 5000) / 2), 10160)
})
test("Calibration preserves each saved FX rate", () => {
  const fee = calibrateFeeRate(e(100, "USD", 1000), 103000)
  assert.ok(Math.abs(fee - .03) < 1e-12); assert.equal(toKrw(e(100, "USD", 1100), fee), 113300)
})
console.log(JSON.stringify({ passed: tests.length, cases: tests }))
