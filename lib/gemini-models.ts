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

/**
 * 이름만 flash 일 뿐 우리 용도에 못 쓰는 것들.
 *
 * ⚠️ 실측: 목록에 `gemini-3.7-flash-video-understanding-eap` 가 딸려 왔고
 *    이게 앞에 서면서 한 번에 19.9초가 걸렸다(평소 3.7초).
 *    영상 이해·음성·임베딩 전용은 애초에 후보에서 뺀다.
 */
function isUsable(name: string): boolean {
  return !/(image|video|audio|tts|embedding|vision|eap)/i.test(name);
}

/**
 * 빠르고 안정적인 순서.
 *
 * `-latest` 는 구글이 밀어 주는 안정판이라 가장 먼저 본다(실측 1.5~2.3초).
 * 실험·프리뷰·라이트는 뒤로 미룬다.
 */
function rank(name: string): number {
  if (/flash-latest$/.test(name)) return 0;
  if (/(exp|preview|thinking|lite)/.test(name)) return 2;
  return 1;
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
      .filter((n) => n.includes("flash") && isUsable(n))
      .sort((a, b) => rank(a) - rank(b))
      .slice(0, 3);
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
