"use client"

import { useRef, useState, type ReactNode } from "react"
import { Trash2 } from "lucide-react"

/**
 * 카드를 왼→오른쪽으로 밀면 왼쪽에 삭제 패널이 부드럽게 드러나고, 임계값을 넘겨 놓으면 삭제된다.
 * 모바일 터치 + 데스크톱 포인터(마우스 드래그) 모두 지원. 세로 스크롤은 막지 않는다.
 */
export function SwipeToDelete({
  onDelete,
  children,
  disabled,
}: {
  onDelete: () => void
  children: ReactNode
  disabled?: boolean
}) {
  const [dx, setDx] = useState(0)
  const [animating, setAnimating] = useState(false)
  const startX = useRef(0)
  const startY = useRef(0)
  const activeAxis = useRef<"none" | "x" | "y">("none")
  const movedRef = useRef(false)

  const MAX = 110
  const THRESHOLD = 84

  const reset = () => {
    setAnimating(true)
    setDx(0)
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (disabled) return
    startX.current = e.clientX
    startY.current = e.clientY
    activeAxis.current = "none"
    movedRef.current = false
    setAnimating(false)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (disabled || e.buttons === 0) return
    const dX = e.clientX - startX.current
    const dY = e.clientY - startY.current
    if (activeAxis.current === "none") {
      if (Math.abs(dX) < 8 && Math.abs(dY) < 8) return
      activeAxis.current = Math.abs(dX) > Math.abs(dY) ? "x" : "y"
      if (activeAxis.current === "x") {
        try {
          ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
        } catch {}
      }
    }
    if (activeAxis.current !== "x") return
    movedRef.current = true
    setDx(Math.max(0, Math.min(MAX, dX)))
  }

  const onPointerUp = () => {
    if (activeAxis.current === "x") {
      if (dx >= THRESHOLD) {
        setAnimating(true)
        setDx(MAX)
        window.setTimeout(() => {
          onDelete()
          setDx(0)
        }, 140)
      } else {
        reset()
      }
    }
    activeAxis.current = "none"
  }

  return (
    <div className="relative overflow-hidden rounded-2xl">
      {/* 왼쪽 삭제 패널 */}
      <div
        className="absolute inset-y-0 left-0 flex items-center justify-center bg-rose-500 text-white transition-opacity"
        style={{ width: MAX, opacity: dx > 4 ? 1 : 0 }}
        aria-hidden
      >
        <div className="flex flex-col items-center gap-0.5">
          <Trash2 className="size-5" />
          <span className="text-xs font-bold">삭제</span>
        </div>
      </div>
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={reset}
        onClickCapture={(e) => {
          // 드래그 직후의 클릭(상세 열기 등)은 무시
          if (movedRef.current) {
            e.preventDefault()
            e.stopPropagation()
            movedRef.current = false
          }
        }}
        style={{
          transform: `translateX(${dx}px)`,
          transition: animating ? "transform 0.2s ease" : "none",
          touchAction: "pan-y",
        }}
        className="relative"
      >
        {children}
      </div>
    </div>
  )
}
