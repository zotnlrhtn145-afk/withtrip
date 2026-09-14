"use client"
import { useEffect, useRef } from "react"
import { placeShareAppUrl } from "@/shared/place-share"
export function SharedPlaceOpen({ token }: { token: string }) {
 const attempted = useRef<string | null>(null)
 useEffect(() => {
  if (attempted.current === token || !/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) return
  attempted.current = token
  // Some in-app browsers keep HTTPS links inside their WebView. Try the existing
  // app scheme once; leave the explicit button available if the browser blocks it.
  try { window.location.href = placeShareAppUrl(token) } catch { /* manual link remains */ }
 }, [token])
 return <main className="mx-auto flex min-h-[80dvh] max-w-sm flex-col justify-center gap-6 px-6 text-center"><img src="/design/withtrip-share-logo.png" width="64" height="64" alt="WITHTRIP" className="mx-auto rounded-2xl" /><h1 className="text-2xl font-bold">공유한 장소를 확인해 보세요</h1><p className="leading-7 text-slate-600">위드트립 앱에서 로그인하면<br />이 장소의 상세 정보를 볼 수 있어요.</p><a href={placeShareAppUrl(token)} className="rounded-2xl bg-[#ffc217] px-4 py-4 font-semibold">위드트립 앱에서 보기</a><p className="text-xs leading-5 text-slate-500">앱이 없다면 먼저 위드트립을 설치해 주세요.<br />설치하고 로그인한 뒤 이 링크를 다시 눌러 주세요.</p></main>
}
