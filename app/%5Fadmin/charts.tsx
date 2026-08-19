/**
 * 관리자 화면의 그림들. 전부 손으로 그린 SVG다 — 차트 라이브러리를 하나 더
 * 들이면 웹 첫 화면이 그만큼 무거워지는데, 여기서 필요한 건 막대와 선뿐이다.
 *
 * ⚠️ **한 그림에 축은 하나.** 단위가 다른 두 값(예: 방문자와 비용)을 한 그림에
 *    겹쳐 그리면 축척을 마음대로 정하는 셈이라 아무 이야기나 만들어 낼 수 있다.
 *    비교가 필요하면 그림을 둘로 나눈다.
 */

type Point = { label: string; value: number; sub?: string }

/**
 * 날짜별 막대.
 * 마지막 칸(오늘)은 아직 안 끝난 날이라 호박색으로 따로 표시한다 —
 * 그냥 두면 "오늘 갑자기 줄었다"로 잘못 읽힌다.
 */
export function BarChart({
  data,
  height = 132,
  unit = "",
  highlightLast = false,
}: {
  data: Point[]
  height?: number
  unit?: string
  highlightLast?: boolean
}) {
  if (data.length === 0) return <div className="wt-empty">아직 쌓인 값이 없습니다</div>

  const W = 100 // 가로는 비율로 그린다 (viewBox)
  const H = height
  const pad = { t: 8, b: 16, l: 0, r: 0 }
  const max = Math.max(...data.map((d) => d.value), 1)
  const plotH = H - pad.t - pad.b
  const slot = W / data.length
  // 막대 사이에 바탕이 비쳐야 개수가 세어진다 — 가늘게, 사이를 띄운다
  const bw = Math.max(slot * 0.55, 0.6)

  return (
    /*
      ⚠️ 높이를 CSS 로 **못 박는다.** viewBox 만 주고 두면 SVG 는 가로세로 비율을
         지키려고 늘어나서, 카드 폭이 600px 일 때 높이가 800px 가 된다(실제로 그랬다).
    */
    <svg
      className="wt-chart"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      style={{ height: H }}
      role="img"
    >
      {/* 바닥선 */}
      <line className="axis" x1={0} y1={pad.t + plotH} x2={W} y2={pad.t + plotH} vectorEffect="non-scaling-stroke" />
      {data.map((d, i) => {
        const h = (d.value / max) * plotH
        const x = i * slot + (slot - bw) / 2
        const y = pad.t + plotH - h
        const last = highlightLast && i === data.length - 1
        return (
          <g key={d.label}>
            <title>
              {d.label} · {d.value.toLocaleString("ko-KR")}
              {unit}
              {d.sub ? ` · ${d.sub}` : ""}
              {last ? " (오늘 · 진행 중)" : ""}
            </title>
            {/* 눌러 볼 수 있는 자리를 막대보다 넓게 잡는다 */}
            <rect x={i * slot} y={pad.t} width={slot} height={plotH} fill="transparent" />
            <rect
              className={`bar${last ? " hi" : ""}`}
              x={x}
              y={y}
              width={bw}
              height={Math.max(h, d.value > 0 ? 1 : 0)}
              rx={0.7}
            />
          </g>
        )
      })}
    </svg>
  )
}

/** 날짜 눈금 — 막대 밑에 따로 깐다 (SVG 안에 넣으면 늘어나서 찌그러진다) */
export function BarAxis({ data, every = 5 }: { data: Point[]; every?: number }) {
  if (data.length === 0) return null
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${data.length}, 1fr)`,
        fontSize: 10,
        color: "var(--tx-3)",
        marginTop: 2,
      }}
    >
      {data.map((d, i) => (
        <span key={d.label} style={{ textAlign: "center", whiteSpace: "nowrap" }}>
          {i % every === 0 || i === data.length - 1 ? d.label : ""}
        </span>
      ))}
    </div>
  )
}

/** 타일 안에 들어가는 작은 선 그림 */
export function Sparkline({ values, height = 30 }: { values: number[]; height?: number }) {
  if (values.length < 2) return null
  const W = 100
  const H = height
  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const span = max - min || 1
  const x = (i: number) => (i / (values.length - 1)) * W
  const y = (v: number) => H - 2 - ((v - min) / span) * (H - 4)

  const d = values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(2)},${y(v).toFixed(2)}`).join(" ")
  const area = `${d} L${W},${H} L0,${H} Z`

  return (
    <svg
      className="wt-chart"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      style={{ height: H }}
      aria-hidden
    >
      <path className="area" d={area} />
      <path className="line" d={d} vectorEffect="non-scaling-stroke" />
      {/* 끝점을 찍어 "지금 여기"를 분명히 한다 */}
      <circle className="dot" cx={W} cy={y(values[values.length - 1])} r={2.2} vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

/** 가로 막대 — 분류끼리 견주어 볼 때 */
export function RankBars({
  rows,
  unit = "",
}: {
  rows: { label: string; value: number; note?: string }[]
  unit?: string
}) {
  if (rows.length === 0) return <div className="wt-empty">아직 쌓인 값이 없습니다</div>
  const max = Math.max(...rows.map((r) => r.value), 1)

  return (
    <div className="wt-bars">
      {rows.map((r) => (
        <div className="wt-barrow" key={r.label}>
          <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.label}</div>
          {/*
            ⚠️ `span` 이 아니라 `div` 다. inline 요소는 height 를 무시해서
               막대가 **아예 안 그려진다**(빈 회색 줄만 남는다).
          */}
          <div className="wt-track">
            <div className="wt-fill" style={{ width: `${Math.max((r.value / max) * 100, 1.5)}%` }} />
          </div>
          <div className="wt-num wt-muted">
            {r.value.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}
            {unit}
          </div>
        </div>
      ))}
    </div>
  )
}
