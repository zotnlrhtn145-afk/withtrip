"use client"

import { useEffect, useId, useMemo, useRef, useState } from "react"
import { Check, ChevronDown, Loader2, Search } from "lucide-react"

import { cn } from "@/lib/utils"

export type SearchableOption = {
  /** Stable key for list rendering (e.g. Google place_id). */
  id?: string
  value: string
  label: string
  description?: string
}

function safeLower(value: unknown) {
  return String(value ?? "").toLowerCase()
}

function safeText(value: unknown) {
  return String(value ?? "")
}

export function SearchableSelect({
  id,
  value,
  onChange,
  options,
  placeholder,
  emptyText = "검색 결과가 없어요",
  idleText,
  loading = false,
  loadingText = "검색 중…",
  filterLocally = true,
  allowCustom = false,
  customHint,
  disabled = false,
  className,
  inputClassName,
  onSelectOption,
  onQueryChange,
}: {
  id?: string
  value: string
  onChange: (value: string) => void
  options?: SearchableOption[] | null
  placeholder?: string
  emptyText?: string
  /** Shown when the input is empty (instead of listing all options). */
  idleText?: string
  loading?: boolean
  loadingText?: string
  /** When false, options are shown as provided (for remote search). */
  filterLocally?: boolean
  /** Keep free-text values that are not in the option list. */
  allowCustom?: boolean
  customHint?: string
  disabled?: boolean
  className?: string
  inputClassName?: string
  /** Fired when the user picks an item from the dropdown (not free-text typing). */
  onSelectOption?: (option: SearchableOption) => void
  /** Fired on every input change (useful for remote debounce). */
  onQueryChange?: (query: string) => void
}) {
  const listId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const safeValue = safeText(value)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(safeValue)
  const optionList = useMemo(
    () =>
      (options ?? []).filter(
        (option): option is SearchableOption =>
          Boolean(option) && option.value != null && option.label != null
      ),
    [options]
  )

  useEffect(() => {
    setQuery(safeValue)
  }, [safeValue])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
        setQuery(safeValue)
      }
    }
    const onKey = (event: KeyboardEvent) => {
      if ((event.key ?? "") === "Escape") {
        setOpen(false)
        setQuery(safeValue)
      }
    }
    window.addEventListener("mousedown", onPointerDown)
    window.addEventListener("keydown", onKey)
    return () => {
      window.removeEventListener("mousedown", onPointerDown)
      window.removeEventListener("keydown", onKey)
    }
  }, [open, safeValue])

  const queryTrimmed = safeText(query).trim()
  const isIdle = queryTrimmed.length === 0

  const filtered = useMemo(() => {
    if (isIdle) return idleText ? [] : optionList
    if (!filterLocally) return optionList
    const q = safeLower(queryTrimmed)
    return optionList.filter((option) =>
      safeLower([option.label, option.value, option.description ?? ""].join(" ")).includes(q)
    )
  }, [optionList, queryTrimmed, isIdle, idleText, filterLocally])

  const exactMatch = optionList.some(
    (option) => safeLower(option.value) === safeLower(queryTrimmed)
  )

  const commitCustom = () => {
    const next = safeText(query).trim()
    if (!allowCustom) {
      setQuery(safeValue)
      setOpen(false)
      return
    }
    onChange(next)
    setOpen(false)
  }

  const selectOption = (option: SearchableOption) => {
    const next = safeText(option.value)
    onChange(next)
    onSelectOption?.(option)
    setQuery(next)
    setOpen(false)
  }

  const statusMessage = loading
    ? loadingText
    : isIdle && idleText
      ? idleText
      : emptyText

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          id={id}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          disabled={disabled}
          value={safeText(query)}
          placeholder={placeholder}
          autoComplete="off"
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onChange={(event) => {
            const next = event.target.value ?? ""
            setQuery(next)
            setOpen(true)
            onQueryChange?.(next)
            if (allowCustom) onChange(next)
          }}
          onKeyDown={(event) => {
            if ((event.key ?? "") !== "Enter") return
            event.preventDefault()
            if (filtered[0] && !allowCustom) {
              selectOption(filtered[0])
              return
            }
            if (filtered[0] && safeText(query).trim() === "") {
              selectOption(filtered[0])
              return
            }
            if (allowCustom) commitCustom()
            else if (filtered[0]) selectOption(filtered[0])
          }}
          onBlur={() => {
            window.setTimeout(() => {
              if (!rootRef.current?.contains(document.activeElement)) {
                if (allowCustom) {
                  onChange(safeText(query).trim())
                } else if (!exactMatch && safeText(query).trim() !== safeValue) {
                  setQuery(safeValue)
                }
                setOpen(false)
              }
            }, 120)
          }}
          className={cn(
            "flex h-9 w-full rounded-xl border border-input bg-transparent py-2 pr-9 pl-9 text-sm outline-none transition-colors",
            "placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
            "disabled:cursor-not-allowed disabled:opacity-50",
            inputClassName
          )}
        />
        <ChevronDown
          className={cn(
            "pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground transition-transform",
            open && "rotate-180"
          )}
        />
      </div>

      {open ? (
        <div
          id={listId}
          role="listbox"
          className="absolute z-50 mt-1.5 max-h-56 w-full overflow-y-auto rounded-xl border border-border bg-popover p-1.5 shadow-md ring-1 ring-foreground/5"
        >
          {loading || filtered.length === 0 ? (
            <div className="px-3 py-3 text-center text-xs text-muted-foreground">
              <p className="inline-flex items-center justify-center gap-1.5">
                {loading ? <Loader2 className="size-3.5 animate-spin" /> : null}
                {statusMessage}
              </p>
              {allowCustom && !loading && !isIdle ? (
                <button
                  type="button"
                  className="mt-2 w-full rounded-lg bg-secondary px-3 py-2 text-left text-sm font-medium text-foreground transition-colors hover:bg-primary/15"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={commitCustom}
                >
                  “{queryTrimmed}” 직접 사용
                </button>
              ) : null}
            </div>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {filtered.map((option) => {
                const selected = option.value === safeValue
                return (
                  <li key={option.id ?? `${option.value}:${option.description ?? ""}`}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors",
                        selected
                          ? "bg-primary/20 text-foreground"
                          : "hover:bg-primary/15 hover:text-foreground"
                      )}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => selectOption(option)}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{option.label}</span>
                        {option.description ? (
                          <span className="block truncate text-[11px] text-muted-foreground">
                            {option.description}
                          </span>
                        ) : null}
                      </span>
                      {selected ? <Check className="size-4 shrink-0 text-primary" /> : null}
                    </button>
                  </li>
                )
              })}
              {allowCustom && queryTrimmed && !exactMatch ? (
                <li>
                  <button
                    type="button"
                    className="mt-0.5 flex w-full items-center rounded-lg border border-dashed border-border px-2.5 py-2 text-left text-sm transition-colors hover:bg-primary/15"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={commitCustom}
                  >
                    <span className="text-muted-foreground">직접 입력 · </span>
                    <span className="ml-1 font-medium">{queryTrimmed}</span>
                  </button>
                </li>
              ) : null}
            </ul>
          )}
          {customHint && allowCustom ? (
            <p className="border-t border-border px-2.5 pt-2 pb-1 text-[11px] text-muted-foreground">
              {customHint}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
