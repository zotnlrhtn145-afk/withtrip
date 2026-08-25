import { NextResponse } from "next/server"

import { getSupabaseAdmin } from "@/lib/supabase-admin"
import { flashModelCandidates, isBillingProblem, rememberModel, TEXT_PURPOSE } from "@/lib/gemini-models"
import {
  KIND_LABEL,
  SUBCATEGORIES_BY_KIND,
  guessFromName,
  type WishlistKind,
} from "@/shared/place-subcategories"

/**
 * 분류가 빈 장소를 **묶어서** 채운다.
 *
 * ⚠️ **한 건씩 부르면 안 된다.** 96곳이면 96번이고 그만큼 돈이다.
 *    한 번에 20곳을 한 프롬프트에 담으면 **호출 5번**으로 끝난다.
 *
 * ⚠️ AI 에게 **지금 쓰는 목록을 같이 준다.** 안 그러면 매번 새 이름을 지어서
 *    「라멘」이 이미 있는데 「돈코츠라멘」을 만든다. 태그가 마구 늘어나는 걸
 *    막는 가장 효과 큰 장치다.
 *
 * ⚠️ 결과는 **가게(`places`)에 저장**하고, 그 가게를 찜한 모든 사람에게 함께
 *    반영한다. 500명이 찜한 곳이면 비용이 1/500 이 된다.
 *
 * ⚠️ 이름 규칙으로 풀리는 건 **AI 를 아예 안 부른다.** 규칙은 공짜다.
 *
 * 관리자만 부를 수 있다(`x-admin-secret`).
 */
export const maxDuration = 60

type Row = { id: string; place_name: string | null; address: string | null; category: string | null; google_place_id: string | null }

const VAGUE = new Set(["", "기타", "null", "레스토랑 · 다이닝", "라운지 · 바", "호텔 · 숙박"])

export async function POST(req: Request) {
  const secret = process.env.ADMIN_SESSION_SECRET ?? ""
  if (!secret || req.headers.get("x-admin-secret") !== secret) {
    return NextResponse.json({ error: "관리자만 쓸 수 있습니다." }, { status: 403 })
  }
  const db = getSupabaseAdmin()
  if (!db) return NextResponse.json({ error: "서버 키가 없습니다." }, { status: 500 })

  const body = (await req.json().catch(() => ({}))) as { limit?: number }
  const limit = Math.min(20, Math.max(1, Number(body.limit ?? 20)))

  // 중분류가 비었거나 뭉뚱그린 것만
  const { data } = await db
    .from("saved_places")
    .select("id, place_name, address, category, sub_category, google_place_id")
    .limit(600)
  const targets = ((data as (Row & { sub_category: string | null })[]) ?? []).filter(
    (r) => VAGUE.has(String(r.sub_category ?? "")) && (r.place_name ?? "").trim()
  )
  if (targets.length === 0) return NextResponse.json({ done: true, left: 0, filled: 0 })

  /*
    ⚠️ 같은 가게가 여러 사람 찜에 있으면 **한 번만 묻는다.** 이름으로 묶는다
       (구글 id 가 없는 곳이 많아서 id 로만 묶으면 절반을 놓친다).
  */
  const byName = new Map<string, (Row & { sub_category: string | null })[]>()
  for (const r of targets) {
    const k = (r.place_name ?? "").trim().toLowerCase()
    byName.set(k, [...(byName.get(k) ?? []), r])
  }
  const uniq = [...byName.entries()].slice(0, limit)

  const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY
  if (!apiKey) return NextResponse.json({ error: "AI 키가 없습니다." }, { status: 500 })
  const models = await flashModelCandidates(apiKey)
  if (models.length === 0) return NextResponse.json({ error: "모델 목록을 못 받았습니다." }, { status: 503 })

  // 지금 쓰는 소분류를 모아 AI 에게 보여 준다 (새 이름 남발 방지)
  const { data: tagRows } = await db.from("place_tags").select("name").limit(300)
  const known = [...new Set(((tagRows as { name: string }[]) ?? []).map((t) => t.name))]

  const list = uniq
    .map(([, rs], i) => `${i + 1}. ${rs[0].place_name} / ${rs[0].address ?? "주소 없음"}`)
    .join("\n")
  const kinds = (Object.keys(KIND_LABEL) as WishlistKind[]).map((k) => `${k}=${KIND_LABEL[k]}`).join(", ")
  const subs = (Object.keys(SUBCATEGORIES_BY_KIND) as WishlistKind[])
    .map((k) => `${k}: ${SUBCATEGORIES_BY_KIND[k].join("·")}`)
    .join("\n")

  const prompt =
    `아래 장소들을 분류해라. 이름과 주소만 보고 판단한다.\n\n${list}\n\n` +
    `대분류(kind)는 반드시 이 중 하나: ${kinds}\n` +
    `중분류(sub)는 그 대분류의 목록에서만 고른다:\n${subs}\n\n` +
    (known.length
      ? `소분류(detail)는 아래 중에 맞는 게 있으면 반드시 그걸 써라. 정말 없을 때만 새로 지어라.\n${known.join(", ")}\n\n`
      : `소분류(detail)는 "족발·보쌈", "라멘" 처럼 짧은 말로.\n\n`) +
    `모르면 sub 를 "기타" 로 두고 지어내지 마라.\n` +
    `{"items":[{"n":1,"kind":"restaurant","sub":"한식","detail":"국밥·해장"}]} 형태의 JSON 으로만 답하라.`

  let parsed: { n: number; kind: string; sub: string; detail?: string }[] = []
  let lastError = ""
  for (const model of models) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json" },
          }),
        }
      )
      if (!res.ok) {
        const t = await res.text()
        lastError = `[${model}] ${res.status}`
        if (isBillingProblem(res.status, t)) {
          return NextResponse.json({ error: "AI 크레딧이 부족합니다.", reason: t.slice(0, 200) }, { status: 503 })
        }
        continue
      }
      const j = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] }
      const raw = (j.candidates?.[0]?.content?.parts?.[0]?.text ?? "").replace(/```json|```/g, "").trim()
      const obj = JSON.parse(raw) as { items?: typeof parsed }
      parsed = obj.items ?? []
      if (parsed.length > 0) {
        await rememberModel(TEXT_PURPOSE, model)
        break
      }
    } catch (e) {
      lastError = e instanceof Error ? e.message.slice(0, 80) : "오류"
    }
  }
  if (parsed.length === 0) {
    return NextResponse.json({ error: "AI 응답을 읽지 못했습니다.", reason: lastError }, { status: 502 })
  }

  let filled = 0
  const changes: string[] = []
  for (const it of parsed) {
    const entry = uniq[Number(it.n) - 1]
    if (!entry) continue
    const [, rows] = entry
    const kind = (it.kind ?? "") as WishlistKind
    const label = KIND_LABEL[kind]
    if (!label) continue
    const allowed = SUBCATEGORIES_BY_KIND[kind] ?? []
    const sub = allowed.includes(it.sub) ? it.sub : "기타"
    // ⚠️ "기타" 로 온 건 저장하지 않는다 — 모른다는 뜻이고, 덮어써 봐야 그대로다
    if (sub === "기타") continue
    const detail = String(it.detail ?? "").trim().slice(0, 24) || null

    const patch: Record<string, unknown> = {
      category: label,
      sub_category: sub,
      category_source: "ai",
      category_confidence: 0.75,
    }
    if (detail) patch.detail_category = detail

    for (const r of rows) {
      await db.from("saved_places").update(patch).eq("id", r.id)
      filled++
    }
    // 가게 캐시에도 남긴다 — 다음 사람은 공짜로 얻는다
    const gid = rows.find((r) => r.google_place_id)?.google_place_id
    if (gid) {
      await db.from("places").update({ category: kind, sub_category: sub, detail_category: detail, category_source: "ai" }).eq("google_place_id", gid)
    }
    if (detail) await db.rpc("use_place_tag", { p_name: detail, p_sub: sub })
    changes.push(`${rows[0].place_name} → ${label}/${sub}${detail ? "/" + detail : ""}`)
  }

  return NextResponse.json({ filled, left: Math.max(0, byName.size - uniq.length), changes })
}
