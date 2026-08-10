"use client"

import { useRef, useState, type ReactNode } from "react"
import { Trash2 } from "lucide-react"

/**
 * iOS 메일 방식 스와이프: 카드를 우→좌로 밀면 오른쪽에 "삭제" 버튼이 드러난다.
 * - 버튼을 눌러야 실제 삭제된다(밀었다고 바로 삭제 X).
 * - 열린 상태에서 카드(다른 곳)를 누르면 원위치로 복귀.
 * 모바일 터치 + 데스크톱 마우스 드래그 지원.
 */
export function SwipeToDelete({
  onDelete,
  children,
}: {
  onDelete: () => void
  children: ReactNode
}) {
  const REVEAL = 84 // 삭제 버튼 너비
  const OPEN_THRESHOLD = 34 // 이만큼 밀면 열림 확정

  const [dx, setDx] = useState(0) // 0(닫힘) ~ -REVEAL(열림)
  const [snap, setSnap] = useState(false)
  const open = useRef(false)
  const start = useRef<{ x: number; y: number; base: number } | null>(null)
  const axis = useRef<"none" | "x" | "y">("none")
  const moved = useRef(false)
  const dragging = useRef(false)

  const begin = (x: number, y: number) => {
    start.current = { x, y, base: open.current ? -REVEAL : 0 }
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
    setDx(Math.max(-REVEAL, Math.min(0, start.current.base + dX)))
  }
  const settle = () => {
    if (!start.current) return
    start.current = null
    if (axis.current === "x") {
      setSnap(true)
      if (dx <= -OPEN_THRESHOLD) {
        setDx(-REVEAL)
        open.current = true
      } else {
        setDx(0)
        open.current = false
      }
    }
    axis.current = "none"
  }
  const close = () => {
    setSnap(true)
    setDx(0)
    open.current = false
  }

  return (
    <div className="relative overflow-hidden rounded-2xl">
      {/* 오른쪽 삭제 버튼 (카드가 왼쪽으로 밀리면 드러남) */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onDelete()
        }}
        aria-label="삭제"
        className="absolute inset-y-0 right-0 flex flex-col items-center justify-center gap-0.5 bg-rose-500 text-white"
        style={{ width: REVEAL }}
      >
        <Trash2 className="size-5" />
        <span className="text-xs font-bold">삭제</span>
      </button>
      <div
        onTouchStart={(e) => begin(e.touches[0].clientX, e.touches[0].clientY)}
        onTouchMove={(e) => move(e.touches[0].clientX, e.touches[0].clientY)}
        onTouchEnd={settle}
        onTouchCancel={settle}
        onMouseDown={(e) => {
          dragging.current = true
          begin(e.clientX, e.clientY)
        }}
        onMouseMove={(e) => {
          if (dragging.current) move(e.clientX, e.clientY)
        }}
        onMouseUp={() => {
          dragging.current = false
          settle()
        }}
        onMouseLeave={() => {
          if (dragging.current) {
            dragging.current = false
            settle()
          }
        }}
        onClickCapture={(e) => {
          // 드래그 직후의 클릭 무시
          if (moved.current) {
            e.preventDefault()
            e.stopPropagation()
            moved.current = false
            return
          }
          // 열린 상태에서 카드를 누르면 원위치(내비게이션 등 실행 안 함)
          if (open.current) {
            e.preventDefault()
            e.stopPropagation()
            close()
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
