"use client"
import { useState } from "react"
import { Calendar } from "@/components/ui/calendar"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarDays } from "lucide-react"
import { formatDotDate } from "./date-time-field"

export function DateRangeField({ start, end, onChange, startLabel = "시작일", endLabel = "종료일", allowReverse = false }: { start?: Date; end?: Date; onChange: (start?: Date, end?: Date) => void; startLabel?: string; endLabel?: string; allowReverse?: boolean }) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState<"start" | "end">("start")
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger render={<Button type="button" variant="outline" className="h-auto min-h-12 w-full justify-start whitespace-normal text-left" />}><CalendarDays size={18} /><span>{startLabel} {start ? formatDotDate(start) : "선택"} → {endLabel} {end ? formatDotDate(end) : "선택"}</span></PopoverTrigger>
    <PopoverContent align="start" className="w-auto max-w-[95vw] p-3">
      <div className="flex gap-2">{(["start", "end"] as const).map(key => <Button key={key} type="button" variant={active === key ? "default" : "outline"} onClick={() => setActive(key)}>{key === "start" ? startLabel : endLabel}</Button>)}</div>
      <Calendar mode="single" selected={active === "start" ? start : end} defaultMonth={start || end} modifiers={{ range_start: start ? [start] : [], range_end: end ? [end] : [], range_middle: start && end ? { after: start < end ? start : end, before: start < end ? end : start } : [] }} formatters={{ formatWeekdayName: d => d.toLocaleDateString("ko-KR", { weekday: "narrow" }), formatCaption: d => `${d.getFullYear()}년 ${d.getMonth() + 1}월` }} onSelect={day => {
        if (!day) return
        if (active === "start") { onChange(day, !allowReverse && end && end < day ? undefined : end); setActive("end") }
        else if (!allowReverse && start && day < start) onChange(day, undefined)
        else onChange(start, day)
      }} />
      <p className="max-w-72 text-xs leading-5 text-neutral-500">{allowReverse ? "출발·도착지의 현지 날짜를 선택해 주세요. 시차로 도착 날짜가 빠를 수도 있어요." : "시작일을 고른 뒤 종료일을 눌러 주세요."}</p>
      <div className="mt-3 flex justify-between"><Button type="button" variant="ghost" onClick={() => { onChange(undefined, undefined); setActive("start") }}>비우기</Button><Button type="button" onClick={() => setOpen(false)}>날짜 적용</Button></div>
    </PopoverContent>
  </Popover>
}
