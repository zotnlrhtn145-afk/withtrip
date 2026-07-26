"use client"

import { Button } from "@/components/ui/button"
import { FieldSeparator } from "@/components/ui/field"

const providers = [
  { id: "kakao", label: "카카오로 계속하기", icon: "/icons/kakao.svg" },
  { id: "google", label: "구글로 계속하기", icon: "/icons/google.svg" },
]

export function SocialLoginButtons({ onSocialLogin }: { onSocialLogin: () => void }) {
  return (
    <div className="flex flex-col gap-4">
      <FieldSeparator>또는</FieldSeparator>

      <div className="flex flex-col gap-2">
        {providers.map((provider) => (
          <Button
            key={provider.id}
            type="button"
            variant="outline"
            size="lg"
            onClick={onSocialLogin}
            className="w-full justify-center rounded-xl font-semibold"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={provider.icon || "/placeholder.svg"}
              alt=""
              width={18}
              height={18}
              aria-hidden="true"
              className="size-4.5 shrink-0"
            />
            {provider.label}
          </Button>
        ))}
      </div>
    </div>
  )
}
