"use client"
import { useEffect, useRef, useState } from "react"
import { ensureKakaoReady } from "@/lib/kakao-share"
import { kakaoPlaceFeed, type PlaceShare } from "@/shared/place-share"
import { PlaceShareCard } from "./place-share-card"
export function KakaoPlaceBridge({ share, origin }: { share: PlaceShare; origin: string }) {
 const handoff = useRef(false)
 const left = useRef(false)
 useEffect(() => {
  const leave = () => { if (handoff.current) left.current = true }
  const resume = () => {
   if (!handoff.current || !left.current || document.hidden) return
   handoff.current = false
   const requested = new URLSearchParams(window.location.search).get("returnTo")
   let path = "/saved"
   try { const target = new URL(requested || path, window.location.origin); if (target.origin === window.location.origin && !target.pathname.startsWith("/share/")) path = target.pathname + target.search } catch {}
   window.location.replace(path)
  }
  const visibility = () => { if (document.hidden) leave(); else resume() }
  window.addEventListener("blur", leave); window.addEventListener("focus", resume); document.addEventListener("visibilitychange", visibility)
  return () => { window.removeEventListener("blur", leave); window.removeEventListener("focus", resume); document.removeEventListener("visibilitychange", visibility) }
 }, [])
 const [ready, setReady] = useState(false)
 const [error, setError] = useState("")
 useEffect(() => { let active = true; void ensureKakaoReady().then(k => { if (!active) return; setReady(!!k); if (!k) setError("카카오톡 공유 연결을 준비하지 못했어요. 잠시 후 다시 시도해 주세요.") }); return () => { active = false } }, [])
 return <main className="mx-auto max-w-sm space-y-5 px-6 py-6"><PlaceShareCard share={share} /><button disabled={!ready} className="min-h-12 w-full rounded-2xl bg-[#ffc217] font-semibold disabled:opacity-50" onClick={() => { try { if (!window.Kakao) return; handoff.current = true; left.current = false; window.Kakao.Share.sendDefault(kakaoPlaceFeed(share, origin)) } catch { handoff.current = false; setError("카카오톡을 열지 못했어요. 다시 눌러 주세요.") } }}>카카오톡으로 보내기</button><p role="status" className="text-sm text-slate-600">{error || "대화방 선택과 전송은 카카오톡에서 진행해 주세요."}</p></main>
}
