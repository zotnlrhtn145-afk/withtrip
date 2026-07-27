export type AppView =
  | "home"
  | "detail"
  | "friends"
  | "spots"
  | "settlement"
  | "login"
  | "signup"
  | "forgot-password"
  | "mypage"

export type SessionUser = {
  /** Stable UUID used as `user_id` when Supabase Auth session is absent (demo login). */
  id: string
  name: string
  initials: string
  email: string
  membership: string
  joinedAt: string
}

export const demoUser: SessionUser = {
  id: "a1b2c3d4-e5f6-4789-a012-3456789abcde",
  name: "오수환",
  initials: "SH",
  email: "suhwan.oh@withtrip.app",
  membership: "Yellow Club",
  joinedAt: "2024.03.11",
}
