"use client"

import { Suspense } from "react"

import { SettlementShell } from "@/components/settlement-shell"

export default function SettlementLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <Suspense fallback={null}>
      <SettlementShell>{children}</SettlementShell>
    </Suspense>
  )
}
