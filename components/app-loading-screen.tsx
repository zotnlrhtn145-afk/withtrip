"use client"

/**
 * Shared branded loader for in-app menu/route transitions.
 *
 * Fills the content area (not the whole viewport) so the sidebar / bottom nav
 * stay put while a menu's data streams in — matching the amber spinner style
 * used across the app (see LoginLoadingScreen).
 */
export function AppLoadingScreen({
  label = "LOADING...",
}: {
  label?: string
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="불러오는 중"
      className="flex min-h-[70vh] w-full flex-col items-center justify-center gap-4"
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
