import Link from "next/link"
import { redirect } from "next/navigation"

import { whoAmI } from "@/lib/buglist"

export const dynamic = "force-dynamic"

/**
 * 따로 가입시키지 않는다 — 이미 앱을 쓰는 사람들이라 계정이 있다.
 * 위드트립 로그인 화면을 그대로 쓰고, 끝나면 여기로 돌아온다.
 */
export default async function BugLoginPage() {
  const me = await whoAmI()
  if (me) redirect("/_buglist")

  return (
    <div className="bl-login">
      <div className="bl-login-in">
        <div className="mark">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/admin-logo.png" alt="" width={52} height={52} />
          <h2>버그 신고</h2>
          <p>
            위드트립 계정으로 들어오세요
            <br />
            따로 가입하지 않아도 됩니다
          </p>
        </div>

        <Link className="bl-btn" href="/login?next=/_buglist">
          위드트립 계정으로 로그인
        </Link>
        <p className="bl-foot">앱에서 쓰던 그 계정이 그대로 들어옵니다</p>
      </div>
    </div>
  )
}
