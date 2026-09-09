import { randomBytes } from "node:crypto"

import { NextResponse } from "next/server"

import { getSupabaseAdmin } from "@/lib/supabase-admin"
import { createClient } from "@/utils/supabase/server"

/**
 * 카톡 공유 링크 발급 — **누를 때 만든다.**
 *
 * ⚠️ share_token 에 DB 기본값을 두지 않는 이유: 공유한 적 없는 여행에
 *    열쇠가 미리 존재하면 그 자체가 공격 표면이다. 멤버가 공유 버튼을
 *    누른 순간에만 생긴다. 한 번 만들면 재사용한다(링크가 바뀌면 곤란).
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const admin = getSupabaseAdmin()
  if (!admin) return NextResponse.json({ error: "서버 설정 오류" }, { status: 500 })

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "로그인이 필요해요" }, { status: 401 })

  // 멤버(또는 주인)만 공유 링크를 만들 수 있다
  const { data: trip } = await admin.from("trips").select("id, user_id, share_token").eq("id", id).maybeSingle()
  if (!trip) return NextResponse.json({ error: "여행을 찾을 수 없어요" }, { status: 404 })
  if (trip.user_id !== user.id) {
    const { data: member } = await admin
      .from("trip_members")
      .select("id")
      .eq("trip_id", id)
      .eq("user_id", user.id)
      .maybeSingle()
    if (!member) return NextResponse.json({ error: "여행 멤버만 공유할 수 있어요" }, { status: 403 })
  }

  let token = trip.share_token as string | null
  if (!token) {
    token = randomBytes(16).toString("hex")
    const { error } = await admin.from("trips").update({ share_token: token }).eq("id", id)
    if (error) return NextResponse.json({ error: "링크를 만들지 못했어요" }, { status: 500 })
  }
  return NextResponse.json({ url: `/share/${token}` })
}
