import { TripDetailPage } from "@/components/trip-detail/trip-detail-page"

type TripDetailRouteProps = {
  params: Promise<{ id: string }>
}

export default async function TripDetailRoute({ params }: TripDetailRouteProps) {
  const { id } = await params
  return <TripDetailPage tripId={id} />
}
