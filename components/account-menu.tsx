"use client"

import { LogIn, LogOut, UserRound } from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { demoUser } from "@/lib/auth-data"

export function AccountMenu({
  isLoggedIn,
  compact = false,
  onLoginClick,
  onMyPageClick,
  onLogout,
}: {
  isLoggedIn: boolean
  compact?: boolean
  onLoginClick: () => void
  onMyPageClick: () => void
  onLogout: () => void
}) {
  if (!isLoggedIn) {
    return (
      <Button
        size={compact ? "sm" : "default"}
        onClick={onLoginClick}
        className="rounded-full font-bold"
      >
        <LogIn data-icon="inline-start" />
        {compact ? "로그인" : "로그인 / 회원가입"}
      </Button>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            className="h-auto gap-2 rounded-full py-1 pr-3 pl-1 font-semibold"
            aria-label="내 계정 메뉴"
          >
            <Avatar className="size-7">
              <AvatarFallback className="bg-primary text-[11px] font-bold text-primary-foreground">
                {demoUser.initials}
              </AvatarFallback>
            </Avatar>
            {compact ? null : <span className="text-sm">{demoUser.name} 님</span>}
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold">{demoUser.name} 님</span>
            <span className="text-xs font-normal text-muted-foreground">{demoUser.email}</span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={onMyPageClick}>
            <UserRound />
            마이페이지
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onLogout}>
            <LogOut />
            로그아웃
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
