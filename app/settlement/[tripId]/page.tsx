"use client"

import { use } from "react"

import { SettlementTripDetail } from "@/components/settlement-shell"

type SettlementTripRouteProps = {
  params: Promise<{ tripId: string }>
}

export default function SettlementTripRoute({
  params,
}: SettlementTripRouteProps) {
  const { tripId } = use(params)
  return <SettlementTripDetail tripId={tripId} />
}
