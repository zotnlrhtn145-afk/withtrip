import { NextResponse, type NextRequest } from "next/server"

import { ADMIN_COOKIE, verifySession } from "@/lib/admin-auth"
import { updateSession } from "@/utils/supabase/middleware"

/**
 * ⚠️ 관리자 페이지는 **여기서 먼저 막는다.**
 *
 * 페이지 안에서만 확인하면, 새 화면을 하나 추가할 때 확인을 빠뜨리는 순간
 * 그 화면만 조용히 열린다. 문을 페이지마다 두지 않고 **입구 한 곳**에 둔다.
 * `/_admin` 아래 무엇이 새로 생기든 이 검사를 반드시 지나간다.
 */
async function guardAdmin(request: NextRequest): Promise<NextResponse | null> {
  const { pathname } = request.nextUrl
  if (!pathname.startsWith("/_admin")) return null

  // 로그인 화면과 로그인 처리 자체는 열려 있어야 들어올 수 있다
  if (pathname === "/_admin/login") return null

  if (await verifySession(request.cookies.get(ADMIN_COOKIE)?.value)) return null

  const to = request.nextUrl.clone()
  to.pathname = "/_admin/login"
  // ⚠️ 원래 가려던 곳을 쿼리로 넘기지 않는다. 열려 있는 화면 목록이
  //    로그인 안 한 사람에게도 드러난다.
  to.search = ""
  return NextResponse.redirect(to)
}

/**
 * 어느 화면에서 시작된 요청인지 표시를 붙인다.
 *
 * ⚠️ 이게 없으면 유료 API 비용이 **"누가 썼는지 모르는 덩어리"로만** 잡힌다.
 *    스택을 뒤져 알아내는 방법도 있지만 빌드하면 파일 이름이 사라져서 못 쓴다.
 *    요청이 들어오는 이 자리에서 한 번 적어 두는 게 확실하다.
 */
function withPathTag(request: NextRequest): NextResponse {
  const headers = new Headers(request.headers)
  headers.set("x-wt-path", request.nextUrl.pathname)
  return NextResponse.next({ request: { headers } })
}

export async function middleware(request: NextRequest) {
  const blocked = await guardAdmin(request)
  if (blocked) return blocked

  // 관리자 화면은 일반 사용자 세션과 무관하다 — 쿠키 갱신을 돌릴 필요가 없다
  if (request.nextUrl.pathname.startsWith("/_admin")) return NextResponse.next()

  // API 는 로그인 쿠키 갱신이 필요 없고, 대신 비용 표시를 붙인다
  if (request.nextUrl.pathname.startsWith("/api/")) return withPathTag(request)

  return updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Match all paths except Next.js internals and static assets.
     * (Official Supabase + Next.js matcher pattern)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
