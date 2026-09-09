import { ImageResponse } from "next/og"

import { fetchTemplateBySlug } from "@/lib/templates-api"
import { slugIdPart } from "@/shared/trip-templates"

/**
 * 카톡·SNS 미리보기 카드 — 링크가 이 이미지로 펼쳐진다. 클릭률을 이게 정한다.
 *
 * ⚠️ 한글 폰트를 심어야 한다 — 안 심으면 □□□ 로 깨진다.
 * ⚠️ 제목·기간·도시까지만. 상세 일정은 안 싣는다(카톡 서버에 캐시가 남는다).
 */
export const runtime = "nodejs"
export const alt = "위드트립 여행 일정 템플릿"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

let fontCache: ArrayBuffer | null = null
async function loadFont(): Promise<ArrayBuffer | null> {
  if (fontCache) return fontCache
  try {
    // woff(v1) — satori 는 woff2 를 못 읽는다
    const res = await fetch(
      "https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-kr@5.0.13/files/noto-sans-kr-korean-700-normal.woff",
      { cache: "force-cache" }
    )
    if (!res.ok) return null
    fontCache = await res.arrayBuffer()
    return fontCache
  } catch {
    return null
  }
}

export default async function OgImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const decoded = decodeURIComponent(slug)
  const trip = slugIdPart(decoded) ? await fetchTemplateBySlug(decoded) : null
  const font = await loadFont()

  const title = trip?.title ?? `${decoded} 여행 일정`
  const sub = trip
    ? [trip.city, trip.duration, `일정 ${trip.stopCount}곳`].filter(Boolean).join(" · ")
    : "복제해서 시작하는 여행 일정"
  const themes = trip?.themes.map((t) => `${t.emoji} ${t.label}`).join("   ") ?? ""

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          padding: 64,
          background: "linear-gradient(150deg, #1b1a17 0%, #3d2f14 78%, #7c5b06 130%)",
          fontFamily: "NotoSansKR",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            right: -120,
            top: -120,
            width: 460,
            height: 460,
            borderRadius: 230,
            background: "radial-gradient(circle, rgba(251,191,36,.42), rgba(251,191,36,0) 70%)",
          }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 14, position: "absolute", top: 56, left: 64 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              background: "#fbbf24",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 26,
            }}
          >
            ✈️
          </div>
          <div style={{ fontSize: 30, fontWeight: 700, color: "#fcd34d", letterSpacing: 2 }}>WITHTRIP</div>
        </div>
        {themes ? <div style={{ fontSize: 30, color: "#d6d3d1", marginBottom: 18 }}>{themes}</div> : null}
        <div style={{ fontSize: 72, fontWeight: 700, color: "#ffffff", lineHeight: 1.15, letterSpacing: -1.5 }}>
          {title.length > 24 ? title.slice(0, 24) + "…" : title}
        </div>
        <div style={{ fontSize: 34, color: "#e7e5e4", marginTop: 18 }}>{sub}</div>
        <div style={{ fontSize: 26, color: "#a8a29e", marginTop: 30 }}>복제해서 바로 내 여행으로 — withtrip.app</div>
      </div>
    ),
    {
      ...size,
      fonts: font ? [{ name: "NotoSansKR", data: font, weight: 700 as const, style: "normal" as const }] : undefined,
    }
  )
}
