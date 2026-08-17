/**
 * 인스타그램 마크.
 *
 * ⚠️ lucide-react 에는 브랜드 아이콘이 없다. 앱은 Ionicons 의 `logo-instagram` 을
 *    쓰므로 같은 모양(둥근 사각 + 원 + 점)으로 맞춘다 — 양쪽이 달라 보이면 안 된다.
 */
export function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  )
}
