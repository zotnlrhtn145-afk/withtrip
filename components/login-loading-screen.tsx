"use client"

/** Shared Instagram-minimal full-screen loader for login transitions. */
export function LoginLoadingScreen({
  label = "LOADING...",
}: {
  label?: string
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="로그인 화면으로 이동 중"
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-white"
    >
      <div
        className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-amber-400"
        aria-hidden
      />
      <p className="text-xs font-medium tracking-widest text-slate-400 uppercase">
        {label}
      </p>
    </div>
  )
}
