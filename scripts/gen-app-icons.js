// withtrip 앱 아이콘 생성 — 앰버(#fbbf24) 배경 + 다크(#0f172a) 나침반.
// 웹 repo의 sharp 로 SVG→PNG 변환해 앱 assets 에 출력.
const sharp = require("sharp")
const path = require("path")

const APP = "/Users/ohsuhwan/withtrip-app/assets/images"
const AMBER = "#fbbf24"
const INK = "#0f172a"

// 나침반 엠블럼(1024 뷰박스): 링 + 4방위 점 + N/S 이색 바늘 + 중심 축
function compass({ ink = INK, hole = AMBER, scale = 1 }) {
  // 방위점 (N·E·S·W)
  const dots = [
    [512, 208],
    [816, 512],
    [512, 816],
    [208, 512],
  ]
    .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="17" fill="${ink}"/>`)
    .join("")
  const g = `
    <g fill="none" stroke="${ink}" stroke-width="32"><circle cx="512" cy="512" r="360"/></g>
    ${dots}
    <path d="M512 250 L550 512 L474 512 Z" fill="${ink}"/>
    <path d="M512 774 L550 512 L474 512 Z" fill="${hole}" stroke="${ink}" stroke-width="18" stroke-linejoin="round"/>
    <circle cx="512" cy="512" r="44" fill="${hole}"/>
    <circle cx="512" cy="512" r="44" fill="none" stroke="${ink}" stroke-width="16"/>`
  if (scale === 1) return g
  return `<g transform="translate(512 512) scale(${scale}) translate(-512 -512)">${g}</g>`
}

function svg(inner, bg) {
  return `<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">${
    bg ? `<rect width="1024" height="1024" fill="${bg}"/>` : ""
  }${inner}</svg>`
}

async function out(name, markup) {
  const p = path.join(APP, name)
  await sharp(Buffer.from(markup)).png().toFile(p)
  console.log("✓", p)
}

;(async () => {
  // iOS/기본 아이콘: 앰버 풀블리드 + 다크 나침반
  await out("icon.png", svg(compass({}), AMBER))

  // 안드로이드 적응형 전경: 투명 + 다크 나침반(세이프존 위해 62% 축소). 배경색은 app.json 에서 앰버.
  await out("android-icon-foreground.png", svg(compass({ scale: 0.62 }), null))

  // 안드로이드 모노크롬(테마 아이콘): 투명 + 단색 나침반
  await out(
    "android-icon-monochrome.png",
    svg(compass({ ink: "#000000", hole: "#00000000", scale: 0.62 }), null)
  )

  // 스플래시 엠블럼: 투명 + 다크 나침반(흰 배경 위에서 보임)
  await out("splash-icon.png", svg(compass({ scale: 0.8 }), null))

  console.log("done")
})()
