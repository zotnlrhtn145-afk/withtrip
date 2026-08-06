// withtrip 앱 아이콘 생성 — 앰버(#fbbf24) 배경 + 로그인 화면과 동일한 Ionicons "compass" 글리프(#0f172a).
// 웹 repo의 sharp 로 SVG→PNG 변환해 앱 assets 에 출력.
const sharp = require("sharp")
const path = require("path")

const APP = "/Users/ohsuhwan/withtrip-app/assets/images"
const AMBER = "#fbbf24"
const INK = "#0f172a"

// Ionicons v7 "compass" 원본 (viewBox 512). 바늘은 evenodd 로 구멍 처리 → 배경색이 비쳐 나침반 바늘 모양.
const COMPASS_PATH =
  "M256 48C141.31 48 48 141.31 48 256s93.31 208 208 208 208-93.31 208-208S370.69 48 256 48zm105.07 113.33l-46.88 117.2a64 64 0 01-35.66 35.66l-117.2 46.88a8 8 0 01-10.4-10.4l46.88-117.2a64 64 0 0135.66-35.66l117.2-46.88a8 8 0 0110.4 10.4z"

// 512 글리프를 1024 캔버스 중앙에 sizeFrac 비율로 배치
function compassGlyph(ink, sizeFrac) {
  const S = (1024 * sizeFrac) / 512
  return `<g transform="translate(512 512) scale(${S}) translate(-256 -256)" fill="${ink}" fill-rule="evenodd">
    <path d="${COMPASS_PATH}"/>
    <circle cx="256" cy="256" r="24"/>
  </g>`
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
  // iOS/기본 아이콘: 앰버 풀블리드 + 다크 나침반 (iOS가 자동으로 라운드 마스킹 → 로그인 배지와 동일한 룩)
  await out("icon.png", svg(compassGlyph(INK, 0.64), AMBER))

  // 안드로이드 적응형 전경: 투명 + 다크 나침반(세이프존 위해 축소). 배경색은 app.json 에서 앰버.
  await out("android-icon-foreground.png", svg(compassGlyph(INK, 0.52), null))

  // 안드로이드 모노크롬(테마 아이콘): 투명 + 단색 나침반
  await out("android-icon-monochrome.png", svg(compassGlyph("#000000", 0.52), null))

  // 스플래시 엠블럼: 투명 + 다크 나침반(앰버 배경 위)
  await out("splash-icon.png", svg(compassGlyph(INK, 0.66), null))

  console.log("done")
})()
