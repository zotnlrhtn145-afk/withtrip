"use client"

import { AnimatePresence, motion } from "framer-motion"
import { Plane } from "lucide-react"

export function LoginRedirectOverlay({
  open,
  message = "로그인이 필요한 서비스입니다",
}: {
  open: boolean
  message?: string
}) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="login-redirect-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
          className="fixed inset-0 z-[100] bg-white/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center"
        >
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.05 }}
            className="text-gray-500 font-medium text-sm mb-4 animate-fade-in"
          >
            {message}
          </motion.p>

          <motion.div
            initial={{ scale: 0.86, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 18 }}
            className="relative"
          >
            <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-amber-400 via-rose-400 to-amber-500 opacity-40 blur-md animate-pulse" />
            <div className="relative rounded-full bg-gradient-to-tr from-amber-400 via-rose-400 to-amber-500 p-[2.5px] shadow-md animate-pulse">
              <span className="flex size-20 items-center justify-center rounded-full bg-white animate-bounce">
                <Plane className="size-8 text-amber-500" />
              </span>
            </div>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.45, delay: 0.2 }}
            className="text-xs text-gray-400 mt-6"
          >
            잠시 후 로그인 화면으로 이동합니다...
          </motion.p>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
