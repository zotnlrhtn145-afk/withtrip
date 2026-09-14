import { NextResponse } from "next/server"
import { readPlaceShare, shareAuth } from "@/lib/place-share-server"
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { user } = await shareAuth(request)
  if (!user) return new NextResponse(null, { status: 401 })
  const share = await readPlaceShare((await params).token)
  return share ? NextResponse.json(share, { headers: { "Cache-Control": "no-store" } }) : new NextResponse(null, { status: 404 })
}
