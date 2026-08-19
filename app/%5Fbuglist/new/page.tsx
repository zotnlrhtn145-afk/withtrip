import Link from "next/link"
import { redirect } from "next/navigation"

import { whoAmI } from "@/lib/buglist"

import { NewBugForm } from "./form"

export const dynamic = "force-dynamic"

export default async function NewBugPage() {
  const me = await whoAmI()
  if (!me) redirect("/_buglist/login")

  return (
    <div className="bl-wrap">
      <header className="bl-head">
        <div className="bl-brand">
          <Link className="bl-back" href="/_buglist" aria-label="뒤로">
            ‹
          </Link>
          <h1>버그 신고하기</h1>
        </div>
      </header>

      <NewBugForm />
    </div>
  )
}
