"use client"

import { MapPin, Plane, SearchX } from "lucide-react"

import { useTrips } from "@/components/trips-store"
import { Badge } from "@/components/ui/badge"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import type { Trip } from "@/lib/trip-data"

export function TripSearchDialog({
  open,
  onOpenChange,
  onSelectTrip,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelectTrip: (trip: Trip) => void
}) {
  const { filteredTrips, query, setQuery } = useTrips()

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="여행 검색"
      description="여행 제목, 국가, 도시로 검색하세요."
      className="rounded-2xl! sm:max-w-lg"
    >
      <Command shouldFilter={false} className="rounded-2xl!">
        <CommandInput
          value={query}
          onValueChange={setQuery}
          placeholder="Osaka, Da Nang, Taipei 등으로 검색"
        />
        <CommandList className="max-h-80">
          <CommandEmpty>
            <span className="flex flex-col items-center gap-2 text-muted-foreground">
              <SearchX className="size-5" />
              검색 결과가 없어요. 다른 키워드를 입력해 보세요.
            </span>
          </CommandEmpty>
          {filteredTrips.length > 0 ? (
            <CommandGroup heading={`여행 ${filteredTrips.length}개`}>
              {filteredTrips.map((trip) => (
                <CommandItem
                  key={trip.id}
                  value={trip.id}
                  onSelect={() => {
                    onSelectTrip(trip)
                    onOpenChange(false)
                  }}
                  className="gap-3 py-2.5"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/15">
                    <Plane className="size-4" />
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-semibold">{trip.title}</span>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="size-3" />
                      {trip.country} · {trip.region}
                    </span>
                  </span>
                  <Badge variant="outline" className="ml-auto shrink-0 tabular-nums">
                    D-{trip.dDay}
                  </Badge>
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}
        </CommandList>
      </Command>
    </CommandDialog>
  )
}
