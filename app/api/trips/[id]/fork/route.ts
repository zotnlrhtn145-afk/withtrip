import { NextResponse } from "next/server"

import { createClient } from "@/utils/supabase/server"

/**
 * 공개 템플릿 복제.
 *
 * ⚠️ **세션이 실린 클라이언트로 RPC 를 부른다.** fork_trip 은 auth.uid() 를
 *    믿는 SECURITY DEFINER 함수라, service role 로 부르면 uid 가 없어 실패한다.
 *    복제 가능 여부(is_public)·소유자 지정·멤버 등록은 전부 함수 안에서 한다.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요해요" }, { status: 401 })
  }

  const { data, error } = await supabase.rpc("fork_trip", { p_source_trip_id: id })
  if (error) {
    const msg = /로그인|복제할 수 없는/.test(error.message) ? error.message : "복제하지 못했어요"
    return NextResponse.json({ error: msg }, { status: 400 })
  }
  return NextResponse.json({ newTripId: data })
}
