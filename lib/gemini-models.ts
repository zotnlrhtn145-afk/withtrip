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
 * 구글이 목록에는 주는데 **부르면 404** 인 이름들.
 *
 * ⚠️ 실측(2026-08-28): `gemini-2.5-flash` 가 목록에 들어 있는데 호출하면 404 다.
 *    그런데 매 요청마다 후보에 다시 끼어서, 인스타 한 건 읽을 때마다 죽은
 *    문을 한 번씩 두드렸다. 한 번 404 를 본 이름은 그때부터 건너뛴다.
 *
 * ⚠️ 프로세스가 사는 동안만 기억한다. 구글이 그 이름을 되살리면 다음 배포
 *    때 자연히 풀린다 — 영영 못 쓰게 박아 두지 않는다.
 */
const gone = new Set<string>();

export function markModelGone(name: string): void {
  gone.add(name);
}

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

/**
 * 글자용 flash 모델 후보.
 *
 * ⚠️ 지난번에 통했던 모델을 맨 앞에 세운다. 서버는 요청마다 새로 떠서
 *    아래 `cached`(메모리)는 금방 사라지는데, 표에 남긴 기억은 살아남는다.
 */
export const TEXT_PURPOSE = "text";

export async function flashModelCandidates(apiKey: string): Promise<string[]> {
  const alive = (names: string[]) => names.filter((n) => !gone.has(n));
  if (cached)
    return alive(withPreferredFirst(cached, await preferredModel(TEXT_PURPOSE)));
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
    return alive(withPreferredFirst(names, await preferredModel(TEXT_PURPOSE)));
  } catch {
    return [];
  }
}

/**
 * 과부하(503)·속도 제한(429)은 **잠깐 기다렸다 같은 모델에 다시 물으면** 대개 통한다.
 * 다른 모델로 바로 넘어가면 더 나쁜 모델을 쓰게 되므로 한 번은 제자리에서 기다린다.
 */
export function isTransient(status: number, body?: string): boolean {
  /*
    ⚠️ **429 라고 다 같은 429 가 아니다.**
       - 속도 제한(잠깐 몰림) → 기다렸다 다시 하면 통한다
       - **선불 크레딧 소진** → 몇 번을 다시 해도 안 된다

    실측(2026-08-24): 영수증 스캔이 계속 실패했는데 원인이
    `"Your prepayment credits are depleted."` 였다. 이걸 재시도로 다루면
    모델 세 개를 두 번씩 두드리고 결국 같은 실패로 끝난다 — 시간만 버린다.
  */
  if (status === 429 && /credit|quota|billing|exhaust/i.test(String(body ?? ""))) return false;
  return status === 429 || status === 500 || status === 503;
}

/** 결제 문제인가 — 사용자에게 "다시 찍어 보세요" 라고 하면 안 되는 경우 */
export function isBillingProblem(status: number, body?: string): boolean {
  return (
    (status === 429 || status === 402 || status === 403) &&
    /credit|billing|prepayment|exhaust|quota/i.test(String(body ?? ""))
  );
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/* ── 통했던 모델 기억하기 ─────────────────────────────
 *
 * ⚠️ 서버는 요청마다 새로 뜬다. 그래서 메모리에만 담아 두면 금방 사라지고,
 *    매번 목록 조회 → 앞에서부터 시도 → 503이면 재시도를 되풀이한다.
 *    도시 커버 150장을 만들던 날 이 낭비가 150번 곱해졌다.
 *
 * ⚠️ 어디까지나 **먼저 시도할 후보**일 뿐이다. 실패하면 예전처럼 목록을 훑는다 —
 *    모델 이름을 박아 두는 것과는 다르다(그건 조용히 죽는다).
 */

import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function preferredModel(purpose: string): Promise<string | null> {
  try {
    const db = getSupabaseAdmin();
    if (!db) return null;
    const { data } = await db
      .from("ai_model_pref")
      .select("model")
      .eq("purpose", purpose)
      .maybeSingle();
    return (data as { model?: string } | null)?.model ?? null;
  } catch {
    return null;
  }
}

export async function rememberModel(purpose: string, model: string): Promise<void> {
  try {
    const db = getSupabaseAdmin();
    if (!db) return;
    await db.rpc("remember_ai_model", { p_purpose: purpose, p_model: model });
  } catch {
    /* 기억에 실패해도 기능은 그대로 돈다 */
  }
}

export async function modelFailed(purpose: string): Promise<void> {
  try {
    const db = getSupabaseAdmin();
    if (!db) return;
    await db.rpc("ai_model_failed", { p_purpose: purpose });
  } catch {
    /* 무시 */
  }
}

/**
 * 기억해 둔 모델을 맨 앞으로 보낸다 (중복 제거).
 *
 * ⚠️ **기억은 상한다.** 실측(2026-08-25): 표에 `gemini-2.5-flash` 가 남아 있는데
 *    구글이 이 이름을 내려서 HTTP 404 였다. 그런데도 매번 맨 앞에 세우느라,
 *    첫 후보가 404 → 다음이 503(과부하) → 그대로 "장소를 찾지 못했어요" 가 됐다.
 *    모델 이름을 박아 둔 것과 증상이 똑같다 — 박은 곳이 코드가 아니라 표일 뿐이다.
 *
 *    그래서 **살아 있는 목록에 없는 기억은 무시한다.** 방금 구글에 물어서 받은
 *    목록이 진실이고, 표는 그 안에서 순서만 바꾸는 힌트로만 쓴다.
 *
 * ⚠️ 목록이 비었을 때는(조회 자체가 실패) 기억이라도 써야 한다 — 안 그러면
 *    후보가 하나도 없어서 시도조차 못 한다.
 */
export function withPreferredFirst(models: string[], preferred: string | null): string[] {
  if (!preferred) return models;
  if (models.length && !models.includes(preferred)) return models;
  return Array.from(new Set([preferred, ...models]));
}
