const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
const path = require('node:path')
const source = fs.readFileSync(path.join(__dirname, '../lib/photo-request-guard.ts'), 'utf8')
const exportsObject = {}
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
  { exports: exportsObject, Response, Date, Map, Promise })
const { createPhotoRequestGuard } = exportsObject

async function main() {
  let time = 0, calls = 0
  const guard = createPhotoRequestGuard(() => time)
  let release
  const load = () => { calls++; return new Promise(resolve => { release = resolve }) }
  const a = guard('photo:500', load)
  const b = guard('photo:500', load)
  await Promise.resolve()
  assert.equal(calls, 1)
  release(new Response('image bytes', { headers: { 'Content-Type': 'image/jpeg' } }))
  const results = await Promise.all([a, b])
  assert.deepEqual(await Promise.all(results.map(r => r.text())), ['image bytes', 'image bytes'])
  assert.equal((await guard('photo:500', async () => { calls++; return new Response('cached') })).status, 200)
  assert.equal(calls, 2, 'success must not be retained by the guard')

  let failures = 0
  const fail = async () => { failures++; return new Response('upstream unavailable', { status: 502 }) }
  assert.equal((await guard('broken:500', fail)).status, 502)
  time = 10_000
  const blocked = await guard('broken:500', fail)
  assert.equal(blocked.status, 503)
  assert.equal(blocked.headers.get('Retry-After'), '20')
  assert.equal(failures, 1)
  assert.equal((await guard('broken:1200', async () => new Response('other width'))).status, 200)
  time = 30_000
  assert.equal((await guard('broken:500', async () => new Response('recovered'))).status, 200)
  assert.equal((await guard('throws', async () => { throw Error('timeout') })).status, 503)
  let retried = false
  await guard('throws', async () => { retried = true; return new Response('unexpected') })
  assert.equal(retried, false)
  time += 30_000
  assert.equal((await guard('throws', async () => new Response('retry works'))).status, 200)

  const busy = createPhotoRequestGuard()
  let finish
  const waiting = new Promise(resolve => { finish = resolve })
  const requests = Array.from({ length: 64 }, (_, i) => busy(String(i), () => waiting))
  assert.equal((await busy('overflow', async () => new Response('unexpected'))).status, 503)
  finish(new Response('done'))
  await Promise.all(requests)
  assert.equal((await busy('overflow', async () => new Response('capacity released'))).status, 200)
  console.log('PASS: duplicate requests, independent response bodies, no success retention, failure cooldown/expiry, width isolation, thrown errors, concurrency bound and recovery')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
