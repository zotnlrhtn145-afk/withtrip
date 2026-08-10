import { createClient } from "@/utils/supabase/client"

export type ReportReason =
  | "spam"
  | "harassment"
  | "inappropriate"
  | "hate"
  | "violence"
  | "illegal"
  | "other"

export type ReportContentType =
  | "user"
  | "profile"
  | "dm_message"
  | "trip_message"
  | "saved_place"
  | "spot"

export const REPORT_REASONS: { key: ReportReason; label: string }[] = [
  { key: "spam", label: "스팸 / 광고" },
  { key: "harassment", label: "욕설 / 괴롭힘" },
  { key: "inappropriate", label: "부적절한 콘텐츠" },
  { key: "hate", label: "혐오 발언" },
  { key: "violence", label: "폭력 / 위협" },
  { key: "illegal", label: "불법 정보" },
  { key: "other", label: "기타" },
]

function logSupabaseError(scope: string, error: { message?: string; details?: string; hint?: string }) {
  console.error(`[${scope}]`, error.message, error.details, error.hint)
}

/** 내가 차단했거나 나를 차단한 사용자 id 집합 (양방향 숨김) */
export async function fetchBlockedIds(): Promise<Set<string>> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("blocked_user_ids")
  if (error) {
    logSupabaseError("fetchBlockedIds", error)
    return new Set()
  }
  return new Set(((data as string[]) ?? []).map(String))
}

/** 내가 차단한 사용자 id만 (차단 목록 관리용) */
export async function fetchMyBlockedIds(): Promise<string[]> {
  const supabase = createClient()
  const { data: auth } = await supabase.auth.getUser()
  const me = auth.user?.id
  if (!me) return []
  const { data, error } = await supabase.from("blocks").select("blocked_id").eq("blocker_id", me)
  if (error) {
    logSupabaseError("fetchMyBlockedIds", error)
    return []
  }
  return ((data as { blocked_id: string }[]) ?? []).map((r) => String(r.blocked_id))
}

export async function blockUser(targetId: string): Promise<boolean> {
  const supabase = createClient()
  const { data: auth } = await supabase.auth.getUser()
  const me = auth.user?.id
  if (!me || me === targetId) return false
  const { error } = await supabase.from("blocks").insert({ blocker_id: me, blocked_id: targetId })
  if (error && !/duplicate|unique/i.test(error.message ?? "")) {
    logSupabaseError("blockUser", error)
    return false
  }
  return true
}

export async function unblockUser(targetId: string): Promise<boolean> {
  const supabase = createClient()
  const { data: auth } = await supabase.auth.getUser()
  const me = auth.user?.id
  if (!me) return false
  const { error } = await supabase
    .from("blocks")
    .delete()
    .eq("blocker_id", me)
    .eq("blocked_id", targetId)
  if (error) {
    logSupabaseError("unblockUser", error)
    return false
  }
  return true
}

export async function reportContent(input: {
  targetUserId?: string | null
  contentType: ReportContentType
  contentId?: string | null
  reason: ReportReason
  detail?: string
  excerpt?: string
}): Promise<boolean> {
  const supabase = createClient()
  const { data: auth } = await supabase.auth.getUser()
  const me = auth.user?.id
  if (!me) return false
  const { error } = await supabase.from("reports").insert({
    reporter_id: me,
    target_user_id: input.targetUserId ?? null,
    content_type: input.contentType,
    content_id: input.contentId ?? null,
    reason: input.reason,
    detail: input.detail ?? null,
    content_excerpt: input.excerpt ?? null,
  })
  if (error) {
    logSupabaseError("reportContent", error)
    return false
  }
  return true
}
