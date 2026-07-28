import type { AuthError, Provider } from "@supabase/supabase-js"

import { clearWithTripClientCaches } from "@/lib/client-session-reset"
import { createClient } from "@/utils/supabase/client"

export type AuthProviderId = "kakao" | "google"

const OAUTH_PROVIDERS: Record<AuthProviderId, Provider> = {
  kakao: "kakao",
  google: "google",
}

function getBrowserSupabase() {
  return createClient()
}


/** Map Supabase Auth errors to Korean UI copy. */
export function mapAuthError(error: AuthError | Error | null | undefined): string {
  if (!error) return "알 수 없는 오류가 발생했어요."
  const raw = String(error.message ?? "").toLowerCase()
  const code = "code" in error ? String((error as AuthError).code ?? "").toLowerCase() : ""

  if (
    raw.includes("invalid login credentials") ||
    raw.includes("invalid credentials") ||
    code === "invalid_credentials"
  ) {
    return "이메일 또는 비밀번호가 올바르지 않습니다."
  }
  if (raw.includes("email not confirmed") || code === "email_not_confirmed") {
    return "이메일 인증이 완료되지 않았어요. 받은편지함을 확인해 주세요."
  }
  if (raw.includes("user already registered") || code === "user_already_exists") {
    return "이미 가입된 이메일이에요. 로그인해 주세요."
  }
  if (raw.includes("password") && (raw.includes("weak") || raw.includes("at least"))) {
    return "비밀번호는 영문·숫자를 포함해 8자 이상이어야 해요."
  }
  if (raw.includes("rate limit") || raw.includes("too many")) {
    return "요청이 너무 많아요. 잠시 후 다시 시도해 주세요."
  }
  if (raw.includes("network") || raw.includes("fetch")) {
    return "네트워크 연결을 확인해 주세요."
  }

  return error.message || "요청을 처리하지 못했어요."
}

export function getAuthRedirectTo(path = "/auth/callback") {
  if (typeof window === "undefined") return path
  return `${window.location.origin}${path.startsWith("/") ? path : `/${path}`}`
}

export async function signInWithEmailPassword(email: string, password: string) {
  const supabase = getBrowserSupabase()
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  })
  if (error) throw error
  return data
}

export async function signUpWithEmailPassword(
  email: string,
  password: string,
  meta?: { name?: string }
) {
  const supabase = getBrowserSupabase()
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: {
      emailRedirectTo: getAuthRedirectTo("/auth/callback"),
      data: meta?.name ? { full_name: meta.name.trim(), name: meta.name.trim() } : undefined,
    },
  })
  if (error) throw error
  return data
}

export async function signInWithOAuthProvider(provider: AuthProviderId) {
  const supabase = getBrowserSupabase()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: OAUTH_PROVIDERS[provider],
    options: {
      redirectTo: getAuthRedirectTo("/auth/callback"),
    },
  })
  if (error) throw error
  return data
}

export async function resetPasswordForEmail(email: string) {
  const supabase = getBrowserSupabase()
  const { data, error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: getAuthRedirectTo("/auth/callback"),
  })
  if (error) throw error
  return data
}

export async function signOutAuth() {
  const supabase = getBrowserSupabase()
  const { error } = await supabase.auth.signOut()
  clearWithTripClientCaches()
  if (error) throw error
}
