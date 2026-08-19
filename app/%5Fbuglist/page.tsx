import Link from "next/link"
import { redirect } from "next/navigation"

import { loadBugPage } from "@/lib/buglist"

import { BugList } from "./list"

export const dynamic = "force-dynamic"

const TABS = [
  { key: "open", label: "안 끝난 것" },
  { key: "mine", label: "내가 쓴 글" },
  { key: "new", label: "새 신고" },
  { key: "queued", label: "수정 대기" },
  { key: "resolved", label: "해결됨" },
  { key: "all", label: "전체" },
] as const

export default async function BugListPage({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>
}) {
  const sp = await searchParams
  const tab = TABS.find((t) => t.key === sp.s)?.key ?? "open"

  // 목록·개수·로그인한 사람을 **한 번에** 받는다 (왕복 하나가 곧 체감 속도다)
  let page: Awaited<ReturnType<typeof loadBugPage>> = null
  let error: string | null = null
  try {
    page = await loadBugPage(tab === "all" ? null : tab)
  } catch (e) {
    error = e instanceof Error ? e.message : "목록을 읽지 못했습니다"
  }
  if (!page && !error) redirect("/_buglist/login")

  const me = page?.me ?? { id: "", email: null, name: "", isAdmin: false }
  const rows = page?.rows ?? []
  const counts = page?.counts ?? {}

  return (
    <div className="bl-wrap">
      <header className="bl-head">
        <div className="bl-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="bl-logo" src="/admin-logo.png" alt="" width={28} height={28} />
          <h1>버그 신고</h1>
          <span className="bl-who">
            {me.name}
            {me.isAdmin && " · 관리자"}
          </span>
        </div>

        <nav className="bl-tabs" aria-label="거르기">
          {TABS.map((t) => {
            const n = counts[t.key]
            return (
              <Link
                key={t.key}
                href={t.key === "open" ? "/_buglist" : `/_buglist?s=${t.key}`}
                className={`bl-tab${t.key === tab ? " on" : ""}`}
              >
                {t.label}
                {n ? ` ${n}` : ""}
              </Link>
            )
          })}
        </nav>
      </header>

      {error && <div className="bl-err">{error}</div>}

      <BugList rows={rows} isAdmin={me.isAdmin} />

      {me.isAdmin && (
        <p className="bl-foot">
          고칠 것을 체크해서 <b>수정 요청</b>을 보내면 대기열에 쌓이고,
          <br />
          한 시간마다 하나씩 자동으로 처리됩니다.
        </p>
      )}

      <Link className="bl-fab" href="/_buglist/new">
        ＋ 신고하기
      </Link>
    </div>
  )
}
