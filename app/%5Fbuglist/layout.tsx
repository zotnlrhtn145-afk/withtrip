import type { Metadata } from "next"

import "./buglist.css"

export const metadata: Metadata = {
  title: "위드트립 버그 신고",
  // 검색엔진에 걸릴 이유가 없다. 테스터끼리 쓰는 곳이다
  robots: { index: false, follow: false },
}

export const dynamic = "force-dynamic"

export default function BugListLayout({ children }: { children: React.ReactNode }) {
  return <div className="bl">{children}</div>
}
