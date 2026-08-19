import type { Metadata } from "next"
import { cookies } from "next/headers"

import { ADMIN_COOKIE, verifySession } from "@/lib/admin-auth"
import { fetchOverview } from "@/lib/admin-data"

import { AdminNav } from "./nav"
import "./admin.css"

export const metadata: Metadata = {
  title: "위드트립 관리자",
  // ⚠️ 검색엔진이 관리자 화면을 긁어 가면 주소가 세상에 알려진다
  robots: { index: false, follow: false, nocache: true },
}

/** 숫자가 늘 최신이어야 한다 — 캐시해 두면 어제 값을 보게 된다 */
export const dynamic = "force-dynamic"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const jar = await cookies()
  const authed = await verifySession(jar.get(ADMIN_COOKIE)?.value)

  // 로그인 화면은 껍데기 없이 그대로 (middleware 가 이미 나머지를 막는다)
  if (!authed) return <div className="wt-admin">{children}</div>

  let counts = { clips: 0, messages: 0, places: 0, reviews: 0, users: 0, reports_open: 0, hidden: 0 }
  try {
    counts = await fetchOverview()
  } catch {
    /* 숫자를 못 읽어도 화면은 열려야 한다 — 0으로 두고 본문에서 이유를 보여 준다 */
  }

  return (
    <div className="wt-admin">
      <div className="wt-wrap">
        <AdminNav
          groups={[
            {
              label: "현황",
              items: [
                { href: "/_admin", icon: "▤", label: "대시보드" },
                { href: "/_admin/costs", icon: "₩", label: "비용·과금" },
                { href: "/_admin/traffic", icon: "↗", label: "트래픽" },
              ],
            },
            {
              label: "계정",
              items: [{ href: "/_admin/settings", icon: "⚙", label: "설정" }],
            },
            {
              label: "사람",
              items: [
                { href: "/_admin/users", icon: "◍", label: "가입자", count: counts.users },
                /*
                  신고는 **빨갛게** 띄운다. 남이 불편을 겪고 직접 눌러 보낸 것이라
                  다른 숫자와 같은 무게로 보이면 안 된다.
                */
                {
                  href: "/_admin/reports",
                  icon: "⚑",
                  label: "신고",
                  count: counts.reports_open,
                  hot: counts.reports_open > 0,
                },
              ],
            },
            {
              label: "콘텐츠",
              items: [
                { href: "/_admin/content", icon: "✎", label: "글 관리", count: counts.clips + counts.reviews },
                {
                  href: "/_admin/content?kind=message",
                  icon: "☷",
                  label: "대화",
                  count: counts.messages,
                },
                { href: "/_admin/content?kind=place", icon: "◔", label: "맛집·리뷰", count: counts.places },
                {
                  href: "/_admin/hidden",
                  icon: "⚑",
                  label: "가린 글",
                  count: counts.hidden,
                },
              ],
            },
          ]}
        />
        <main className="wt-main">{children}</main>
      </div>
    </div>
  )
}
