import { getCurrentUserId } from "@/lib/auth-session"
import { createNotification, resolveActorDisplayName } from "@/lib/notifications-api"
import { fetchTripRoster } from "@/lib/trip-members-api"
import { createClient } from "@/utils/supabase/client"

export type TripClip = {
  id: string
  tripId: string
  userId: string
  mediaUrl: string
  caption: string
  mediaType: "image" | "video"
  createdAt: string
  tripTitle?: string
}

type TripClipRow = {
  id: string
  trip_id: string
  user_id: string
  media_url: string
  caption?: string | null
  media_type?: string | null
  created_at: string
  trips?: { title?: string | null } | Array<{ title?: string | null }> | null
}

function formatError(err: unknown) {
  if (err == null) return "알 수 없는 오류"
  if (typeof err === "string") return err
  if (err instanceof Error) return err.message
  if (typeof err === "object" && "message" in err) {
    return String((err as { message?: unknown }).message ?? "알 수 없는 오류")
  }
  return "알 수 없는 오류"
}

function mapRow(row: TripClipRow): TripClip {
  const trip = Array.isArray(row.trips) ? row.trips[0] : row.trips
  const mediaType = String(row.media_type ?? "").toLowerCase() === "video" ? "video" : "image"
  return {
    id: String(row.id),
    tripId: String(row.trip_id),
    userId: String(row.user_id),
    mediaUrl: String(row.media_url ?? "").trim(),
    caption: String(row.caption ?? "").trim(),
    mediaType,
    createdAt: String(row.created_at ?? ""),
    tripTitle: String(trip?.title ?? "").trim() || undefined,
  }
}

/** Clips visible to the current user (own + shared trips). */
export async function fetchTripClips(): Promise<TripClip[]> {
  const userId = await getCurrentUserId()
  if (!userId) return []

  const client = createClient()
  const { data, error } = await client
    .from("trip_clips")
    .select("id, trip_id, user_id, media_url, caption, media_type, created_at, trips:trip_id(title)")
    .order("created_at", { ascending: false })
    .limit(40)

  if (error) {
    console.error("[fetchTripClips]", error.message || error.details || error)
    return []
  }

  return ((data as TripClipRow[] | null) ?? [])
    .map(mapRow)
    .filter((clip) => Boolean(clip.mediaUrl))
}

export async function uploadTripClipMedia(file: File): Promise<{
  publicUrl: string
  mediaType: "image" | "video"
}> {
  const userId = await getCurrentUserId()
  if (!userId) throw new Error("로그인이 필요해요.")

  const isVideo = file.type.startsWith("video/")
  const isImage = file.type.startsWith("image/")
  if (!isVideo && !isImage) {
    throw new Error("이미지 또는 동영상 파일만 업로드할 수 있어요.")
  }

  const ext =
    (file.name.split(".").pop() || (isVideo ? "mp4" : "jpg")).toLowerCase().replace(/[^a-z0-9]/g, "") ||
    (isVideo ? "mp4" : "jpg")
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

  const client = createClient()
  const { error } = await client.storage.from("trip-clips").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || undefined,
  })

  if (error) {
    console.error("[uploadTripClipMedia]", error.message)
    throw new Error(formatError(error) || "미디어 업로드에 실패했어요.")
  }

  const { data } = client.storage.from("trip-clips").getPublicUrl(path)
  const publicUrl = String(data.publicUrl ?? "").trim()
  if (!publicUrl) throw new Error("업로드 URL을 만들지 못했어요.")

  return { publicUrl, mediaType: isVideo ? "video" : "image" }
}

export async function insertTripClip(input: {
  tripId: string
  mediaUrl: string
  caption?: string
  mediaType?: "image" | "video"
}): Promise<TripClip> {
  const userId = await getCurrentUserId()
  if (!userId) throw new Error("로그인이 필요해요.")

  const tripId = String(input.tripId ?? "").trim()
  const mediaUrl = String(input.mediaUrl ?? "").trim()
  if (!tripId) throw new Error("연관 여행을 선택해 주세요.")
  if (!mediaUrl) throw new Error("미디어를 업로드해 주세요.")

  const client = createClient()
  const payload = {
    trip_id: tripId,
    user_id: userId,
    media_url: mediaUrl,
    caption: String(input.caption ?? "").trim(),
    media_type: input.mediaType === "video" ? "video" : "image",
  }

  const { data, error } = await client
    .from("trip_clips")
    .insert(payload)
    .select("id, trip_id, user_id, media_url, caption, media_type, created_at, trips:trip_id(title)")
    .single()

  if (error) {
    console.error("[insertTripClip]", error.message || error.details || error)
    throw new Error(formatError(error) || "클립 게시에 실패했어요.")
  }

  const clip = mapRow(data as TripClipRow)

  // 같은 여행의 다른 멤버들에게 새 클립 알림을 보낸다 (본인 제외).
  try {
    const roster = await fetchTripRoster(tripId)
    const recipients = roster
      .map((member) => member.userId)
      .filter((id) => id && id !== userId)
    if (recipients.length > 0) {
      const actorName = await resolveActorDisplayName(userId)
      const tripTitle = clip.tripTitle ? `'${clip.tripTitle}'에` : "여행에"
      await Promise.all(
        recipients.map((recipientId) =>
          createNotification(
            {
              userId: recipientId,
              actorId: userId,
              type: "clip_post",
              message: `${actorName}님이 ${tripTitle} 새 클립을 올렸습니다.`,
              referenceId: clip.id,
            },
            { throwOnError: false }
          )
        )
      )
    }
  } catch (err) {
    console.error(
      "[insertTripClip] notification fan-out error:",
      err instanceof Error ? err.message : err
    )
  }

  return clip
}

export async function deleteTripClip(clipId: string): Promise<void> {
  const id = String(clipId ?? "").trim()
  if (!id) throw new Error("삭제할 클립이 없어요.")

  const userId = await getCurrentUserId()
  if (!userId) throw new Error("로그인이 필요해요.")

  const client = createClient()

  // Ownership guard — only the author can delete
  const { data: row, error: lookupError } = await client
    .from("trip_clips")
    .select("id, user_id, media_url")
    .eq("id", id)
    .maybeSingle()

  if (lookupError) {
    console.error("[deleteTripClip] lookup:", lookupError.message || lookupError.details || lookupError)
    throw new Error(formatError(lookupError) || "클립을 찾지 못했어요.")
  }

  if (!row) throw new Error("클립을 찾을 수 없어요.")

  const ownerId = String((row as { user_id?: string }).user_id ?? "").trim()
  if (ownerId !== userId) {
    throw new Error("본인이 올린 클립만 삭제할 수 있어요.")
  }

  const { error } = await client.from("trip_clips").delete().eq("id", id).eq("user_id", userId)

  if (error) {
    console.error("[deleteTripClip]", error.message || error.details || error)
    throw new Error(formatError(error) || "클립 삭제에 실패했어요.")
  }

  // Best-effort storage cleanup (public URL → path under trip-clips bucket)
  const mediaUrl = String((row as { media_url?: string }).media_url ?? "").trim()
  const marker = "/trip-clips/"
  const idx = mediaUrl.indexOf(marker)
  if (idx >= 0) {
    const path = decodeURIComponent(mediaUrl.slice(idx + marker.length).split("?")[0] ?? "")
    if (path.startsWith(`${userId}/`)) {
      const { error: storageError } = await client.storage.from("trip-clips").remove([path])
      if (storageError) {
        console.warn("[deleteTripClip] storage cleanup:", storageError.message)
      }
    }
  }
}
