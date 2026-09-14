import { headers } from "next/headers"
import { notFound } from "next/navigation"
import { shareAuth, readPlaceShare } from "@/lib/place-share-server"
import { getSupabaseAdmin } from "@/lib/supabase-admin"
import { KakaoPlaceBridge } from "@/components/kakao-place-bridge"
export const dynamic = "force-dynamic"
export const metadata = { title: "장소 공유 · WITHTRIP", robots: { index: false, follow: false }, referrer: "no-referrer" }
export default async function Page({ params }: { params: Promise<{ token: string }> }) {
 const { token } = await params
 const { user } = await shareAuth(new Request("https://www.withtrip.co.kr", { headers: await headers() }))
 if (!user) return <main className="p-8">위드트립 앱의 공유 버튼에서 다시 열어 주세요.</main>
 const admin = getSupabaseAdmin()
 if (!admin) notFound()
 const { data: owned } = await admin.from("place_share_links").select("token").eq("token", token).eq("user_id", user.id).maybeSingle()
 if (!owned) notFound()
 const share = await readPlaceShare(token)
 if (!share) notFound()
 return <KakaoPlaceBridge share={share} origin={(process.env.NEXT_PUBLIC_SITE_URL || "https://www.withtrip.co.kr").replace(/\/$/, "")} />
}
