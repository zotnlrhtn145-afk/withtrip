"use client"

import { SettlementShell } from "@/components/settlement-shell"

export default function SettlementLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <SettlementShell>{children}</SettlementShell>
}
