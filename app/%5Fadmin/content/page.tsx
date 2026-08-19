import Link from "next/link"

import { fetchContent, type ContentKind } from "@/lib/admin-data"

import { ContentList } from "./list"

export const dynamic = "force-dynamic"

const KINDS = [
  { key: "all", label: "전체" },
  { key: "clip", label: "여행클립" },
  { key: "message", label: "대화" },
  { key: "place", label: "맛집" },
  { key: "review", label: "리뷰" },
] as const

const RANGES = [
  { key: "30", label: "최근 1달", days: 30 },
  { key: "7", label: "최근 1주", days: 7 },
  { key: "90", label: "최근 3달", days: 90 },
] as const

export default async function ContentPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; q?: string; d?: string }>
}) {
  const sp = await searchParams
  const kind = (KINDS.find((k) => k.key === sp.kind)?.key ?? "all") as ContentKind | "all"
  const range = RANGES.find((r) => r.key === sp.d) ?? RANGES[0]
  const q = (sp.q ?? "").trim().toLowerCase()

  let items: Awaited<ReturnType<typeof fetchContent>> = []
  let error: string | null = null
  try {
    // 첫 화면에는 15개만. 스크롤하면 화면이 알아서 이어 받는다.
    items = await fetchContent(kind, { limit: 15, days: range.days })
  } catch (e) {
    error = e instanceof Error ? e.message : "글을 읽지 못했습니다"
  }

  const linkTo = (over: { kind?: string; d?: string }) => {
    const p = new URLSearchParams()
    const k = over.kind ?? (kind === "all" ? "" : kind)
    const d = over.d ?? range.key
    if (k) p.set("kind", k)
    if (d !== "30") p.set("d", d)
    if (sp.q) p.set("q", sp.q)
    const s = p.toString()
    return s ? `/_admin/content?${s}` : "/_admin/content"
  }

  return (
    <>
      <div className="wt-top">
        <div>
          <h1>글 관리</h1>
          <div className="wt-sub">최근 순 · 클립·대화·맛집·리뷰를 한 줄기로 봅니다</div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <div className="wt-seg">
            {RANGES.map((r) => (
              <Link key={r.key} href={linkTo({ d: r.key })} className={r.key === range.key ? "on" : ""}>
                {r.label}
              </Link>
            ))}
          </div>
          <div className="wt-seg">
            {KINDS.map((k) => (
              <Link key={k.key} href={linkTo({ kind: k.key === "all" ? "" : k.key })} className={k.key === kind ? "on" : ""}>
                {k.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="wt-card" style={{ marginBottom: 12 }}>
          <p style={{ margin: 0, fontSize: 13, color: "var(--crit)" }}>{error}</p>
        </div>
      )}

      <div className="wt-card">
        <h2>
          {range.label}
          {q && <span className="wt-muted" style={{ fontWeight: 400 }}> · &lsquo;{sp.q}&rsquo; 검색</span>}
        </h2>
        <div className="cap">
          <b>가리기</b>는 앱·웹에서 안 보이게만 하고 원본은 남깁니다 — 잘못 눌러도 되돌릴 수 있습니다.
          <b> 지우기</b>는 되돌릴 수 없으니 남겨 두면 안 되는 것에만 쓰세요.
          <br />
          스크롤을 내리면 15개씩 이어서 불러옵니다.
        </div>

        <form style={{ maxWidth: 260, marginBottom: 12 }}>
          {kind !== "all" && <input type="hidden" name="kind" value={kind} />}
          {range.key !== "30" && <input type="hidden" name="d" value={range.key} />}
          <input name="q" type="text" placeholder="내용·작성자로 찾기" defaultValue={sp.q ?? ""} aria-label="검색" />
        </form>

        {/*
          ⚠️ 검색어는 **지금 불러온 것 안에서만** 찾는다. 표 전체를 뒤지려면
             표 4개를 통째로 훑어야 해서 느려지는데, 검열은 최근 것을 보는 일이라
             그만한 값을 치를 이유가 없다. 못 찾으면 기간을 늘려서 보면 된다.
        */}
        <ContentList
          key={`${kind}-${range.key}`}
          first={items}
          kind={kind}
          days={range.days}
          query={q}
        />
      </div>
    </>
  )
}
