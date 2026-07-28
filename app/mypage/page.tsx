import { redirect } from "next/navigation"

export default function MyPageRoute() {
  redirect("/?nav=mypage")
}
