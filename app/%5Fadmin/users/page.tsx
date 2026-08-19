import { fetchSubscribers } from "@/lib/admin-data"

import { ago, when } from "../format"

export const dynamic = "force-dynamic"

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const sp = await searchParams
  const q = (sp.q ?? "").trim().toLowerCase()

  let users: Awaited<ReturnType<typeof fetchSubscribers>> = []
  let error: string | null = null
  try {
    users = await fetchSubscribers()
  } catch (e) {
    error = e instanceof Error ? e.message : "가입자를 읽지 못했습니다"
  }

  const rows = q
    ? users.filter((u) => (u.email ?? "").toLowerCase().includes(q) || (u.nickname ?? "").toLowerCase().includes(q))
    : users

  const active30 = users.filter(
    (u) => u.last_sign_in_at && Date.now() - new Date(u.last_sign_in_at).getTime() < 30 * 86_400_000
  ).length
  const leaving = users.filter((u) => u.deletion_requested_at).length

  return (
    <>
      <div className="wt-top">
        <div>
          <h1>가입자</h1>
          <div className="wt-sub">{users.length.toLocaleString("ko-KR")}명 · 최근 가입 순</div>
        </div>
        <form style={{ width: 220 }}>
          <input name="q" type="text" placeholder="이메일·별명으로 찾기" defaultValue={sp.q ?? ""} aria-label="검색" />
        </form>
      </div>

      {error && (
        <div className="wt-card" style={{ marginBottom: 12 }}>
          <p style={{ margin: 0, fontSize: 13, color: "var(--crit)" }}>{error}</p>
        </div>
      )}

      <section className="wt-tiles">
        <div className="wt-tile accent">
          <div className="k">전체 가입자</div>
          <div className="v">{users.length.toLocaleString("ko-KR")}</div>
        </div>
        <div className="wt-tile">
          <div className="k">최근 30일 접속</div>
          <div className="v">{active30.toLocaleString("ko-KR")}</div>
          <div className="d">
            전체의 {users.length ? Math.round((active30 / users.length) * 100) : 0}%
          </div>
        </div>
        <div className="wt-tile">
          <div className="k">최근 30일 가입</div>
          <div className="v">
            {users.filter((u) => Date.now() - new Date(u.created_at).getTime() < 30 * 86_400_000).length}
          </div>
        </div>
        <div className="wt-tile">
          <div className="k">탈퇴 요청</div>
          <div className="v" style={leaving > 0 ? { color: "var(--crit)" } : undefined}>
            {leaving}
          </div>
          <div className="d">{leaving > 0 ? "처리가 필요합니다" : "없습니다"}</div>
        </div>
      </section>

      <section className="wt-card">
        <h2>목록</h2>
        <div className="cap">
          쓴 것이 많은 사람이 실제로 쓰는 사람입니다 — 여행·장소·리뷰 수를 같이 봅니다.
        </div>
        <div className="wt-scroll">
          <table>
            <thead>
              <tr>
                <th>사용자</th>
                <th>가입</th>
                <th>마지막 접속</th>
                <th>로그인 방식</th>
                <th className="wt-num">여행</th>
                <th className="wt-num">장소</th>
                <th className="wt-num">리뷰</th>
                <th>상태</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="wt-empty">
                    {q ? "찾는 사람이 없습니다" : "가입자가 없습니다"}
                  </td>
                </tr>
              )}
              {rows.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {u.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={u.avatar_url}
                          alt=""
                          width={24}
                          height={24}
                          style={{ borderRadius: "50%", objectFit: "cover", flex: "none" }}
                        />
                      ) : (
                        <span
                          aria-hidden
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: "50%",
                            background: "var(--bar-soft)",
                            flex: "none",
                          }}
                        />
                      )}
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600 }}>{u.nickname ?? "별명 없음"}</div>
                        <div
                          className="wt-muted"
                          style={{ fontSize: 11, overflow: "hidden", textOverflow: "ellipsis" }}
                        >
                          {u.email ?? "-"}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="wt-muted">{when(u.created_at)}</td>
                  <td className="wt-muted">{ago(u.last_sign_in_at)}</td>
                  <td className="wt-muted">{u.provider ?? "-"}</td>
                  <td className="wt-num">{u.trips || "-"}</td>
                  <td className="wt-num">{u.places || "-"}</td>
                  <td className="wt-num">{u.reviews || "-"}</td>
                  <td>
                    {u.deletion_requested_at ? (
                      <span className="wt-chip cr">탈퇴 요청</span>
                    ) : u.last_sign_in_at && Date.now() - new Date(u.last_sign_in_at).getTime() < 7 * 86_400_000 ? (
                      <span className="wt-chip ok">활동 중</span>
                    ) : (
                      <span className="wt-chip nt">조용함</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}
