import { FLAGS, type FlagShape } from "@/shared/country-flags"

/**
 * 나라 국기 마크 (원형).
 *
 * ⚠️ **평소엔 흑백, 고른 것만 컬러.** 나라가 10개를 넘어가면 색이 줄줄이 서서
 *    위드트립의 앰버 톤과 다툰다. 흑백으로 두면 톤을 지키면서도
 *    고른 나라가 어디인지 한눈에 들어온다.
 */
export function CountryFlag({
  code,
  active,
  size = 16,
}: {
  code: string
  active?: boolean
  size?: number
}) {
  const flag = FLAGS[code]
  if (!flag) return null
  const id = `flagclip-${code}`

  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden
      className="shrink-0 transition-[filter,opacity] duration-200"
      style={{
        // 고르지 않았을 땐 색을 빼고 살짝 눌러 둔다
        filter: active ? "none" : "grayscale(1)",
        opacity: active ? 1 : 0.55,
      }}
    >
      <defs>
        <clipPath id={id}>
          <circle cx="12" cy="12" r="10.4" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id})`}>
        {flag.shapes.map((s, i) => (
          <Shape key={i} s={s} />
        ))}
      </g>
      <circle cx="12" cy="12" r="10.4" fill="none" stroke="rgba(15,23,42,.18)" strokeWidth="1.1" />
    </svg>
  )
}

function Shape({ s }: { s: FlagShape }) {
  switch (s.t) {
    case "rect":
      return <rect x={s.x ?? 0} y={s.y ?? 0} width={s.w} height={s.h} fill={s.c} />
    case "circle":
      return <circle cx={s.cx} cy={s.cy} r={s.r} fill={s.c} />
    case "ellipse":
      return (
        <ellipse
          cx={s.cx}
          cy={s.cy}
          rx={s.rx}
          ry={s.ry}
          fill={s.c}
          transform={s.rot ? `rotate(${s.rot} ${s.cx} ${s.cy})` : undefined}
        />
      )
    case "path":
      return <path d={s.d} fill={s.c} />
    case "line":
      return <path d={s.d} fill="none" stroke={s.c} strokeWidth={s.w} strokeLinecap="round" />
  }
}
