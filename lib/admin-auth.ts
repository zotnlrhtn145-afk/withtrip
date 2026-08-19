/**
 * 관리자 페이지(/_admin) 출입.
 *
 * ⚠️ **비밀번호는 어디에도 그대로 두지 않는다.** 환경변수에 들어가는 건
 *    소금(salt)과 해시뿐이다. 코드·DB·로그 어디에도 원문이 없다.
 *
 * ⚠️ 비교는 **한 글자에서 멈추지 않고 끝까지** 한다. 보통의 `===` 는 다른 곳이
 *    나오면 바로 멈춰서, 걸린 시간으로 몇 글자까지 맞았는지 새어 나간다.
 *
 * ⚠️ 세션 쿠키는 **서명한다.** 서명이 없으면 쿠키 값을 손으로 고쳐 관리자가 될 수 있다.
 *    httpOnly + secure + sameSite=strict 로 자바스크립트와 외부 사이트에서 못 만지게 한다.
 *
 * ⚠️ **`node:crypto` 를 쓰지 않는다.** 이 파일은 middleware 에서도 불리는데
 *    middleware 는 edge 런타임이라 node 모듈이 없다 — 빌드는 되고 배포하면
 *    그때 터지는, 알아채기 늦은 종류의 고장이다. 어디서나 있는 Web Crypto 만 쓴다.
 */

const ITER = 210_000
const KEYLEN = 32
export const ADMIN_COOKIE = "wt_admin"
/** 세션 유효기간 — 관리자 화면은 모든 자료를 본다. 짧게 잡고 자주 다시 받는다. */
export const SESSION_MAX_AGE = 60 * 60 * 8

function env(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`${name} 가 설정되지 않았습니다`)
  return v
}

const enc = new TextEncoder()

function b64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let s = ""
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s)
}

function fromB64(s: string): Uint8Array {
  const bin = atob(s)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

/** 길이도 내용도 시간으로 새지 않게 끝까지 훑어서 비교한다 */
function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  let diff = a.length ^ b.length
  const n = Math.max(a.length, b.length)
  for (let i = 0; i < n; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0)
  return diff === 0
}

async function pbkdf2(password: string, salt: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"])
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: enc.encode(salt), iterations: ITER, hash: "SHA-256" },
    key,
    KEYLEN * 8
  )
  return new Uint8Array(bits)
}

async function hmac(message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(env("ADMIN_SESSION_SECRET")),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message))
  // 쿠키에 들어가므로 +/= 가 없는 base64url 로
  return b64(sig).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

/** 아이디·비밀번호가 맞는가 */
export async function verifyLogin(user: string, password: string): Promise<boolean> {
  try {
    const expectUser = env("ADMIN_USER")
    const salt = env("ADMIN_PW_SALT")
    const hash = fromB64(env("ADMIN_PW_HASH"))

    // ⚠️ 아이디가 틀려도 **같은 시간**을 쓰도록 계산은 끝까지 한다.
    //    일찍 돌아가면 "아이디는 맞았다"가 시간으로 새어 나간다.
    const got = await pbkdf2(password, salt)
    const sameUser = sameBytes(enc.encode(user), enc.encode(expectUser))
    const samePw = sameBytes(got, hash)
    return sameUser && samePw
  } catch {
    return false
  }
}

/** 서명된 세션 값 만들기 — `발급시각.서명` */
export async function issueSession(): Promise<string> {
  const issued = Date.now().toString()
  return `${issued}.${await hmac(issued)}`
}

/** 쿠키가 우리가 발급한 것이고 아직 안 지났는가 */
export async function verifySession(value: string | undefined): Promise<boolean> {
  if (!value) return false
  const [issued, sig] = value.split(".")
  if (!issued || !sig || !/^\d+$/.test(issued)) return false
  try {
    const expect = await hmac(issued)
    if (!sameBytes(enc.encode(sig), enc.encode(expect))) return false
    const age = (Date.now() - Number(issued)) / 1000
    return age >= 0 && age < SESSION_MAX_AGE
  } catch {
    return false
  }
}
