import type { PlaceShare } from "@/shared/place-share"
/** Figma289:4888. Only rendered in an authenticated sender preview. */
export function PlaceShareCard({ share }: { share: PlaceShare }) {
 const p = share.place
 return <article className="overflow-hidden rounded-xl border border-slate-200 bg-white text-left">
  {p.imageUrl && <img src={p.imageUrl} alt={p.name || "장소"} className="h-[184px] w-full object-cover" />}
  <div className="space-y-3 p-[18px]"><p className="text-sm font-semibold">{share.sender}님이 이 장소를 공유합니다</p><h1 className="text-xl font-bold">{p.name}</h1><p className="text-sm leading-6">{p.category}{p.rating != null ? ` · ★ ${p.rating}${p.reviewCount != null ? ` (${p.reviewCount})` : ""}` : ""}</p><p className="text-sm leading-6 text-slate-600">{p.address}</p>{p.description && <p className="text-sm leading-6">{p.description}</p>}<div className="flex items-center gap-2"><img src="/design/withtrip-share-logo.png" width="24" height="24" alt="" /><strong className="text-xs tracking-wide">WITHTRIP</strong></div></div>
 </article>
}
