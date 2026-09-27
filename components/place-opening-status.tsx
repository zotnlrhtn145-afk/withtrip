import type { openLabel } from "@/shared/opening-hours"
export function PlaceOpeningStatus({ status }: { status: ReturnType<typeof openLabel> }) {
  if (status.tone === "none") return null
  return <div className="rounded-[14px] px-3 py-3 text-[15px] font-bold leading-[22px]" style={{ background: status.tone === "warn" ? "#FFF5E3" : status.tone === "good" ? "#EBF7F2" : "#F3F4F5", color: status.tone === "warn" ? "#9C5700" : status.tone === "good" ? "#087B5D" : "#586571" }}>{status.text}</div>
}
