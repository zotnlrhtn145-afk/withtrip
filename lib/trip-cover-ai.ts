import { getCurrentUserId } from "@/lib/auth-session"
import { createClient } from "@/utils/supabase/client"

export type GenerateTripCoverInput = {
  city?: string
  country?: string
  title?: string
  location?: string
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const byteChars = atob(base64)
  const byteNumbers = new Array(byteChars.length)
  for (let i = 0; i < byteChars.length; i += 1) {
    byteNumbers[i] = byteChars.charCodeAt(i)
  }
  return new Blob([new Uint8Array(byteNumbers)], { type: mimeType })
}

/**
 * AI로 그 도시/국가의 가장 상징적인 여행 스팟을 시네마틱하게 그려 Storage에
 * 업로드하고 public URL을 반환한다. 실패하거나 시간 초과되면 null (호출부에서
 * 기존 큐레이션 커버로 폴백).
 */
export async function generateTripCoverImage(
  input: GenerateTripCoverInput
): Promise<string | null> {
  try {
    // Runs in the background (never blocks trip creation), so it can afford
    // to wait out a slow or momentarily overloaded image model.
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 90000)

    // 토큰을 같이 보내면 **서버가 Storage 업로드까지 끝내고 URL 만 준다.**
    // (앱도 같은 방식으로 부른다 — 한쪽만 구현되어 어긋나는 일이 없도록)
    const supabaseForToken = createClient()
    const { data: sessionData } = await supabaseForToken.auth.getSession()
    const accessToken = sessionData.session?.access_token

    let response: Response
    try {
      response = await fetch("/api/generate-trip-cover", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify(input),
        signal: controller.signal,
      })
    } finally {
      window.clearTimeout(timeout)
    }

    if (!response.ok) {
      console.warn("[generateTripCoverImage] API error:", await response.text())
      return null
    }

    const { imageUrl, imageBase64, mimeType } = (await response.json()) as {
      imageUrl?: string
      imageBase64?: string
      mimeType?: string
    }

    // 서버가 올려줬으면 그대로 쓴다
    if (imageUrl) return imageUrl

    // 못 올렸을 때만 예전 방식(브라우저가 직접 업로드)으로 돌아간다
    if (!imageBase64) return null

    const userId = await getCurrentUserId(null)
    if (!userId) return null

    const resolvedMimeType = mimeType || "image/png"
    const ext = resolvedMimeType.split("/")[1]?.replace(/[^a-z0-9]/gi, "") || "png"
    const path = `${userId}/${Date.now()}-${Math.random().toString(16).slice(2)}.${ext}`
    const blob = base64ToBlob(imageBase64, resolvedMimeType)

    const supabase = createClient()
    const { error: uploadError } = await supabase.storage
      .from("trip-covers")
      .upload(path, blob, {
        cacheControl: "31536000",
        upsert: false,
        contentType: resolvedMimeType,
      })

    if (uploadError) {
      console.warn("[generateTripCoverImage] upload failed:", uploadError.message)
      return null
    }

    const { data } = supabase.storage.from("trip-covers").getPublicUrl(path)
    return String(data.publicUrl ?? "").trim() || null
  } catch (err) {
    console.warn("[generateTripCoverImage] unexpected:", err)
    return null
  }
}
