import Link from "next/link"

import { CONTENT_TYPE_LABEL, fetchBannedIds, fetchReports, hideKindOf } from "@/lib/admin-data"

import { banUserAction, hideAndResolveAction, resolveReportAction } from "../actions"
import { ConfirmSubmit } from "../confirm-button"
import { ago, cut } from "../format"

export const dynamic = "force-dynamic"

const TABS = [
  { key: "open", label: "처리 대기" },
  { key: "actioned", label: "조치함" },
  { key: "dismissed", label: "넘어감" },
  { key: "all", label: "전체" },
] as const

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const sp = await searchParams
  const tab = TABS.find((t) => t.key === sp.s)?.key ?? "open"

  let reports: Awaited<ReturnType<typeof fetchReports>> = []
  let banned = new Set<string>()
  let error: string | null = null
  try {
    ;[reports, banned] = await Promise.all([fetchReports(tab), fetchBannedIds()])
  } catch (e) {
    error = e instanceof Error ? e.message : "신고를 읽지 못했습니다"
  }

  return (
    <>
      <div className="wt-top">
        <div>
          <h1>신고</h1>
          <div className="wt-sub">
            사용자가 직접 넣은 신고입니다 · 오래 놔둘수록 신고한 사람이 서비스를 떠납니다
          </div>
        </div>
        <div className="wt-seg">
          {TABS.map((t) => (
            <Link key={t.key} href={`/_admin/reports?s=${t.key}`} className={t.key === tab ? "on" : ""}>
              {t.label}
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
        <h2>{reports.length}건</h2>
        <div className="cap">
          <b>가리고 처리</b>를 누르면 그 글이 앱·웹에서 안 보이게 되고 신고도 함께 닫힙니다.
          문제가 없으면 <b>넘어감</b>으로 닫으세요 — 열린 채로 두면 무엇이 남은 일인지 알 수 없게 됩니다.
        </div>

        <div className="wt-scroll">
          <table>
            <thead>
              <tr>
                <th style={{ width: 96 }}>사유</th>
                <th>신고된 내용</th>
                <th style={{ width: 130 }}>신고한 사람 → 대상</th>
                <th style={{ width: 70 }}>언제</th>
                <th style={{ width: 210 }} />
              </tr>
            </thead>
            <tbody>
              {reports.length === 0 && (
                <tr>
                  <td colSpan={5} className="wt-empty">
                    {tab === "open" ? "처리할 신고가 없습니다 👍" : "해당하는 신고가 없습니다"}
                  </td>
                </tr>
              )}
              {reports.map((r) => {
                const kind = hideKindOf(r.contentType)
                const canHide = Boolean(kind && r.contentId)
                const isBanned = r.targetId ? banned.has(r.targetId) : false
                return (
                  <tr key={r.id}>
                    <td>
                      <span className="wt-chip cr">{r.reason}</span>
                      <div className="wt-muted" style={{ fontSize: 11, marginTop: 4 }}>
                        {CONTENT_TYPE_LABEL[r.contentType] ?? r.contentType}
                      </div>
                    </td>
                    <td>
                      {/*
                        신고 당시 내용을 그대로 보여 준다 — 원본이 지워졌어도
                        무엇을 보고 신고했는지 남아 있어야 판단이 된다.
                      */}
                      <div>{cut(r.excerpt ?? "", 110) || <span className="wt-muted">(내용 없음)</span>}</div>
                      {r.detail && (
                        <div className="wt-muted" style={{ fontSize: 11, marginTop: 3 }}>
                          신고자 설명: {cut(r.detail, 70)}
                        </div>
                      )}
                      <div style={{ marginTop: 4, display: "flex", gap: 4 }}>
                        {r.hidden && <span className="wt-chip cr">가려짐</span>}
                        {r.status !== "open" && (
                          <span className="wt-chip nt">{r.status === "actioned" ? "조치함" : "넘어감"}</span>
                        )}
                      </div>
                    </td>
                    {/*
                      ⚠️ 이메일이 길면 옆 칸(언제)을 밀고 들어와서 두 값이 붙어
                         읽힌다("...@gmail.com방금"). 칸 안에서 줄바꿈시킨다.
                    */}
                    <td className="wt-muted" style={{ wordBreak: "break-all" }}>
                      {r.reporter}
                      <div style={{ marginTop: 2 }}>
                        → <b style={{ color: "var(--tx)" }}>{r.target}</b>
                      </div>
                      {/* 한 번인지 상습인지가 조치 수위를 가른다 */}
                      {r.targetReportCount > 1 && (
                        <span className="wt-chip wr" style={{ marginTop: 4 }}>
                          신고 {r.targetReportCount}회
                        </span>
                      )}
                      {isBanned && (
                        <span className="wt-chip cr" style={{ marginTop: 4 }}>
                          정지됨
                        </span>
                      )}
                    </td>
                    <td className="wt-muted">{ago(r.at)}</td>
                    <td>
                      <div style={{ display: "flex", gap: 5, justifyContent: "flex-end", flexWrap: "wrap" }}>
                        {r.status === "open" && canHide && !r.hidden && (
                          <form action={hideAndResolveAction}>
                            <input type="hidden" name="id" value={r.id} />
                            <input type="hidden" name="kind" value={kind ?? ""} />
                            <input type="hidden" name="targetId" value={r.contentId ?? ""} />
                            <input type="hidden" name="reason" value={`신고: ${r.reason}`} />
                            <button className="wt-btn pr" type="submit">
                              가리고 처리
                            </button>
                          </form>
                        )}
                        {r.status === "open" && (
                          <form action={resolveReportAction}>
                            <input type="hidden" name="id" value={r.id} />
                            <input type="hidden" name="status" value="dismissed" />
                            <button className="wt-btn" type="submit">
                              넘어감
                            </button>
                          </form>
                        )}
                        {r.status !== "open" && (
                          <form action={resolveReportAction}>
                            <input type="hidden" name="id" value={r.id} />
                            <input type="hidden" name="status" value="open" />
                            <button className="wt-btn" type="submit">
                              다시 열기
                            </button>
                          </form>
                        )}
                        {r.targetId && (
                          <form action={banUserAction}>
                            <input type="hidden" name="userId" value={r.targetId} />
                            <input type="hidden" name="unban" value={isBanned ? "1" : "0"} />
                            {isBanned ? (
                              <button className="wt-btn" type="submit">
                                정지 해제
                              </button>
                            ) : (
                              <ConfirmSubmit
                                message={`${r.target} 님의 이용을 정지할까요?\n\n로그인이 막힙니다. 쓴 글과 여행 자료는 그대로 남고, 언제든 해제할 수 있습니다.`}
                              >
                                이용 정지
                              </ConfirmSubmit>
                            )}
                          </form>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
