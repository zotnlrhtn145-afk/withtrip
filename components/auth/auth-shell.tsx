import { Compass } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

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
    <div className="flex w-full flex-1 items-start justify-center px-4 py-8 sm:items-center sm:py-14">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Compass className="size-6" />
          </span>
          <div className="flex flex-col gap-1">
            <span className="text-lg leading-none font-extrabold tracking-tight">WITHTRIP</span>
            <span className="text-xs text-muted-foreground">함께 떠나는 여행 플래너</span>
          </div>
        </div>

        <Card className="rounded-2xl border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl">{title}</CardTitle>
            <CardDescription className="text-pretty">{description}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">{children}</CardContent>
        </Card>

        {footer ? <div className="flex justify-center">{footer}</div> : null}
      </div>
    </div>
  )
}
