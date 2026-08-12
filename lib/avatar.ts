/**
 * 프로필(아바타) 이미지 URL 정리 — 카카오 로그인이 주는 http:// 아바타를 https://로 승격.
 *
 * 카카오 아바타가 `http://k.kakaocdn.net/...` 형태라, https 페이지(withtrip.co.kr)에서는
 * 혼합 콘텐츠(mixed content)로 브라우저가 차단하고, iOS 앱에서도 ATS가 막아 사진이 안 뜬다.
 * 카카오 CDN은 https로도 같은 이미지를 주므로 읽을 때만 http→https로 바꾼다. DB는 수정하지 않는다.
 */
export function resolveAvatarUrl(url: unknown): string | undefined {
  const raw = String(url ?? "").trim()
  if (!raw) return undefined
  return raw.startsWith("http://") ? "https://" + raw.slice(7) : raw
}
