"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

import { CreateTripDialog } from "@/components/create-trip-dialog"
import { QuickMenuSheet } from "@/components/quick-register/quick-menu-sheet"
import { TripPickerModal } from "@/components/quick-register/trip-picker-modal"
import { useTrips } from "@/components/trips-store"

/**
 * Mounted once at the app-shell level (not inside WithtripShell) so the mobile
 * header's top-left "+" works on every route, including /trips/[id] and
 * /settlement/*, which render their own component trees without WithtripShell.
 */
export function GlobalQuickAdd() {
  const router = useRouter()
  const { trips } = useTrips()
  const [isQuickMenuOpen, setIsQuickMenuOpen] = useState(false)
  const [isTripModalOpen, setIsTripModalOpen] = useState(false)
  const [tripPickerPurpose, setTripPickerPurpose] = useState<"expense" | "place" | null>(null)
  const [quickToast, setQuickToast] = useState<string | null>(null)

  useEffect(() => {
    const onOpenQuickMenu = () => setIsQuickMenuOpen(true)
    window.addEventListener("withtrip:open-quick-menu", onOpenQuickMenu)
    return () => window.removeEventListener("withtrip:open-quick-menu", onOpenQuickMenu)
  }, [])

  const showQuickToast = (message: string) => {
    setQuickToast(message)
    window.setTimeout(() => setQuickToast(null), 2800)
  }

  const goToAddExpense = (tripId: string) => {
    router.push(`/settlement/${tripId}?addExpense=1`)
  }

  const goToAddPlace = (tripId: string) => {
    router.push(`/trips/${tripId}?addPlace=1`)
  }

  const handleSelectExpense = () => {
    setIsQuickMenuOpen(false)
    if (trips.length === 0) {
      showQuickToast("먼저 여행을 만들어 주세요.")
      return
    }
    if (trips.length === 1) {
      goToAddExpense(trips[0].id)
      return
    }
    setTripPickerPurpose("expense")
  }

  const handleSelectPlace = () => {
    setIsQuickMenuOpen(false)
    if (trips.length === 0) {
      showQuickToast("먼저 여행을 만들어 주세요.")
      return
    }
    if (trips.length === 1) {
      goToAddPlace(trips[0].id)
      return
    }
    setTripPickerPurpose("place")
  }

  return (
    <>
      <QuickMenuSheet
        open={isQuickMenuOpen}
        onOpenChange={setIsQuickMenuOpen}
        onSelectTrip={() => {
          setIsQuickMenuOpen(false)
          setIsTripModalOpen(true)
        }}
        onSelectExpense={handleSelectExpense}
        onSelectPlace={handleSelectPlace}
      />
      <CreateTripDialog
        open={isTripModalOpen}
        onOpenChange={setIsTripModalOpen}
        onCreated={(trip) => {
          showQuickToast(`「${trip.title}」 여행이 등록되었어요.`)
          router.push("/")
        }}
      />
      <TripPickerModal
        open={tripPickerPurpose !== null}
        onOpenChange={(next) => {
          if (!next) setTripPickerPurpose(null)
        }}
        trips={trips.map((trip) => ({ id: trip.id, title: trip.title }))}
        title={tripPickerPurpose === "expense" ? "어느 여행의 지출인가요?" : "어느 여행에 저장할까요?"}
        description="여러 여행이 등록되어 있어요. 하나를 선택해 주세요."
        onSelect={(trip) => {
          const purpose = tripPickerPurpose
          setTripPickerPurpose(null)
          if (purpose === "expense") goToAddExpense(trip.id)
          else if (purpose === "place") goToAddPlace(trip.id)
        }}
      />
      {quickToast ? (
        <div className="fixed inset-x-0 bottom-24 z-[70] mx-auto w-full max-w-md px-4 md:right-6 md:left-auto md:max-w-sm">
          <div className="rounded-2xl bg-foreground px-4 py-3 text-center text-sm font-semibold text-background shadow-lg animate-in fade-in-0 slide-in-from-bottom-2">
            {quickToast}
          </div>
        </div>
      ) : null}
    </>
  )
}
