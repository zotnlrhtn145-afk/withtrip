"use client"

import { useState } from "react"
import { CalendarDays } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

export function formatDotDate(date: Date) {
  const month = `${date.getMonth() + 1}`.padStart(2, "0")
  const day = `${date.getDate()}`.padStart(2, "0")
  return `${date.getFullYear()}.${month}.${day}`
}

export function DateTimeField({
  id,
  label,
  date,
  time,
  onDateChange,
  onTimeChange,
  placeholder = "날짜 선택",
}: {
  id: string
  label: string
  date: Date | undefined
  time: string
  onDateChange: (next: Date | undefined) => void
  onTimeChange: (next: string) => void
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)

  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className="flex gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger
            render={
              <Button
                id={id}
                type="button"
                variant="outline"
                className="min-w-0 flex-1 justify-start rounded-xl font-medium tabular-nums"
              />
            }
          >
            <CalendarDays data-icon="inline-start" />
            <span className="truncate">{date ? formatDotDate(date) : placeholder}</span>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto p-0">
            <Calendar
              mode="single"
              selected={date}
              formatters={{
                formatWeekdayName: (value) =>
                  value.toLocaleDateString("ko-KR", { weekday: "narrow" }),
                formatCaption: (value) => `${value.getFullYear()}년 ${value.getMonth() + 1}월`,
              }}
              onSelect={(next) => {
                onDateChange(next)
                if (next) setOpen(false)
              }}
              autoFocus
            />
          </PopoverContent>
        </Popover>
        <Input
          type="time"
          aria-label={`${label} 시간`}
          value={time}
          onChange={(event) => onTimeChange(event.target.value)}
          className="w-28 shrink-0 rounded-xl tabular-nums"
        />
      </div>
    </Field>
  )
}
