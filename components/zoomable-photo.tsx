"use client"
import { useRef, useState, type ReactNode, type PointerEvent } from "react"

export function ZoomablePhoto({ children }: { children: ReactNode }) {
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 })
  const current = useRef(view)
  const points = useRef(new Map<number, { x: number; y: number }>())
  const base = useRef({ scale: 1, distance: 1, x: 0, y: 0, px: 0, py: 0 })
  const apply = (scale: number, x = 0, y = 0, element?: HTMLElement) => {
    const s = Math.max(1, Math.min(4, scale))
    const box = element?.getBoundingClientRect()
    const next = { scale: s, x: box ? Math.max(-box.width*(s-1)/2, Math.min(box.width*(s-1)/2,x)) : x, y: box ? Math.max(-box.height*(s-1)/2, Math.min(box.height*(s-1)/2,y)) : y }
    current.current = next; setView(next)
  }
  const rebase = () => {
    const p = [...points.current.values()]
    base.current = { ...current.current, distance: p.length >= 2 ? Math.hypot(p[1].x-p[0].x,p[1].y-p[0].y) || 1 : 1, px: p[0]?.x ?? 0, py: p[0]?.y ?? 0 }
  }
  const end = (e: PointerEvent<HTMLDivElement>) => { points.current.delete(e.pointerId); rebase() }
  return <div>
    <div className="relative h-[70svh] w-full overflow-hidden" style={{ touchAction: "none" }}
      onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); points.current.set(e.pointerId,{x:e.clientX,y:e.clientY}); rebase() }}
      onPointerMove={e => {
        if (!points.current.has(e.pointerId)) return
        points.current.set(e.pointerId,{x:e.clientX,y:e.clientY}); const p=[...points.current.values()], b=base.current
        if(p.length>=2) apply(b.scale*Math.hypot(p[1].x-p[0].x,p[1].y-p[0].y)/b.distance,current.current.x,current.current.y,e.currentTarget)
        else if(current.current.scale>1) apply(current.current.scale,b.x+e.clientX-b.px,b.y+e.clientY-b.py,e.currentTarget)
      }} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end}
      onDoubleClick={() => apply(current.current.scale>1?1:3)} onDragStart={e=>e.preventDefault()}>
      <div className="absolute inset-0 select-none" style={{ transform:`translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}>{children}</div>
    </div>
    <div className="flex justify-center gap-5 py-2 text-sm">
      <button type="button" className="min-h-11 px-3" aria-label="사진 축소" disabled={view.scale<=1} onClick={()=>apply(current.current.scale-.5)}>−</button>
      <button type="button" className="min-h-11 px-3" aria-label="사진 원래 크기로" onClick={()=>apply(1)}>{Math.round(view.scale*100)}%</button>
      <button type="button" className="min-h-11 px-3" aria-label="사진 확대" disabled={view.scale>=4} onClick={()=>apply(current.current.scale+.5)}>＋</button>
    </div>
  </div>
}
