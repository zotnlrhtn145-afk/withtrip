/**
 * 관리자 페이지(/_admin) 출입.
 *
 * ⚠️ **비밀번호 원문은 어디에도 없다.** 저장하는 건 소금과 해시뿐이다
 *    (PBKDF2-SHA256 21만 번). 코드·DB·로그 어디서도 원문을 되찾을 수 없다.
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

const enc = new TextEncoder()

type Creds = { username: string; salt: string; hash: string; secret: string }

/*
  ⚠️ 인스턴스마다 한 번만 읽는다. middleware 는 **모든 요청**을 지나가므로
     여기서 매번 DB 를 부르면 관리자 화면이 아닌 페이지까지 느려진다.
     (아래 `loadCreds` 는 `/_admin` 을 볼 때만 불린다)
*/
let cached: Creds | null = null
let cachedAt = 0
/** 비밀번호를 바꿨을 때 오래 안 먹히면 곤란하다 — 5분마다 다시 읽는다 */
const CACHE_MS = 5 * 60 * 1000

async function loadCreds(): Promise<Creds | null> {
  if (cached && Date.now() - cachedAt < CACHE_MS) return cached

  /*
    환경변수가 있으면 그쪽이 먼저다.
    DB 를 못 읽는 상황에서도 들어갈 수 있는 **비상 통로**로 남겨 둔다.
  */
  const envUser = process.env.ADMIN_USER
  const envSalt = process.env.ADMIN_PW_SALT
  const envHash = process.env.ADMIN_PW_HASH
  const envSecret = process.env.ADMIN_SESSION_SECRET
  if (envUser && envSalt && envHash && envSecret) {
    cached = { username: envUser, salt: envSalt, hash: envHash, secret: envSecret }
    cachedAt = Date.now()
    return cached
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null

  try {
    /*
      supabase-js 를 쓰지 않고 직접 부른다 — middleware(edge)에서도 돌아야 하는데
      라이브러리를 통째로 들이면 edge 번들이 그만큼 무거워진다.
    */
    const res = await fetch(
      `${url}/rest/v1/admin_credentials?select=username,pw_salt,pw_hash,session_secret&limit=1`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "no-store" }
    )
    if (!res.ok) return null
    const rows = (await res.json()) as {
      username: string
      pw_salt: string
      pw_hash: string
      session_secret: string
    }[]
    const r = rows[0]
    if (!r) return null
    cached = { username: r.username, salt: r.pw_salt, hash: r.pw_hash, secret: r.session_secret }
    cachedAt = Date.now()
    return cached
  } catch {
    return null
  }
}

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

async function hmac(message: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ])
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message))
  // 쿠키에 들어가므로 +/= 가 없는 base64url 로
  return b64(sig).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

/** 아이디·비밀번호가 맞는가 */
export async function verifyLogin(user: string, password: string): Promise<boolean> {
  const c = await loadCreds()
  if (!c) return false
  try {
    // ⚠️ 아이디가 틀려도 **같은 시간**을 쓰도록 계산은 끝까지 한다.
    //    일찍 돌아가면 "아이디는 맞았다"가 시간으로 새어 나간다.
    const got = await pbkdf2(password, c.salt)
    const sameUser = sameBytes(enc.encode(user), enc.encode(c.username))
    const samePw = sameBytes(got, fromB64(c.hash))
    return sameUser && samePw
  } catch {
    return false
  }
}

/** 서명된 세션 값 만들기 — `발급시각.서명` */
export async function issueSession(): Promise<string | null> {
  const c = await loadCreds()
  if (!c) return null
  const issued = Date.now().toString()
  return `${issued}.${await hmac(issued, c.secret)}`
}

/** 쿠키가 우리가 발급한 것이고 아직 안 지났는가 */
export async function verifySession(value: string | undefined): Promise<boolean> {
  if (!value) return false
  const [issued, sig] = value.split(".")
  if (!issued || !sig || !/^\d+$/.test(issued)) return false

  // 만료부터 본다 — 지난 쿠키라면 DB 를 부를 이유가 없다
  const age = (Date.now() - Number(issued)) / 1000
  if (age < 0 || age >= SESSION_MAX_AGE) return false

  const c = await loadCreds()
  if (!c) return false
  try {
    const expect = await hmac(issued, c.secret)
    return sameBytes(enc.encode(sig), enc.encode(expect))
  } catch {
    return false
  }
}

/**
 * 비밀번호 바꾸기. 새 소금을 뽑아 다시 해시한다.
 *
 * ⚠️ 서명 열쇠도 같이 바꾼다 — **바꾸는 순간 열려 있던 모든 로그인이 끊긴다.**
 *    비밀번호를 바꾸는 이유가 보통 "남이 알아낸 것 같다"이므로, 그 사람이
 *    이미 들고 있는 쿠키도 같이 죽어야 한다.
 */
export async function changePassword(next: string): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  const c = await loadCreds()
  if (!url || !key || !c) return false

  const rand = (n: number) => b64(crypto.getRandomValues(new Uint8Array(n)).buffer)
  const salt = rand(16)
  const hash = b64((await pbkdf2(next, salt)).buffer as ArrayBuffer)
  const secret = rand(32)

  const res = await fetch(`${url}/rest/v1/admin_credentials?id=eq.true`, {
    method: "PATCH",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ pw_salt: salt, pw_hash: hash, session_secret: secret, updated_at: new Date().toISOString() }),
  })
  if (!res.ok) return false
  cached = null
  return true
}
