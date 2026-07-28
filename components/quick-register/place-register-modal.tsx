"use client"

import { useEffect, useState } from "react"
import { MapPinPlus, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { clearDocumentScrollLock } from "@/lib/clear-scroll-lock"

const PLACE_CATEGORIES = ["맛집", "카페", "바", "관광", "쇼핑", "기타"] as const

export type PlaceDraft = {
  name: string
  category: string
  address: string
  note: string
}

export function PlaceRegisterModal({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved?: (draft: PlaceDraft) => void
}) {
  const [name, setName] = useState("")
  const [category, setCategory] = useState<string>("맛집")
  const [address, setAddress] = useState("")
  const [note, setNote] = useState("")

  useEffect(() => {
    if (!open) return
    setName("")
    setCategory("맛집")
    setAddress("")
    setNote("")
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false)
    }
    window.addEventListener("keydown", onKey)
    document.body.style.overflow = "hidden"
    return () => {
      window.removeEventListener("keydown", onKey)
      clearDocumentScrollLock()
    }
  }, [open, onOpenChange])

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!name.trim()) return
    onSaved?.({
      name: name.trim(),
      category,
      address: address.trim(),
      note: note.trim(),
    })
    onOpenChange(false)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] mx-auto flex w-full max-w-md items-end sm:items-center">
      <button
        type="button"
        aria-label="모달 닫기"
        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-200 ease-out animate-in fade-in-0"
        data-no-press
        onClick={() => onOpenChange(false)}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="place-modal-title"
        className="relative z-10 flex max-h-[92dvh] w-full flex-col rounded-t-3xl border border-border bg-card shadow-2xl transform-gpu animate-in fade-in zoom-in-95 duration-200 ease-out sm:mx-4 sm:rounded-3xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <MapPinPlus className="size-4.5" />
            </span>
            <div>
              <h2 id="place-modal-title" className="text-base font-bold">
                장소 저장
              </h2>
              <p className="text-xs text-muted-foreground">위시리스트에 스팟을 추가해요</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="닫기"
            className="flex size-8 items-center justify-center rounded-full bg-secondary text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            <FieldGroup className="gap-4">
              <Field>
                <FieldLabel htmlFor="place-name">장소 이름</FieldLabel>
                <Input
                  id="place-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="예: 후시미이나리 신사"
                  className="rounded-xl"
                  required
                />
              </Field>
              <Field>
                <FieldLabel>카테고리</FieldLabel>
                <Select
                  items={PLACE_CATEGORIES.map((item) => ({ value: item, label: item }))}
                  value={category}
                  onValueChange={(value) => setCategory(value as string)}
                >
                  <SelectTrigger className="w-full rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLACE_CATEGORIES.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="place-address">주소 / 위치</FieldLabel>
                <Input
                  id="place-address"
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                  placeholder="예: Kyoto, Fushimi"
                  className="rounded-xl"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="place-note">메모</FieldLabel>
                <Textarea
                  id="place-note"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="가고 싶은 이유나 팁을 적어 주세요"
                  className="min-h-24 rounded-xl"
                />
              </Field>
            </FieldGroup>
          </div>

          <div className="border-t border-border px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <Button
              type="submit"
              disabled={!name.trim()}
              className="w-full rounded-full font-semibold"
            >
              장소 저장하기
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
