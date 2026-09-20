"use client"
import type { ReactNode } from "react"
import styles from "./saved-exact.module.css"

export function SavedDesignIcon({ name, size = 22 }: { name: string; size?: number }) {
  // Original saved.html SVG bytes; no substitute icon family.
  if (name === "quick-michelin") return <img src="/design/saved/michelin-face.png" alt="" aria-hidden width={size} height={size} style={{ width: size, height: size, borderRadius: "50%", flexShrink: 0 }} />
  return <img src={`/design/saved/${name}.svg`} alt="" aria-hidden width={size} height={size} style={{ width: size, height: size, flexShrink: 0 }} />
}
export function SavedPlaceCard({ name, source, photo, selected, starred, onStar, onDetail, onMap, metadata, details, actions, badge }: {
  name: string; source: "mine" | "trip" | "friend" | "best"; photo?: string | null; selected?: boolean; starred?: boolean;
  onStar?: () => void; onDetail: () => void; onMap?: () => void; metadata?: ReactNode; details?: ReactNode; actions?: ReactNode; badge?: ReactNode;
}) {
  const data = { best: ["bookmark", "선정 장소"], mine: ["heart", "나의 찜"], trip: ["clapperboard", "여행클립"], friend: ["circle-user-round", "친구 찜"] }[source]
  return <article className={styles.card} data-selected={selected}>
    {photo ? <div className={styles.photo}>
      <button className={styles.photoLink} onClick={onMap ?? onDetail} aria-label={`${name} ${onMap ? "지도에서 보기" : "상세보기"}`}><img src={photo} alt="" loading="lazy" /></button>
      <span className={styles.source}><SavedDesignIcon name={data[0]} size={16} />{data[1]}</span>
      {onStar ? <button className={styles.star} onClick={onStar} aria-label="별표 표시" aria-pressed={!!starred}><SavedDesignIcon name={starred ? "star-selected" : "star"} size={21} /></button> : null}
      {badge ? <div className={styles.badge}>{badge}</div> : null}
    </div> : <div className={styles.noPhoto}><SavedDesignIcon name={data[0]} size={16} /><span>{data[1]}</span>{onStar ? <button onClick={onStar} aria-label="별표 표시" aria-pressed={!!starred}><SavedDesignIcon name={starred ? "star-selected" : "star"} /></button> : null}</div>}
    <button className={styles.name} onClick={onDetail}><span>{name}</span><SavedDesignIcon name="chevron-right" size={19} /></button>
    <div className={styles.meta}>{metadata}</div>
    {!photo && badge ? <div className={styles.inlineBadges}>{badge}</div> : null}
    <div className={styles.details}>{details}</div>
    <div className={styles.actions}>{actions}</div>
  </article>
}
export function SavedCardAction({ icon, label, onClick, highlight = false, disabled = false }: { icon: string; label: string; onClick: () => void; highlight?: boolean; disabled?: boolean }) {
  return <button type="button" className={styles.action} data-highlight={highlight} disabled={disabled} onClick={onClick}><SavedDesignIcon name={icon} size={20} /><span>{label}</span></button>
}
export function SavedMapTools({ value, onChange, onLocate, locating }: { value: "all" | "wish" | "trip" | "friends"; onChange: (value: "all" | "wish" | "trip" | "friends") => void; onLocate: () => void; locating?: boolean }) {
  const choices = [{ key: "all", icon: "layers", label: "전체보기" }, { key: "wish", icon: "heart", label: "나의 찜" }, { key: "trip", icon: "clapperboard", label: "여행클립" }, { key: "friends", icon: "circle-user-round", label: "친구 찜" }] as const
  return <div className={styles.tools}><nav className={styles.tabs} aria-label="지도 분류"><span className={styles.indicator} style={{ transform: `translateY(${choices.findIndex(c => c.key === value) * 58}px)` }} />{choices.map(item => <button key={item.key} aria-pressed={item.key === value} onClick={() => onChange(item.key)}><span><SavedDesignIcon name={item.icon + (item.key === value ? "-selected" : "")} size={24} /></span><small>{item.label}</small></button>)}</nav><button className={styles.round} aria-label="내 위치로 이동" onClick={onLocate} disabled={locating}><SavedDesignIcon name="locate-fixed" size={23} /></button></div>
}
