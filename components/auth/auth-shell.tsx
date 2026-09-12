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
          <img src="/withtrip-logo.png" alt="" className="size-[66px] rounded-[20px]" />
          <div className="flex flex-col gap-1">
            <span className="text-[25px] leading-none font-extrabold tracking-[1px] text-slate-900">
              WITHTRIP
            </span>
            <span className="text-xs font-medium text-slate-400">함께 떠나는 여행 플래너</span>
          </div>
        </div>

        <div className="bg-white px-2 py-6 sm:px-0">
          <div className="mb-6 flex flex-col gap-1.5 text-center">
            <h1 className="text-[26px] leading-[34px] font-semibold tracking-tight text-slate-900">{title}</h1>
            <p className="text-pretty text-sm text-slate-400">{description}</p>
          </div>
          <div className="flex flex-col gap-5">{children}</div>
        </div>

        {footer ? <div className="flex justify-center">{footer}</div> : null}
      </div>
    </div>
  )
}
