import { NextResponse } from "next/server"

import { classifySubCategories } from "@/lib/classify-subcategory-server"
import { checkRateLimit } from "@/lib/rate-limit"

export const runtime = "nodejs"

/**
 * 이름·주소만으로 정규식이 못 잡는 경우(유명 체인점 등)를 Gemini 상식으로 보정한다.
 * 예: "이치란" 은 이름에 "라멘" 이 없어도 라멘 전문점으로 알려져 있다.
 *
 * ⚠️ **판단은 여기 없다.** 목록·프롬프트·모델 고르기는 전부
 *    `lib/classify-subcategory-server.ts` 한 곳에 있다. 예전엔 이 라우트가
 *    직접 다 하고 있었고, 인스타 공유 쪽은 그 길을 안 거쳐서 **같은 가게가
 *    들어온 문에 따라 다르게 분류**됐다(인스타 11% vs 직접 등록 1.2% 가 기타).
 */
export async function POST(req: Request) {
  // 인증이 없는 라우트다 — 반복 호출로 AI 비용이 새지 않게 막는다
  const limited = await checkRateLimit(req, "cheap", "classify-subcategory")
  if (limited) return limited

  try {
    const body = (await req.json()) as {
      kind?: string
      placeName?: string
      localName?: string
      address?: string
    }
    const kind = body.kind === "bar" || body.kind === "stay" ? body.kind : "restaurant"
    const placeName = String(body.placeName ?? "").trim()
    if (!placeName) return NextResponse.json({ subCategory: null })

    const out = await classifySubCategories([
      { key: "one", kind, placeName, localName: body.localName, address: body.address },
    ])
    return NextResponse.json({ subCategory: out.get("one") ?? null })
  } catch (error: unknown) {
    console.error("[classify-subcategory] error:", error)
    return NextResponse.json({ subCategory: null }, { status: 200 })
  }
}
