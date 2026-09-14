import { notFound } from "next/navigation"
import { validShareToken } from "@/shared/place-share"
import { SharedPlaceOpen } from "@/components/shared-place-open"
export const metadata = { title: "공유한 장소 · WITHTRIP", robots: { index: false, follow: false }, referrer: "no-referrer" }
export default async function Page({ params }: { params: Promise<{ token: string }> }) {
 const { token } = await params
 if (!validShareToken(token)) notFound()
 return <SharedPlaceOpen token={token} />
}
