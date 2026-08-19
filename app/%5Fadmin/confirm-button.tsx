"use client"

/**
 * 되돌릴 수 없는 단추.
 *
 * ⚠️ 목록에서 지우기는 **가리기 바로 옆에 있다.** 손이 미끄러지면 남의 글이
 *    영영 사라진다 — 한 번 더 묻는다.
 */
export function ConfirmSubmit({
  children,
  message,
  className = "wt-btn dg",
}: {
  children: React.ReactNode
  message: string
  className?: string
}) {
  return (
    <button
      className={className}
      type="submit"
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault()
      }}
    >
      {children}
    </button>
  )
}
