// Google Play 등록용 이미지 에셋 생성 — 512 아이콘 + 1024x500 피처 그래픽.
const sharp = require("sharp")
const path = require("path")

const OUT = "/Users/ohsuhwan/withtrip-app/build-artifacts"
const AMBER = "#fbbf24"
const INK = "#0f172a"
const COMPASS =
  "M256 48C141.31 48 48 141.31 48 256s93.31 208 208 208 208-93.31 208-208S370.69 48 256 48zm105.07 113.33l-46.88 117.2a64 64 0 01-35.66 35.66l-117.2 46.88a8 8 0 01-10.4-10.4l46.88-117.2a64 64 0 0135.66-35.66l117.2-46.88a8 8 0 0110.4 10.4z"

// 512 글리프를 지정 박스(size)에 맞춰 배치 (cx,cy 중심)
function compassAt(cx, cy, size, ink) {
  const s = size / 512
  return `<g transform="translate(${cx} ${cy}) scale(${s}) translate(-256 -256)" fill="${ink}" fill-rule="evenodd">
    <path d="${COMPASS}"/><circle cx="256" cy="256" r="24"/></g>`
}

async function render(name, w, h, inner) {
  const svg = `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`
  const p = path.join(OUT, name)
  await sharp(Buffer.from(svg)).png().toFile(p)
  console.log("✓", p)
}

;(async () => {
  // 1) 512x512 하이레졸루션 아이콘 (앰버 + 나침반)
  await render("play-icon-512.png", 512, 512, `<rect width="512" height="512" fill="${AMBER}"/>${compassAt(256, 256, 328, INK)}`)

  // 2) 1024x500 피처 그래픽 — 흰 배경 + 앰버 배지 나침반 + 텍스트
  const FONT = "Apple SD Gothic Neo, AppleGothic, sans-serif"
  await render(
    "play-feature-1024x500.png",
    1024,
    500,
    `
    <rect width="1024" height="500" fill="#ffffff"/>
    <rect x="96" y="150" width="200" height="200" rx="52" fill="${AMBER}"/>
    ${compassAt(196, 250, 132, INK)}
    <text x="360" y="248" font-family="${FONT}" font-size="88" font-weight="800" fill="${INK}" letter-spacing="2">WITHTRIP</text>
    <text x="362" y="320" font-family="${FONT}" font-size="36" font-weight="600" fill="#64748b">함께 떠나는 여행 플래너</text>
    `
  )
  console.log("done")
})()
