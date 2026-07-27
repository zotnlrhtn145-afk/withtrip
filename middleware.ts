import { type NextRequest } from "next/server"

import { updateSession } from "@/utils/supabase/middleware"

export async function middleware(request: NextRequest) {
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
