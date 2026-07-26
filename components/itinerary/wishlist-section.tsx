"use client"

import Image from "next/image"
import { Footprints, Heart, MapPin, Martini, Navigation, Phone, Plus, Star, Utensils } from "lucide-react"

import { WishlistDialog } from "@/components/itinerary/wishlist-dialog"
import { useTrips } from "@/components/trips-store"
import { Avatar, AvatarFallback, AvatarGroup } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Separator } from "@/components/ui/separator"
import type { Member, Trip } from "@/lib/trip-data"
import { wishlistCategories, type WishlistEntry, type WishlistKind } from "@/lib/trip-itinerary"

const KIND_ICON: Record<WishlistKind, typeof Utensils> = {
  restaurant: Utensils,
  bar: Martini,
}

function CategorySummary({
  kind,
  label,
  guide,
  count,
}: {
  kind: WishlistKind
  label: string
  guide: string
  count: number
}) {
  const Icon = KIND_ICON[kind]

  return (
    <div className="flex flex-1 items-center gap-3 rounded-2xl bg-secondary/60 p-3.5 ring-1 ring-border">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
        <Icon className="size-5" />
      </span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="truncate text-sm font-bold">{label}</p>
        <p className="truncate text-xs text-muted-foreground">{guide}</p>
      </div>
      <Badge variant="outline" className="ml-auto shrink-0 bg-card font-semibold tabular-nums">
        {count}곳
      </Badge>
    </div>
  )
}

function SavedByGroup({ savedBy, pool }: { savedBy: string[]; pool: Member[] }) {
  if (savedBy.length === 0) return null

  return (
    <div className="flex items-center gap-2">
      <AvatarGroup>
        {savedBy.map((initials) => {
          const member = pool.find((item) => item.initials === initials)
          return (
            <Avatar key={initials} size="sm">
              <AvatarFallback
                className={`text-[10px] font-bold ${member?.color ?? "bg-secondary text-secondary-foreground"}`}
              >
                {initials}
              </AvatarFallback>
            </Avatar>
          )
        })}
      </AvatarGroup>
      <span className="text-xs font-medium text-muted-foreground">
        {`${savedBy.join(", ")} 저장`}
      </span>
    </div>
  )
}

function WishlistCard({ place, pool }: { place: WishlistEntry; pool: Member[] }) {
  const mapHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    place.address || place.name
  )}`

  return (
    <li className="flex flex-col overflow-hidden rounded-2xl bg-card ring-1 ring-border">
      <div className="relative h-44 w-full shrink-0">
        <Image
          src={place.image || "/placeholder.svg"}
          alt={place.imageAlt}
          fill
          sizes="(min-width: 1280px) 22vw, (min-width: 768px) 40vw, 90vw"
          className="object-cover"
        />
        <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
          <Badge className="max-w-[65%] shadow-sm">
            <span className="truncate font-bold">{place.badge}</span>
          </Badge>
          {place.distanceKm > 0 ? (
            <Badge className="shrink-0 border-transparent bg-foreground/70 text-background backdrop-blur-sm">
              <span className="tabular-nums">호텔에서 {place.distanceKm}km</span>
            </Badge>
          ) : null}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3.5 p-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col">
              <h3 className="truncate text-base font-bold">{place.name}</h3>
              <p className="truncate text-xs text-muted-foreground">{place.nameLocal}</p>
            </div>
            {place.rating > 0 ? (
              <div className="flex shrink-0 flex-col items-end">
                <span className="inline-flex items-center gap-1 text-sm font-bold tabular-nums">
                  <Star className="size-3.5 fill-primary text-primary" />
                  {place.rating}
                </span>
                <span className="text-[11px] text-muted-foreground tabular-nums">
                  리뷰 {place.reviews.toLocaleString()}
                </span>
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <Badge variant="secondary" className="font-medium">
              {place.category}
            </Badge>
            <Badge variant="outline" className="font-mono font-semibold">
              {place.priceRange}
            </Badge>
            <Badge variant="outline" className="border-primary/50 bg-primary/10 font-medium">
              {place.badgeNote}
            </Badge>
          </div>
        </div>

        <div className="flex flex-col gap-2 text-xs leading-relaxed">
          {place.address ? (
            <div className="flex items-start gap-2">
              <MapPin className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
              <span className="text-pretty text-muted-foreground">{place.address}</span>
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            {place.phone ? (
              <span className="inline-flex items-center gap-2 text-muted-foreground tabular-nums">
                <Phone className="size-3.5 shrink-0" />
                {place.phone}
              </span>
            ) : null}
            {place.walkMinutes > 0 ? (
              <span className="inline-flex items-center gap-2 font-medium tabular-nums">
                <Footprints className="size-3.5 shrink-0 text-muted-foreground" />
                도보 약 {place.walkMinutes}분
              </span>
            ) : null}
          </div>
        </div>

        <Separator className="mt-auto" />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <SavedByGroup savedBy={place.savedBy} pool={pool} />
          <Button
            render={<a href={mapHref} target="_blank" rel="noreferrer" />}
            nativeButton={false}
            variant="outline"
            size="sm"
            className="rounded-full font-semibold"
          >
            <Navigation data-icon="inline-start" />
            길찾기
          </Button>
        </div>
      </div>
    </li>
  )
}

export function WishlistSection({ trip }: { trip: Trip }) {
  const { wishlistByTrip, members } = useTrips()
  const places = wishlistByTrip[trip.id] ?? []

  const addButton = (
    <WishlistDialog
      trip={trip}
      trigger={
        <Button variant="outline" size="sm" className="rounded-full font-semibold">
          <Plus data-icon="inline-start" />
          장소 추가
        </Button>
      }
    />
  )

  return (
    <Card>
      <CardHeader>
        <CardDescription className="flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase">
          <Heart className="size-3.5" />
          Wishlist
        </CardDescription>
        <CardTitle className="text-lg font-bold">가고 싶은 곳</CardTitle>
        <CardDescription className="text-pretty">
          멤버들이 저장한 미슐랭 레스토랑과 세계 50대 바
        </CardDescription>
        <CardAction>{addButton}</CardAction>
      </CardHeader>

      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-col gap-2.5 sm:flex-row">
          {wishlistCategories.map((item) => (
            <CategorySummary
              key={item.kind}
              kind={item.kind}
              label={item.label}
              guide={item.guide}
              count={places.filter((place) => place.kind === item.kind).length}
            />
          ))}
        </div>

        {places.length > 0 ? (
          <ul className="grid gap-4 md:grid-cols-2">
            {places.map((place) => (
              <WishlistCard key={place.id} place={place} pool={members} />
            ))}
          </ul>
        ) : (
          <Empty className="border border-dashed border-border bg-secondary/40 py-10">
            <EmptyHeader>
              <EmptyMedia variant="icon" className="size-12 rounded-2xl bg-primary/15">
                <Heart className="size-6 text-foreground" />
              </EmptyMedia>
              <EmptyTitle className="text-base font-bold">
                아직 저장된 장소가 없어요.
              </EmptyTitle>
              <EmptyDescription className="text-xs">
                미슐랭 레스토랑이나 인기 라운지를 저장하면 멤버 모두가 함께 볼 수 있어요.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <WishlistDialog
                trip={trip}
                trigger={
                  <Button size="lg" className="w-full rounded-full font-semibold">
                    <Plus data-icon="inline-start" />
                    장소 추가
                  </Button>
                }
              />
            </EmptyContent>
          </Empty>
        )}
      </CardContent>
    </Card>
  )
}
