"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"

import { logoutAction } from "./actions"

type Item = { href: string; icon: string; label: string; count?: number; hot?: boolean }

/** 사이드바. 지금 보고 있는 곳에 호박색 선이 붙는다. */
export function AdminNav({
  groups,
}: {
  groups: { label: string; items: Item[] }[]
}) {
  const pathname = usePathname()
  const params = useSearchParams()
  /*
    글 관리는 종류별로 따로 걸려 있다(`?kind=message`). 주소만 보면
    셋 다 같은 `/_admin/content` 라서, **물음표 뒤까지 같이 봐야** 지금 보고 있는
    항목에만 불이 들어온다.
  */
  const kind = params.get("kind") ?? ""

  const isOn = (href: string) => {
    if (href === "/_admin") return pathname === "/_admin"
    const [base, query] = href.split("?")
    if (!pathname.startsWith(base)) return false
    const want = new URLSearchParams(query ?? "").get("kind") ?? ""
    return want === kind
  }

  return (
    <aside className="wt-side">
      <div className="wt-brand">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/admin-logo.png" alt="위드트립" width={26} height={26} />
        <div>
          <b>위드트립 관리자</b>
          <span>Admin</span>
        </div>
      </div>

      {groups.map((g) => (
        <div key={g.label}>
          <div className="wt-navlabel">{g.label}</div>
          {g.items.map((it) => {
            const on = isOn(it.href)
            return (
              <Link key={it.href} href={it.href} className={`wt-nav${on ? " on" : ""}`}>
                <span className="ic" aria-hidden>
                  {it.icon}
                </span>
                {it.label}
                {it.count !== undefined && (
                  <span className={`cnt${it.hot ? " hot" : ""}`}>{it.count.toLocaleString("ko-KR")}</span>
                )}
              </Link>
            )
          })}
        </div>
      ))}

      <div className="foot">
        admin 으로 로그인됨
        <form action={logoutAction}>
          <button type="submit">로그아웃</button>
        </form>
      </div>
    </aside>
  )
}
