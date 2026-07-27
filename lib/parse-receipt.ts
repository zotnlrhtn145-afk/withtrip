export type ParsedReceiptResult = {
  title: string
  amount: number
  category: "식사" | "교통" | "숙소" | "쇼핑" | "기타"
  date: string
}

async function fileToBase64DataUrl(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ""
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  const base64 = btoa(binary)
  const mimeType = file.type || "image/jpeg"
  return `data:${mimeType};base64,${base64}`
}

/** Upload a receipt image to `/api/parse-receipt` and return structured fields. */
export async function parseReceiptImage(file: File): Promise<ParsedReceiptResult> {
  const imageBase64 = await fileToBase64DataUrl(file)
  const response = await fetch("/api/parse-receipt", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      imageBase64,
      mimeType: file.type || "image/jpeg",
    }),
  })

  const payload = (await response.json()) as ParsedReceiptResult & { error?: string }
  if (!response.ok) {
    throw new Error(payload.error || "영수증 분석에 실패했어요.")
  }

  return {
    title: String(payload.title ?? "").trim() || "영수증 지출",
    amount: Number(payload.amount) || 0,
    category: payload.category,
    date: String(payload.date ?? "").trim(),
  }
}
