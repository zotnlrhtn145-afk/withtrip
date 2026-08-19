import Link from "next/link"

import { fetchContent, type ContentKind } from "@/lib/admin-data"

import { deleteContentAction, toggleHideAction } from "../actions"
import { ConfirmSubmit } from "../confirm-button"
import { ago, cut } from "../format"

export const dynamic = "force-dynamic"

const KINDS = [
  { key: "all", label: "전체" },
  { key: "clip", label: "여행클립" },
  { key: "message", label: "대화" },
  { key: "place", label: "맛집" },
  { key: "review", label: "리뷰" },
] as const

const KIND_LABEL: Record<ContentKind, string> = {
  clip: "클립",
  message: "대화",
  place: "맛집",
  review: "리뷰",
}

export default async function ContentPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; q?: string }>
}) {
  const sp = await searchParams
  const kind = (KINDS.find((k) => k.key === sp.kind)?.key ?? "all") as ContentKind | "all"
  const q = (sp.q ?? "").trim().toLowerCase()

  let items: Awaited<ReturnType<typeof fetchContent>> = []
  let error: string | null = null
  try {
    items = await fetchContent(kind, 150)
  } catch (e) {
    error = e instanceof Error ? e.message : "글을 읽지 못했습니다"
  }

  const rows = q
    ? items.filter((i) => i.text.toLowerCase().includes(q) || i.author.toLowerCase().includes(q))
    : items

  return (
    <>
      <div className="wt-top">
        <div>
          <h1>글 관리</h1>
          <div className="wt-sub">
            최근 순 · 클립·대화·맛집·리뷰를 한 줄기로 봅니다
          </div>
        </div>
        <div className="wt-seg">
          {KINDS.map((k) => (
            <Link
              key={k.key}
              href={k.key === "all" ? "/_admin/content" : `/_admin/content?kind=${k.key}`}
              className={k.key === kind ? "on" : ""}
            >
              {k.label}
            </Link>
          ))}
        </div>
      </div>

      {error && (
        <div className="wt-card" style={{ marginBottom: 12 }}>
          <p style={{ margin: 0, fontSize: 13, color: "var(--crit)" }}>{error}</p>
        </div>
      )}

      <div className="wt-card">
        <h2>
          {rows.length.toLocaleString("ko-KR")}건
          {q && <span className="wt-muted" style={{ fontWeight: 400 }}> · &lsquo;{sp.q}&rsquo; 검색</span>}
        </h2>
        <div className="cap">
          <b>가리기</b>는 앱·웹에서 안 보이게만 하고 원본은 남깁니다 — 잘못 눌러도 되돌릴 수 있습니다.
          <b> 지우기</b>는 되돌릴 수 없으니 남겨 두면 안 되는 것에만 쓰세요.
        </div>

        <form style={{ maxWidth: 260, marginBottom: 12 }}>
          {kind !== "all" && <input type="hidden" name="kind" value={kind} />}
          <input name="q" type="text" placeholder="내용·작성자로 찾기" defaultValue={sp.q ?? ""} aria-label="검색" />
        </form>

        <div className="wt-scroll">
          <table>
            <thead>
              <tr>
                <th style={{ width: 58 }}>종류</th>
                <th>내용</th>
                <th style={{ width: 110 }}>작성자</th>
                <th style={{ width: 76 }}>언제</th>
                <th style={{ width: 130 }} />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="wt-empty">
                    {q ? "찾는 글이 없습니다" : "글이 없습니다"}
                  </td>
                </tr>
              )}
              {rows.map((it) => (
                <tr key={`${it.kind}-${it.id}`} style={it.hidden ? { opacity: 0.55 } : undefined}>
                  <td>
                    <span className="wt-chip nt">{KIND_LABEL[it.kind]}</span>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
                      {it.media && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={it.media}
                          alt=""
                          width={40}
                          height={40}
                          style={{ borderRadius: 6, objectFit: "cover", flex: "none", background: "var(--bar-soft)" }}
                        />
                      )}
                      <div style={{ minWidth: 0 }}>
                        <div>{cut(it.text) || <span className="wt-muted">(글 없음)</span>}</div>
                        {it.where && (
                          <div className="wt-muted" style={{ fontSize: 11, marginTop: 2 }}>
                            {cut(it.where, 46)}
                          </div>
                        )}
                        {it.hidden && (
                          <span className="wt-chip cr" style={{ marginTop: 4 }}>
                            가려짐
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="wt-muted">{it.author}</td>
                  <td className="wt-muted">{ago(it.at)}</td>
                  <td className="wt-num">
                    <div style={{ display: "flex", gap: 5, justifyContent: "flex-end" }}>
                      <form action={toggleHideAction}>
                        <input type="hidden" name="kind" value={it.kind} />
                        <input type="hidden" name="id" value={it.id} />
                        <input type="hidden" name="hidden" value={it.hidden ? "1" : "0"} />
                        <button className="wt-btn" type="submit">
                          {it.hidden ? "되돌리기" : "가리기"}
                        </button>
                      </form>
                      <form action={deleteContentAction}>
                        <input type="hidden" name="kind" value={it.kind} />
                        <input type="hidden" name="id" value={it.id} />
                        <ConfirmSubmit
                          message={`${KIND_LABEL[it.kind]} 한 건을 정말 지울까요?\n\n"${cut(it.text, 50) || "(글 없음)"}"\n— ${it.author}\n\n되돌릴 수 없습니다. 잠시 안 보이게만 하려면 '가리기'를 쓰세요.`}
                        >
                          지우기
                        </ConfirmSubmit>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
