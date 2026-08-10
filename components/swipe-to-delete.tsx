"use client"

import { useRef, useState, type ReactNode } from "react"
import { Trash2 } from "lucide-react"

/**
 * 카드를 왼→오른쪽으로 밀면 왼쪽에 삭제 패널이 부드럽게 드러나고, 임계값을 넘겨 놓으면 삭제된다.
 * 모바일 터치 + 데스크톱 마우스 드래그 지원. touch-action:pan-y 로 세로 스크롤은 그대로 둔다.
 */
export function SwipeToDelete({
  onDelete,
  children,
}: {
  onDelete: () => void
  children: ReactNode
}) {
  const [dx, setDx] = useState(0)
  const [snap, setSnap] = useState(false)
  const start = useRef<{ x: number; y: number } | null>(null)
  const axis = useRef<"none" | "x" | "y">("none")
  const moved = useRef(false)
  const dragging = useRef(false)

  const MAX = 108
  const THRESHOLD = 78

  const begin = (x: number, y: number) => {
    start.current = { x, y }
    axis.current = "none"
    moved.current = false
    setSnap(false)
  }
  const move = (x: number, y: number) => {
    if (!start.current) return
    const dX = x - start.current.x
    const dY = y - start.current.y
    if (axis.current === "none") {
      if (Math.abs(dX) < 6 && Math.abs(dY) < 6) return
      axis.current = Math.abs(dX) > Math.abs(dY) ? "x" : "y"
    }
    if (axis.current !== "x") return
    moved.current = true
    setDx(Math.max(0, Math.min(MAX, dX)))
  }
  const end = () => {
    if (!start.current) return
    start.current = null
    if (axis.current === "x") {
      setSnap(true)
      if (dx >= THRESHOLD) {
        setDx(MAX)
        window.setTimeout(() => {
          onDelete()
          setDx(0)
        }, 130)
      } else {
        setDx(0)
      }
    }
    axis.current = "none"
  }

  return (
    <div className="relative overflow-hidden rounded-2xl">
      {/* 왼쪽 삭제 패널 */}
      <div
        className="absolute inset-y-0 left-0 flex items-center justify-center bg-rose-500 text-white"
        style={{ width: MAX, opacity: dx > 4 ? 1 : 0, transition: "opacity 0.1s" }}
        aria-hidden
      >
        <div className="flex flex-col items-center gap-0.5">
          <Trash2 className="size-5" />
          <span className="text-xs font-bold">삭제</span>
        </div>
      </div>
      <div
        onTouchStart={(e) => begin(e.touches[0].clientX, e.touches[0].clientY)}
        onTouchMove={(e) => move(e.touches[0].clientX, e.touches[0].clientY)}
        onTouchEnd={end}
        onTouchCancel={end}
        onMouseDown={(e) => {
          dragging.current = true
          begin(e.clientX, e.clientY)
        }}
        onMouseMove={(e) => {
          if (dragging.current) move(e.clientX, e.clientY)
        }}
        onMouseUp={() => {
          dragging.current = false
          end()
        }}
        onMouseLeave={() => {
          if (dragging.current) {
            dragging.current = false
            end()
          }
        }}
        onClickCapture={(e) => {
          // 드래그 직후의 클릭(상세 열기 등)은 무시
          if (moved.current) {
            e.preventDefault()
            e.stopPropagation()
            moved.current = false
          }
        }}
        style={{
          transform: `translateX(${dx}px)`,
          transition: snap ? "transform 0.18s ease" : "none",
          touchAction: "pan-y",
        }}
        className="relative bg-white"
      >
        {children}
      </div>
    </div>
  )
}
