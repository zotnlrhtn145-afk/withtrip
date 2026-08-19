import Link from "next/link"

import { getSupabaseAdmin } from "@/lib/supabase-admin"

import { toggleHideAction } from "../actions"
import { when } from "../format"

export const dynamic = "force-dynamic"

const KIND_LABEL: Record<string, string> = {
  clip: "클립",
  message: "대화",
  place: "맛집",
  review: "리뷰",
}

export default async function HiddenPage() {
  const c = getSupabaseAdmin()
  const { data } = c
    ? await c.from("content_hides").select("*").order("hidden_at", { ascending: false })
    : { data: [] }

  const rows = (data ?? []) as {
    id: string
    kind: string
    target_id: string
    reason: string | null
    hidden_at: string
  }[]

  return (
    <>
      <div className="wt-top">
        <div>
          <h1>가린 글</h1>
          <div className="wt-sub">앱·웹에서 안 보이지만 원본은 남아 있습니다</div>
        </div>
        <Link className="wt-btn" href="/_admin/content">
          글 관리로 →
        </Link>
      </div>

      <div className="wt-card">
        <h2>{rows.length}건</h2>
        <div className="cap">
          &lsquo;되돌리기&rsquo;를 누르면 곧바로 다시 보입니다. 무엇을 왜 가렸는지 남겨 두면 나중에 기준을 잡기 쉽습니다.
        </div>
        <table>
          <thead>
            <tr>
              <th style={{ width: 58 }}>종류</th>
              <th>대상</th>
              <th style={{ width: 150 }}>사유</th>
              <th style={{ width: 120 }}>가린 때</th>
              <th style={{ width: 84 }} />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="wt-empty">
                  가린 글이 없습니다
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <span className="wt-chip nt">{KIND_LABEL[r.kind] ?? r.kind}</span>
                </td>
                <td className="wt-muted" style={{ fontSize: 11, fontFamily: "ui-monospace, monospace" }}>
                  {r.target_id}
                </td>
                <td className="wt-muted">{r.reason ?? "-"}</td>
                <td className="wt-muted">{when(r.hidden_at)}</td>
                <td className="wt-num">
                  <form action={toggleHideAction}>
                    <input type="hidden" name="kind" value={r.kind} />
                    <input type="hidden" name="id" value={r.target_id} />
                    <input type="hidden" name="hidden" value="1" />
                    <button className="wt-btn" type="submit">
                      되돌리기
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
