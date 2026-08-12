import { createClient, type SupabaseClient } from "@supabase/supabase-js"

/**
 * 서버 전용 Supabase 클라이언트 (service_role — RLS 우회).
 *
 * ⚠️ 절대 클라이언트 컴포넌트에서 import 하지 말 것. API 라우트/크론에서만 사용한다.
 * 키가 없으면 null을 돌려준다 — 호출부는 null이면 "캐시 없음"으로 취급하고
 * 기존 동작(구글 직접 호출)으로 그대로 진행해야 한다.
 */
let adminClient: SupabaseClient | null = null
let resolved = false

export function getSupabaseAdmin(): SupabaseClient | null {
  if (resolved) return adminClient
  resolved = true

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    // 키 미설정은 정상 상황으로 취급한다 (캐시 비활성 = 기존 동작).
    console.warn("[supabase-admin] SUPABASE_SERVICE_ROLE_KEY 미설정 — 장소 캐시 비활성화")
    adminClient = null
    return null
  }

  adminClient = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return adminClient
}
