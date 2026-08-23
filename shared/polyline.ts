/**
 * 구글 encoded polyline 을 좌표로 푼다.
 *
 * 구글은 경로의 점 수백 개를 `_p~iF~ps|U_ulLnnqC` 같은 짧은 문자열로 준다.
 * 저장할 때도 옮길 때도 이 상태가 훨씬 싸서, **푸는 건 화면 쪽에서** 한다.
 *
 * 규칙(구글 문서):
 *   1. 좌표를 1e5 배 해서 정수로
 *   2. 앞 점과의 **차이**만 남긴다 (그래서 문자열이 짧다)
 *   3. 음수는 2의 보수 후 왼쪽으로 1비트
 *   4. 5비트씩 잘라 뒤집고, 마지막 조각 빼고 0x20 을 더한 뒤 63을 더해 문자로
 *
 * ⚠️ 이 파일은 `~/withtrip/shared/` 가 원본이다.
 *    앱 쪽 `src/lib/shared/` 는 복사본이므로 직접 고치지 말 것.
 */

export type LatLngPoint = { lat: number; lng: number }

export function decodePolyline(encoded: string | null | undefined): LatLngPoint[] {
  const s = String(encoded ?? "")
  if (!s) return []

  const out: LatLngPoint[] = []
  let index = 0
  let lat = 0
  let lng = 0

  while (index < s.length) {
    // 위도 차이 → 경도 차이 순으로 두 번 읽는다
    for (let coord = 0; coord < 2; coord++) {
      let result = 0
      let shift = 0
      let byte = 0
      do {
        byte = s.charCodeAt(index++) - 63
        // ⚠️ 문자열이 중간에 잘렸거나 우리 형식이 아니면 여기서 NaN 이 된다.
        //    그대로 두면 지도에 좌표 없는 점이 들어가 선이 통째로 사라진다.
        if (!Number.isFinite(byte)) return out
        result |= (byte & 0x1f) << shift
        shift += 5
      } while (byte >= 0x20 && index <= s.length)
      const delta = result & 1 ? ~(result >> 1) : result >> 1
      if (coord === 0) lat += delta
      else lng += delta
    }
    out.push({ lat: lat / 1e5, lng: lng / 1e5 })
  }
  return out
}
