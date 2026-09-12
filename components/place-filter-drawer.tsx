"use client"

import { Dialog } from "@base-ui/react/dialog"
import { X } from "lucide-react"
import type { ReactNode } from "react"
import styles from "./place-filter-drawer.module.css"

/** 포커스/ESC/닫힘 모션을 가진 필터 전용 패널. 다른 화면 스타일은 건드리지 않는다. */
export function PlaceFilterDrawer({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  return <Dialog.Root open={open} onOpenChange={value => { if (!value) onClose() }}>
    <Dialog.Portal>
      <Dialog.Backdrop className={styles.backdrop} />
      <Dialog.Popup className={styles.panel}>
        <header className={styles.header}>
          <Dialog.Title className="text-[25px] font-bold tracking-tight text-slate-900">필터</Dialog.Title>
          <Dialog.Close aria-label="필터 닫기" className="flex size-11 items-center justify-center rounded-full text-slate-500"><X className="size-5" /></Dialog.Close>
        </header>
        {children}
      </Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>
}
