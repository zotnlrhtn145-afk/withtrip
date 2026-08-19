"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import type { ContentItem, ContentKind } from "@/lib/admin-data"

import { deleteContentAction, loadMoreContentAction, toggleHideAction } from "../actions"
import { ConfirmSubmit } from "../confirm-button"
import { ago, cut } from "../format"

const KIND_LABEL: Record<ContentKind, string> = {
  clip: "클립",
  message: "대화",
  place: "맛집",
  review: "리뷰",
}

const PAGE = 15

export function ContentList({
  first,
  kind,
  days,
  query,
}: {
  first: ContentItem[]
  kind: string
  days: number
  query: string
}) {
  const [items, setItems] = useState(first)
  const [done, setDone] = useState(first.length < PAGE)
  const [loading, setLoading] = useState(false)
  const sentinel = useRef<HTMLDivElement | null>(null)

  /*
    ⚠️ 화면을 다른 종류로 바꾸면 서버가 새 목록을 준다. 그때 이전 목록이
       남아 있으면 **다른 종류의 글이 섞여 보인다.**
  */
  useEffect(() => {
    setItems(first)
    setDone(first.length < PAGE)
  }, [first])

  const loadMore = useCallback(async () => {
    if (loading || done || items.length === 0) return
    setLoading(true)
    try {
      const last = items[items.length - 1]
      const next = await loadMoreContentAction(kind, last.at, days)
      if (next.length === 0) {
        setDone(true)
      } else {
        setItems((prev) => {
          // 같은 시각의 글이 경계에 걸리면 겹쳐 올 수 있다 — 열쇠로 걸러 낸다
          const seen = new Set(prev.map((i) => `${i.kind}:${i.id}`))
          const fresh = next.filter((i) => !seen.has(`${i.kind}:${i.id}`))
          if (fresh.length === 0) setDone(true)
          return [...prev, ...fresh]
        })
        if (next.length < PAGE) setDone(true)
      }
    } catch {
      // 더 못 가져오면 조용히 멈춘다 — 아래에 "더 보기"가 남는다
      setLoading(false)
      return
    }
    setLoading(false)
  }, [items, kind, days, loading, done])

  /*
    바닥이 보이면 다음 쪽을 가져온다.
    ⚠️ `rootMargin` 을 넉넉히 줘서 **바닥에 닿기 전에** 미리 부른다.
       닿고 나서 부르면 매번 빈 화면을 잠깐 보게 된다.
  */
  useEffect(() => {
    const el = sentinel.current
    if (!el || done) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore()
      },
      { rootMargin: "400px" }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [loadMore, done])

  const rows = query
    ? items.filter(
        (i) => i.text.toLowerCase().includes(query) || i.author.toLowerCase().includes(query)
      )
    : items

  return (
    <>
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
                  {query ? "찾는 글이 없습니다" : "최근 한 달 안에 올라온 글이 없습니다"}
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
                        loading="lazy"
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

      {/* 스크롤이 여기 가까워지면 다음 15개를 가져온다 */}
      <div ref={sentinel} />

      <div style={{ textAlign: "center", padding: "14px 0 2px" }}>
        {loading && <span className="wt-muted" style={{ fontSize: 12 }}>불러오는 중…</span>}
        {!loading && done && items.length > 0 && (
          <span className="wt-muted" style={{ fontSize: 11.5 }}>
            최근 한 달치를 다 봤습니다 · {items.length}건
          </span>
        )}
        {!loading && !done && (
          <button className="wt-btn" type="button" onClick={() => void loadMore()}>
            더 보기
          </button>
        )}
      </div>
    </>
  )
}
