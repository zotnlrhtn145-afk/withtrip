"use client"

import Link from "next/link"
import { useState, useTransition } from "react"

import type { BugRow } from "@/lib/buglist"

import { queueFixAction } from "./actions"

const SEV_LABEL: Record<string, string> = { high: "심각", mid: "보통", low: "낮음" }
const SEV_CHIP: Record<string, string> = { high: "crit", mid: "warn", low: "nt" }
const PLAT_LABEL: Record<string, string> = { ios: "아이폰", android: "안드로이드", web: "웹", both: "둘 다" }
const STATUS_LABEL: Record<string, string> = {
  new: "새 신고",
  seen: "확인함",
  queued: "수정 대기",
  fixing: "고치는 중",
  resolved: "해결됨",
  wontfix: "안 고침",
}

function when(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return "방금"
  if (min < 60) return `${min}분 전`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}시간 전`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}일 전`
  const d = new Date(new Date(iso).getTime() + 9 * 3600_000)
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일`
}

export function BugList({ rows, isAdmin }: { rows: BugRow[]; isAdmin: boolean }) {
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [pending, start] = useTransition()

  /*
    ⚠️ 이미 대기열에 있거나 끝난 건 고를 수 없다. 두 번 줄 세우면 같은 걸
       두 번 고치려다 커밋이 엉킨다.
  */
  const canPick = (r: BugRow) => r.status === "new" || r.status === "seen"

  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const send = () => {
    const ids = [...picked].join(",")
    if (!ids) return
    const fd = new FormData()
    fd.set("ids", ids)
    start(async () => {
      await queueFixAction(fd)
      setPicked(new Set())
    })
  }

  if (rows.length === 0) {
    return (
      <div className="bl-empty">
        아직 올라온 신고가 없습니다.
        <br />
        불편한 걸 발견하면 바로 남겨 주세요.
      </div>
    )
  }

  return (
    <>
      <div className="bl-list">
        {rows.map((r) => {
          const done = r.status === "resolved" || r.status === "wontfix"
          const on = picked.has(r.id)
          return (
            <article
              key={r.id}
              className={`bl-bug ${done ? "is-done" : `sev-${r.severity}`}`}
            >
              <div className="bl-in">
                {isAdmin && (
                  <button
                    type="button"
                    className="bl-check"
                    aria-pressed={on}
                    aria-label={on ? "고른 것 빼기" : "수정할 것으로 고르기"}
                    disabled={!canPick(r)}
                    onClick={() => toggle(r.id)}
                  >
                    ✓
                  </button>
                )}

                <Link className="bl-link" href={`/_buglist/${r.id}`}>
                  <h2 className="bl-title">{r.title}</h2>
                  <div className="bl-meta">
                    {r.reporter_name}
                    {r.device ? ` · ${r.device}` : ""}
                    {r.app_version ? ` · ${r.app_version}` : ""} · {when(r.created_at)}
                  </div>

                  <div className="bl-tags">
                    {!done && (
                      <span className={`bl-chip ${SEV_CHIP[r.severity]}`}>{SEV_LABEL[r.severity]}</span>
                    )}
                    <span className="bl-chip plat">{PLAT_LABEL[r.platform]}</span>
                    {done ? (
                      <span className="bl-chip ok">{STATUS_LABEL[r.status]}</span>
                    ) : r.status !== "new" ? (
                      <span className="bl-chip nt">{STATUS_LABEL[r.status]}</span>
                    ) : null}
                    {r.note_count > 0 && <span className="bl-chip nt">메모 {r.note_count}</span>}
                    {r.media_count > 0 && (
                      <span className="bl-chip nt">
                        {r.has_video ? "영상" : "사진"} {r.media_count}
                      </span>
                    )}
                    {/* 고쳤는데 아직 안 나갔으면 그걸 말해 준다 — 가장 답답한 지점이다 */}
                    {r.status === "resolved" && !r.shipped && (
                      <span className="bl-chip warn">배포 대기</span>
                    )}
                  </div>

                  {r.status === "resolved" && r.resolution && (
                    <div className="bl-note solved">
                      <span className="l">어떻게 고쳤나</span>
                      <p>{r.resolution.length > 110 ? `${r.resolution.slice(0, 110)}…` : r.resolution}</p>
                    </div>
                  )}
                </Link>
              </div>
            </article>
          )
        })}
      </div>

      {isAdmin && picked.size > 0 && (
        <div className="bl-bar">
          <div className="bl-barin">
            <span className="cnt">
              <em>{picked.size}건</em> 골랐습니다
            </span>
            <button type="button" className="bl-btn line" style={{ width: "auto", margin: 0, padding: "9px 13px" }} onClick={() => setPicked(new Set())}>
              해제
            </button>
            <button type="button" className="go" onClick={send} disabled={pending}>
              {pending ? "보내는 중…" : "수정 요청하기"}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
