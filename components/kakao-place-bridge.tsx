"use client"
import { useEffect, useState } from "react"
import { ensureKakaoReady } from "@/lib/kakao-share"
import { kakaoPlaceFeed, type PlaceShare } from "@/shared/place-share"
import { PlaceShareCard } from "./place-share-card"
export function KakaoPlaceBridge({ share, origin }: { share: PlaceShare; origin: string }) {
 const [ready, setReady] = useState(false)
 const [error, setError] = useState("")
 useEffect(() => { let active = true; void ensureKakaoReady().then(k => { if (!active) return; setReady(!!k); if (!k) setError("카카오톡 공유 연결을 준비하지 못했어요. 잠시 후 다시 시도해 주세요.") }); return () => { active = false } }, [])
 return <main className="mx-auto max-w-sm space-y-5 px-6 py-6"><PlaceShareCard share={share} /><button disabled={!ready} className="min-h-12 w-full rounded-2xl bg-[#ffc217] font-semibold disabled:opacity-50" onClick={() => { try { window.Kakao?.Share.sendDefault(kakaoPlaceFeed(share, origin)) } catch { setError("카카오톡을 열지 못했어요. 다시 눌러 주세요.") } }}>카카오톡으로 보내기</button><p role="status" className="text-sm text-slate-600">{error || "대화방 선택과 전송은 카카오톡에서 진행해 주세요."}</p></main>
}
