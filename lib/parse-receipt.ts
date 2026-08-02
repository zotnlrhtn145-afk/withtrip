export type ParsedReceiptItem = {
  title: string
  amount: number
  category: "식사" | "교통" | "숙소" | "쇼핑" | "기타"
  date: string
}

export type ParsedReceiptResult = {
  /** Always at least one entry — a normal single receipt returns a 1-item array. */
  items: ParsedReceiptItem[]
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

function normalizeItem(raw: unknown): ParsedReceiptItem {
  const item = (raw ?? {}) as Partial<ParsedReceiptItem>
  const category = item.category
  return {
    title: String(item.title ?? "").trim() || "영수증 지출",
    amount: Number(item.amount) || 0,
    category:
      category === "식사" || category === "교통" || category === "숙소" || category === "쇼핑"
        ? category
        : "기타",
    date: String(item.date ?? "").trim(),
  }
}

/**
 * Upload a receipt image to `/api/parse-receipt` and return structured items.
 * Handles both a single purchase receipt (1 item) and a card/bank statement
 * screenshot listing multiple transactions (N items).
 */
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

  const payload = (await response.json()) as { items?: unknown[]; error?: string }
  if (!response.ok) {
    throw new Error(payload.error || "영수증 분석에 실패했어요.")
  }

  const rawItems = Array.isArray(payload.items) ? payload.items : []
  const items = rawItems.map(normalizeItem).filter((item) => item.amount > 0)

  if (items.length === 0) {
    throw new Error("영수증에서 지출 내역을 찾지 못했어요.")
  }

  return { items }
}
