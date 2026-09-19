import "server-only"
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto"
import { NextResponse } from "next/server"
import { shareAuth } from "@/lib/place-share-server"
import { getSupabaseAdmin } from "@/lib/supabase-admin"

// 운영 계정 ID 대조 완료. 사용자가 바꿀 수 있는 닉네임은 권한 판단에 쓰지 않습니다.
const EXEMPT_USERS = new Set(["b54b0242-cdba-4935-b906-2aeb4e429661", "bc385599-4d9f-4d50-bbe8-d1e5aa0c0392"])
export function widyQuotaDay(now = new Date()) {
  return new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
}
export async function checkWidyQuota(request: Request): Promise<{response:NextResponse;userId?:never}|{response:null;userId:string}> {
  const {user} = await shareAuth(request)
  if (!user) return {response:NextResponse.json({mode:"chat",reply:"로그인 후 다시 이용해 주세요.",code:"AUTH_REQUIRED"},{status:401})}
  if (EXEMPT_USERS.has(user.id)) return {response:null,userId:user.id}
  const db = getSupabaseAdmin(), secret = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!db || !secret) return {response:NextResponse.json({mode:"chat",reply:"사용량을 확인하지 못했어요. 잠시 후 다시 시도해 주세요."},{status:503})}
  // 기존 원자적 DB 카운터 재사용. 개인정보와 추측 가능한 버킷은 노출하지 않습니다.
  const key = createHmac("sha256",secret).update(`widy:${user.id}:${widyQuotaDay()}`).digest("hex")
  const {data,error} = await db.rpc("bump_api_counter",{p_bucket:`widy:${key}`,p_ttl_seconds:172800})
  if (error || typeof data !== "number") return {response:NextResponse.json({mode:"chat",reply:"사용량을 확인하지 못했어요. 잠시 후 다시 시도해 주세요."},{status:503})}
  if (data > 10) return {response:NextResponse.json({mode:"chat",reply:"오늘의 질문 10개를 모두 사용하셨어요. 내일 다시 이용해 주세요. 매일 한국 시간 자정에 새로 시작돼요.",code:"WIDY_DAILY_LIMIT"},{status:429})}
  return {response:null,userId:user.id}
}

export function createWidyPlaceTicket(userId:string, query:string): string {
  const payload = Buffer.from(JSON.stringify({userId,query,nonce:randomUUID(),expires:Date.now()+120000})).toString("base64url")
  const sig = createHmac("sha256",process.env.SUPABASE_SERVICE_ROLE_KEY!).update(payload).digest("base64url")
  return `${payload}.${sig}`
}
export async function consumeWidyPlaceTicket(request:Request, token:unknown, query:string):Promise<boolean> {
  try {
    if(typeof token!=="string"||token.length>2500)return false
    const [payload,sig,...rest]=token.split(".")
    if(rest.length||!payload||!sig||!process.env.SUPABASE_SERVICE_ROLE_KEY)return false
    const expected=createHmac("sha256",process.env.SUPABASE_SERVICE_ROLE_KEY).update(payload).digest()
    const actual=Buffer.from(sig,"base64url")
    if(actual.length!==expected.length||!timingSafeEqual(actual,expected))return false
    const data=JSON.parse(Buffer.from(payload,"base64url").toString())
    if(data.expires<Date.now()||data.query!==query||typeof data.nonce!=="string")return false
    const {user}=await shareAuth(request)
    if(!user||data.userId!==user.id)return false
    const db=getSupabaseAdmin();if(!db)return false
    const {data:count,error}=await db.rpc("bump_api_counter",{p_bucket:`widy-step:${data.nonce}`,p_ttl_seconds:300})
    return !error&&count===1
  } catch {return false}
}
