/**
 * Next.js 가 서버를 켤 때 한 번 부른다.
 *
 * 여기서 유료 API 호출 계량기를 단다 — 관리자 화면의 "실제 나가는 돈"이
 * 이 기록에서 나온다.
 */
export async function register() {
  // ⚠️ edge 런타임에는 계량기를 달지 않는다. 인스턴스가 요청마다 새로 뜨고
  //    금방 사라져서, 모아 뒀다 보내는 방식이 그대로 버려진다.
  if (process.env.NEXT_RUNTIME !== "nodejs") return
  const { installFetchMeter } = await import("@/lib/api-meter")
  installFetchMeter()
}
