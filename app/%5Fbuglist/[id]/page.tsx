import Link from "next/link"
import { notFound, redirect } from "next/navigation"

import { getBug, whoAmI } from "@/lib/buglist"

import { addNoteAction, deleteOwnBugAction, editBugAction, unqueueAction, wontfixAction } from "../actions"
import { OwnerTools } from "./owner-tools"

export const dynamic = "force-dynamic"

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

function stamp(iso: string): string {
  const d = new Date(new Date(iso).getTime() + 9 * 3600_000)
  const hm = `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 ${hm}`
}

export default async function BugDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await whoAmI()
  if (!me) redirect("/_buglist/login")

  const { id } = await params
  const bug = await getBug(id)
  if (!bug) notFound()

  const done = bug.status === "resolved" || bug.status === "wontfix"

  return (
    <div className="bl-wrap">
      <header className="bl-head">
        <div className="bl-brand">
          <Link className="bl-back" href="/_buglist" aria-label="뒤로">
            ‹
          </Link>
          <h1>신고 상세</h1>
        </div>
      </header>

      <div style={{ paddingTop: 14 }}>
        <div className="bl-tags">
          {!done && <span className={`bl-chip ${SEV_CHIP[bug.severity]}`}>{SEV_LABEL[bug.severity]}</span>}
          <span className="bl-chip plat">{PLAT_LABEL[bug.platform]}</span>
          <span className={`bl-chip ${done ? "ok" : "nt"}`}>{STATUS_LABEL[bug.status]}</span>
          {bug.status === "resolved" && !bug.shipped && <span className="bl-chip warn">배포 대기</span>}
        </div>

        <h2
          style={{
            margin: "9px 0 4px",
            fontSize: 19,
            fontWeight: 800,
            letterSpacing: "-.3px",
            lineHeight: 1.35,
            ...(done
              ? {
                  color: "var(--ok)",
                  textDecoration: "line-through",
                  textDecorationColor: "color-mix(in srgb, var(--ok) 45%, transparent)",
                }
              : {}),
          }}
        >
          {bug.title}
        </h2>

        <div className="bl-meta">
          {[bug.reporter_name, bug.device, bug.os_version, bug.app_version].filter(Boolean).join(" · ")}
          {" · "}
          {stamp(bug.created_at)}
        </div>

        {bug.body && (
          <p style={{ fontSize: 14, color: "var(--tx-2)", margin: "12px 0 0", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
            {bug.body}
          </p>
        )}

        {/* 첨부 — 눌러서 크게 본다 */}
        {bug.media.length > 0 && (
          <div className="bl-thumbs" style={{ marginTop: 12 }}>
            {bug.media.map((m) =>
              m.url ? (
                <a
                  key={m.id}
                  className="bl-th"
                  style={{ width: 68, height: 86 }}
                  href={m.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {m.kind === "video" ? (
                    <>
                      <video src={m.url} muted playsInline preload="metadata" />
                      <span className="pl">▶</span>
                    </>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.url} alt="첨부" />
                  )}
                </a>
              ) : (
                <span key={m.id} className="bl-th gone" style={{ width: 68, height: 86 }}>
                  정리됨
                </span>
              )
            )}
          </div>
        )}

        {/* ── 쌓인 메모 ── */}
        {bug.notes.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <span className="bl-lbl">덧붙인 메모 {bug.notes.length}</span>
            {bug.notes.map((n) => (
              <div className="bl-note memo" key={n.id}>
                <span className="l">
                  {n.author} · {stamp(n.created_at)}
                </span>
                <p>{n.body}</p>
              </div>
            ))}
          </div>
        )}

        {/* ── 처리 결과 ── */}
        {bug.resolution && (
          <div className="bl-note solved" style={{ marginTop: 14 }}>
            <span className="l">어떻게 고쳤나</span>
            <p>{bug.resolution}</p>
          </div>
        )}
        {bug.verification && (
          <div className="bl-note solved" style={{ borderStyle: "solid" }}>
            <span className="l">확인한 방법</span>
            <p>{bug.verification}</p>
          </div>
        )}
        {bug.status === "resolved" && (
          <div className="bl-auto">
            {bug.shipped ? (
              <>
                <b>배포됨</b> · 최신 버전에서 확인하실 수 있습니다
              </>
            ) : (
              <>
                <b>다음 빌드에 포함</b> · 고쳐 두었고 아직 배포 전입니다
              </>
            )}
          </div>
        )}

        {bug.queue?.state === "failed" && bug.queue.error && (
          <div className="bl-err">자동 처리가 막혔습니다: {bug.queue.error}</div>
        )}

        {/*
          ⚠️ 내 글이면 고치고 지울 수 있다. 남의 글에는 이 단추가 아예 없다 —
             숨기는 게 아니라 DB 정책이 막으므로 주소를 두드려도 안 된다.
             이미 고쳐진 글은 손대지 못하게 한다(처리 내용과 어긋난다).
        */}
        {bug.reporter_id === me.id && !done && (
          <OwnerTools id={bug.id} body={bug.body ?? ""} editAction={editBugAction} deleteAction={deleteOwnBugAction} />
        )}

        {/* ── 관리자 전용 ── */}
        {me.isAdmin && (
          <>
            <form action={addNoteAction} className="bl-fld">
              <input type="hidden" name="id" value={bug.id} />
              <label className="bl-lbl" htmlFor="note">
                메모 더 남기기
              </label>
              <textarea
                id="note"
                name="body"
                required
                maxLength={4000}
                placeholder={"글이 부족하면 여기에 보태 주세요.\n적은 내용은 이 신고글에 계속 따라붙습니다."}
              />
              <button className="bl-btn ink" type="submit">
                메모 남기기
              </button>
              <p className="bl-foot" style={{ textAlign: "left", marginTop: 8 }}>
                메모만 저장됩니다. <b>수정 요청은 목록에서 체크</b>해서 보냅니다 — 여기서 실수로 나가지 않게.
              </p>
            </form>

            <div style={{ marginTop: 18, display: "flex", gap: 8, flexWrap: "wrap" }}>
              {bug.status === "queued" && (
                <form action={unqueueAction} style={{ flex: "1 1 46%" }}>
                  <input type="hidden" name="id" value={bug.id} />
                  <button className="bl-btn line" type="submit" style={{ marginTop: 0 }}>
                    대기열에서 빼기
                  </button>
                </form>
              )}
              {!done && (
                <form action={wontfixAction} style={{ flex: "1 1 46%" }}>
                  <input type="hidden" name="id" value={bug.id} />
                  <button className="bl-btn line" type="submit" style={{ marginTop: 0 }}>
                    안 고치기로
                  </button>
                </form>
              )}
            </div>
          </>
        )}
      </div>

      {/* 어느 화면에서든 바로 새 신고를 쓸 수 있게 */}
      <Link className="bl-fab" href="/_buglist/new">
        ＋ 신고하기
      </Link>
    </div>
  )
}
