/**
 * 쓸 수 있는 Gemini 모델을 **직접 물어봐서** 고른다.
 *
 * ⚠️ 모델 이름을 코드에 박아 두면 조용히 죽는다.
 *    실측(2026-08): `gemini-2.0-flash` 와 `gemini-1.5-flash-latest` 는 이 계정에서
 *    HTTP 404 다. 폴백이라고 적어 뒀지만 **둘 다 존재하지 않는 모델**이었고,
 *    그래서 첫 모델이 503(과부하)을 내면 그대로 "장소를 찾지 못했어요" 가 됐다.
 *    같은 함정에 도시 커버 생성에서도 한 번 빠진 적이 있다.
 *
 * 목록은 람다가 살아 있는 동안 재사용한다 — 매 요청마다 물어볼 이유가 없다.
 */

type GeminiModel = { name?: string; supportedGenerationMethods?: string[] };

let cached: string[] | null = null;

/** 안정판을 앞에, 실험·프리뷰·라이트를 뒤로. */
function stability(name: string): number {
  return /(exp|preview|thinking|lite)/.test(name) ? 1 : 0;
}

export async function flashModelCandidates(apiKey: string): Promise<string[]> {
  if (cached) return cached;
  try {
    const res = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models",
      {
        headers: { "x-goog-api-key": apiKey },
      },
    );
    if (!res.ok) return [];
    const d = (await res.json()) as { models?: GeminiModel[] };
    const names = (d.models ?? [])
      .filter((m) =>
        (m.supportedGenerationMethods ?? []).includes("generateContent"),
      )
      .map((m) => String(m.name ?? "").replace(/^models\//, ""))
      .filter((n) => n.includes("flash") && !/image/i.test(n))
      .sort((a, b) => stability(a) - stability(b))
      .slice(0, 4);
    if (names.length) cached = names;
    return names;
  } catch {
    return [];
  }
}

/**
 * 과부하(503)·속도 제한(429)은 **잠깐 기다렸다 같은 모델에 다시 물으면** 대개 통한다.
 * 다른 모델로 바로 넘어가면 더 나쁜 모델을 쓰게 되므로 한 번은 제자리에서 기다린다.
 */
export function isTransient(status: number): boolean {
  return status === 429 || status === 500 || status === 503;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
