import { WORLD_BEST_LOGO_SVG } from "@/shared/world-best-logo"
import type { PlaceAwards } from "@/shared/place-awards"
const logo = "data:image/svg+xml," + encodeURIComponent(WORLD_BEST_LOGO_SVG.replace(/#fff/g, "#172B4D"))
/** Figma 417:4898 / 422:5089. Compact marks, explicit years in cards. */
export function PlaceAwardMarks({ awards, compact = false }: { awards: PlaceAwards; compact?: boolean }) {
  if (!awards.michelin && !awards.worldBest) return null
  const size = compact ? 18 : 22
  return <span style={{ display: "inline-flex", alignItems: "center", gap: compact ? 7 : 12, flexWrap: "wrap", paddingBlock: compact ? 0 : 5 }}>
    {awards.michelin ? <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><img src="/design/saved/michelin-face.png" alt="미쉐린 가이드 선정" width={size} height={size} style={{ width: size, height: size, objectFit: "contain" }} />{!compact && awards.michelinYear ? <small>{awards.michelinYear}</small> : null}</span> : null}
    {awards.worldBest ? <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><img src={logo} alt={awards.discovery ? "50 Best Discovery 소개" : "50 Best 선정"} width={26} height={16} style={{ width: 26, height: 16, objectFit: "contain" }} />{!compact ? <small>{awards.discovery ? "Discovery" : awards.bestYear || ""}</small> : null}</span> : null}
  </span>
}
