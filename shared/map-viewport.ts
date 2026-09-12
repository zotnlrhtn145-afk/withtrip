/** 화면 밖 핀은 생성하지 않되, 가장자리 이동 중 빈틈을 줄이는 여유를 둡니다. */
export function inMapViewport(point: { lat: number; lng: number }, bounds: { north: number; south: number; east: number; west: number }, padding = 0.25): boolean {
  if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng)) return false
  const height = Math.abs(bounds.north - bounds.south)
  if (point.lat > bounds.north + height * padding || point.lat < bounds.south - height * padding) return false
  const width = ((bounds.east - bounds.west) % 360 + 360) % 360 || 360
  if (width * (1 + 2 * padding) >= 360) return true
  const center = bounds.west + width / 2
  const distance = Math.abs(((point.lng - center + 540) % 360 + 360) % 360 - 180)
  return distance <= width * (0.5 + padding)
}
