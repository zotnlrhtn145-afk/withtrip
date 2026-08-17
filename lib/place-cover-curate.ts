/**
 * 대표 사진 고르기 — 브라우저에서 서버에 맡긴다.
 *
 * ⚠️ 구글이 주는 사진 순서는 제멋대로다. `photos[0]` 을 그냥 쓰면
 *    36층 중식당에 1층 오피스 빌딩 입구 사진이 걸린다(실제로 그랬다).
 *
 * ⚠️ **돈 안 드는 선에서만 한다.** 서버는 이미 받아 둔 사진만 보고 고르고,
 *    구글에 새로 묻지 않는다. 볼 게 모자라면 아무 표시도 안 남기고 물러나므로
 *    다음에 상세를 열 때 다시 시도된다.
 *
 * ⚠️ 부르는 자리는 **상세 화면 한 곳**이다. 그 화면이 어차피 사진 후보를
 *    캐시에 채우고 캐러셀로 사진을 내려받아 저장소에 쌓기 때문에,
 *    거기서 고르는 건 덤이다. 목록에서 부르면 아무것도 안 쌓여 있어 헛돈다.
 */
export async function curatePlaceCover(input: {
  googlePlaceId: string
  name: string
  kind: string
  subCategory?: string | null
}): Promise<string | null> {
  try {
    const res = await fetch("/api/places/cover", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [
          {
            googlePlaceId: input.googlePlaceId,
            name: input.name,
            kind: input.kind,
            subCategory: input.subCategory ?? "",
          },
        ],
      }),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { covers?: Record<string, string> }
    return data.covers?.[input.googlePlaceId] ?? null
  } catch {
    return null
  }
}
