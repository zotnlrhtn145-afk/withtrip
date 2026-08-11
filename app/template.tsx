"use client"

import { usePathname } from "next/navigation"

/**
 * 라우트 전환 시 부드러운 페이드+슬라이드 — 앱 같은 화면 이동 느낌.
 * template.tsx 는 페이지 이동마다 리마운트되므로(레이아웃과 달리) 매 전환에서 애니메이션이 재생된다.
 * 셸 내부 탭(홈↔저장 등)은 라우트 이동이 아니라 상태 전환이라 여기 영향 없음(각 화면에서 별도 처리).
 * transform은 재생 후 남지 않게(animate-view-in = fill backwards) 처리되어 fixed/sticky를 깨지 않는다.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  return (
    <div key={pathname} className="animate-view-in">
      {children}
    </div>
  )
}
