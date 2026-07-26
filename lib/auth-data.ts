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
  name: string
  initials: string
  email: string
  membership: string
  joinedAt: string
}

export const demoUser: SessionUser = {
  name: "오수환",
  initials: "SH",
  email: "suhwan.oh@withtrip.kr",
  membership: "Yellow Club",
  joinedAt: "2024.03.11",
}
