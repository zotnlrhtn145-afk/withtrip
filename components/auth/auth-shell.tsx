import { Compass } from "lucide-react"

export function AuthShell({
  title,
  description,
  children,
  footer,
}: {
  title: string
  description: string
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  return (
    <div className="flex w-full flex-1 items-start justify-center bg-white px-4 py-10 sm:items-center sm:py-16">
      <div className="flex w-full max-w-sm flex-col gap-7">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="flex size-14 items-center justify-center rounded-[1.35rem] bg-gradient-to-br from-amber-400 via-amber-300 to-amber-200 text-slate-950 shadow-[0_10px_26px_rgba(255,193,7,0.35)]">
            <Compass className="size-7 stroke-[1.6]" />
          </span>
          <div className="flex flex-col gap-1">
            <span className="text-lg leading-none font-extrabold tracking-tight text-slate-900">
              WITHTRIP
            </span>
            <span className="text-xs font-medium text-slate-400">함께 떠나는 여행 플래너</span>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm sm:p-7">
          <div className="mb-6 flex flex-col gap-1.5 text-center">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">{title}</h1>
            <p className="text-pretty text-sm text-slate-400">{description}</p>
          </div>
          <div className="flex flex-col gap-5">{children}</div>
        </div>

        {footer ? <div className="flex justify-center">{footer}</div> : null}
      </div>
    </div>
  )
}
