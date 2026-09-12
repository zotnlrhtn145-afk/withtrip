import Image from "next/image"
import styles from "./login-quiet.module.css"

export function AuthShell({
  embedded = false,
  title,
  description,
  children,
  footer,
}: {
  embedded?: boolean
  title: string
  description: string
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  if (embedded) return <div className={styles.pane}><h2 className={styles.paneTitle}>{title}</h2><p className={styles.paneDescription}>{description}</p><div className="flex flex-col gap-5">{children}</div>{footer ? <div className={styles.footer}>{footer}</div> : null}</div>
  return (
    <div className="flex w-full flex-1 items-start justify-center bg-white px-6 py-8 sm:py-12">
      <div className="flex w-full max-w-sm flex-col gap-7">
        <div className="flex flex-col items-start gap-4 text-left">
          <Image src="/withtrip-logo.png" alt="" width={27} height={27} className={styles.smallMark} />
          <div className="flex flex-col gap-1">
            <span className="text-[25px] leading-none font-extrabold tracking-[1px] text-slate-900">
              WITHTRIP
            </span>
            <span className="text-sm font-normal text-slate-500">함께 떠나는 여행의 시작.</span>
          </div>
        </div>

        <div className="bg-white py-3">
          <div className="mb-6 flex flex-col gap-1.5 text-left">
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
