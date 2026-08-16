/**
 * 나라 마크 — 국기.
 *
 * ⚠️ 이모지를 쓰지 않는다. 기기마다 모양이 다르고, 안드로이드는 아예 안 나오는 경우가 있다.
 *    직접 그린 도형이라 어느 크기에서도 또렷하다.
 *
 * **평소엔 흑백, 고른 것만 컬러.** 나라가 10개를 넘어가면 색이 줄줄이 서서
 * 위드트립의 앰버 톤과 다툰다. 흑백으로 두면 톤을 지키면서도
 * 고른 나라가 어디인지 한눈에 들어온다.
 *
 * 웹과 앱이 같은 도형을 그려야 해서 **모양만 데이터로** 두고,
 * 그리는 건 각 플랫폼이 맡는다(웹은 <svg>, 앱은 react-native-svg).
 */

export type FlagShape =
  | { t: "rect"; x?: number; y?: number; w: number; h: number; c: string }
  | { t: "circle"; cx: number; cy: number; r: number; c: string }
  | { t: "ellipse"; cx: number; cy: number; rx: number; ry: number; c: string; rot?: number }
  | { t: "path"; d: string; c: string }
  | { t: "line"; d: string; c: string; w: number }

export type Flag = {
  /** 한국어 나라 이름 — 칩에 그대로 쓴다 */
  name: string
  shapes: FlagShape[]
}

/** 24×24 기준. 원형으로 잘라 쓴다. */
export const FLAGS: Record<string, Flag> = {
  KR: {
    name: "대한민국",
    shapes: [
      { t: "rect", w: 24, h: 24, c: "#ffffff" },
      { t: "path", d: "M6.6 12a2.7 2.7 0 0 1 5.4 0 2.7 2.7 0 0 0 5.4 0 5.4 5.4 0 0 1-10.8 0z", c: "#0047a0" },
      { t: "path", d: "M6.6 12a5.4 5.4 0 0 1 10.8 0 2.7 2.7 0 0 0-5.4 0 2.7 2.7 0 0 1-5.4 0z", c: "#cd2e3a" },
      { t: "line", d: "M3.1 6.6 5.2 4.9M3.9 7.6 6 5.9M18 18.1l2.1-1.7M18.8 19.1l2.1-1.7", c: "#111827", w: 0.85 },
    ],
  },
  JP: {
    name: "일본",
    shapes: [
      { t: "rect", w: 24, h: 24, c: "#ffffff" },
      { t: "circle", cx: 12, cy: 12, r: 5.6, c: "#bc002d" },
    ],
  },
  VN: {
    name: "베트남",
    shapes: [
      { t: "rect", w: 24, h: 24, c: "#da251d" },
      { t: "path", d: "M12 5.6 13.7 10.6h5.2l-4.2 3.1 1.6 5-4.3-3.1-4.3 3.1 1.6-5-4.2-3.1h5.2z", c: "#ffff00" },
    ],
  },
  TH: {
    name: "태국",
    shapes: [
      { t: "rect", w: 24, h: 24, c: "#a51931" },
      { t: "rect", y: 4.4, w: 24, h: 15.2, c: "#f4f5f8" },
      { t: "rect", y: 8.4, w: 24, h: 7.2, c: "#2d2a4a" },
    ],
  },
  SG: {
    name: "싱가포르",
    shapes: [
      { t: "rect", w: 24, h: 24, c: "#ffffff" },
      { t: "rect", w: 24, h: 12, c: "#ed2939" },
      { t: "circle", cx: 7.6, cy: 6, r: 3.6, c: "#ffffff" },
      { t: "circle", cx: 9, cy: 6, r: 3.3, c: "#ed2939" },
      { t: "circle", cx: 12.3, cy: 3.9, r: 0.8, c: "#ffffff" },
      { t: "circle", cx: 14, cy: 5.7, r: 0.8, c: "#ffffff" },
      { t: "circle", cx: 13.3, cy: 8, r: 0.8, c: "#ffffff" },
      { t: "circle", cx: 11.3, cy: 8, r: 0.8, c: "#ffffff" },
      { t: "circle", cx: 10.6, cy: 5.7, r: 0.8, c: "#ffffff" },
    ],
  },
  HK: {
    name: "홍콩",
    shapes: [
      { t: "rect", w: 24, h: 24, c: "#de2910" },
      { t: "ellipse", cx: 12, cy: 7.4, rx: 1.45, ry: 3.3, c: "#ffffff" },
      { t: "ellipse", cx: 16.3, cy: 10.7, rx: 1.45, ry: 3.3, c: "#ffffff", rot: 72 },
      { t: "ellipse", cx: 14.6, cy: 15.7, rx: 1.45, ry: 3.3, c: "#ffffff", rot: 144 },
      { t: "ellipse", cx: 9.4, cy: 15.7, rx: 1.45, ry: 3.3, c: "#ffffff", rot: 216 },
      { t: "ellipse", cx: 7.7, cy: 10.7, rx: 1.45, ry: 3.3, c: "#ffffff", rot: 288 },
    ],
  },
  US: {
    name: "미국",
    shapes: [
      { t: "rect", w: 24, h: 24, c: "#ffffff" },
      { t: "rect", y: 0, w: 24, h: 1.85, c: "#b22234" },
      { t: "rect", y: 3.7, w: 24, h: 1.85, c: "#b22234" },
      { t: "rect", y: 7.4, w: 24, h: 1.85, c: "#b22234" },
      { t: "rect", y: 11.1, w: 24, h: 1.85, c: "#b22234" },
      { t: "rect", y: 14.8, w: 24, h: 1.85, c: "#b22234" },
      { t: "rect", y: 18.5, w: 24, h: 1.85, c: "#b22234" },
      { t: "rect", y: 22.2, w: 24, h: 1.85, c: "#b22234" },
      { t: "rect", w: 11, h: 10.5, c: "#3c3b6e" },
      { t: "circle", cx: 2.4, cy: 2.3, r: 0.75, c: "#ffffff" },
      { t: "circle", cx: 5.5, cy: 2.3, r: 0.75, c: "#ffffff" },
      { t: "circle", cx: 8.6, cy: 2.3, r: 0.75, c: "#ffffff" },
      { t: "circle", cx: 3.9, cy: 4.6, r: 0.75, c: "#ffffff" },
      { t: "circle", cx: 7.1, cy: 4.6, r: 0.75, c: "#ffffff" },
      { t: "circle", cx: 2.4, cy: 7, r: 0.75, c: "#ffffff" },
      { t: "circle", cx: 5.5, cy: 7, r: 0.75, c: "#ffffff" },
      { t: "circle", cx: 8.6, cy: 7, r: 0.75, c: "#ffffff" },
    ],
  },
  FR: {
    name: "프랑스",
    shapes: [
      { t: "rect", w: 8, h: 24, c: "#002395" },
      { t: "rect", x: 8, w: 8, h: 24, c: "#ffffff" },
      { t: "rect", x: 16, w: 8, h: 24, c: "#ed2939" },
    ],
  },
  DE: {
    name: "독일",
    shapes: [
      { t: "rect", w: 24, h: 8, c: "#1f2937" },
      { t: "rect", y: 8, w: 24, h: 8, c: "#dd0000" },
      { t: "rect", y: 16, w: 24, h: 8, c: "#ffce00" },
    ],
  },
  BE: {
    name: "벨기에",
    shapes: [
      { t: "rect", w: 8, h: 24, c: "#1f2937" },
      { t: "rect", x: 8, w: 8, h: 24, c: "#fdda24" },
      { t: "rect", x: 16, w: 8, h: 24, c: "#ef3340" },
    ],
  },
  AU: {
    name: "오스트레일리아",
    shapes: [
      { t: "rect", w: 24, h: 24, c: "#00247d" },
      { t: "line", d: "M0 0 11 6M11 0 0 6", c: "#ffffff", w: 2.4 },
      { t: "line", d: "M5.5 0v6M0 3h11", c: "#ffffff", w: 2 },
      { t: "line", d: "M5.5 0v6M0 3h11", c: "#ff0000", w: 0.9 },
      { t: "circle", cx: 6.5, cy: 16.5, r: 1.45, c: "#ffffff" },
      { t: "circle", cx: 17, cy: 6.5, r: 0.9, c: "#ffffff" },
      { t: "circle", cx: 19.4, cy: 12, r: 0.9, c: "#ffffff" },
      { t: "circle", cx: 16.5, cy: 17.4, r: 0.9, c: "#ffffff" },
      { t: "circle", cx: 14, cy: 11, r: 0.65, c: "#ffffff" },
    ],
  },
  CN: {
    name: "중국",
    shapes: [
      { t: "rect", w: 24, h: 24, c: "#de2910" },
      { t: "path", d: "M6.4 4.2 7.5 7.5h3.4l-2.8 2 1.1 3.3-2.8-2-2.8 2 1.1-3.3-2.8-2h3.4z", c: "#ffde00" },
      { t: "circle", cx: 13.2, cy: 4.4, r: 1, c: "#ffde00" },
      { t: "circle", cx: 15.6, cy: 6.6, r: 1, c: "#ffde00" },
      { t: "circle", cx: 15.6, cy: 9.8, r: 1, c: "#ffde00" },
      { t: "circle", cx: 13.2, cy: 11.9, r: 1, c: "#ffde00" },
    ],
  },
  TW: {
    name: "대만",
    shapes: [
      { t: "rect", w: 24, h: 24, c: "#fe0000" },
      { t: "rect", w: 13, h: 12, c: "#000095" },
      { t: "circle", cx: 6.5, cy: 6, r: 3.4, c: "#ffffff" },
    ],
  },
  ES: {
    name: "스페인",
    shapes: [
      { t: "rect", w: 24, h: 24, c: "#aa151b" },
      { t: "rect", y: 6, w: 24, h: 12, c: "#f1bf00" },
    ],
  },
  IT: {
    name: "이탈리아",
    shapes: [
      { t: "rect", w: 8, h: 24, c: "#009246" },
      { t: "rect", x: 8, w: 8, h: 24, c: "#ffffff" },
      { t: "rect", x: 16, w: 8, h: 24, c: "#ce2b37" },
    ],
  },
  GB: {
    name: "영국",
    shapes: [
      { t: "rect", w: 24, h: 24, c: "#012169" },
      { t: "line", d: "M0 0 24 24M24 0 0 24", c: "#ffffff", w: 4.6 },
      { t: "line", d: "M0 0 24 24M24 0 0 24", c: "#c8102e", w: 2 },
      { t: "line", d: "M12 0v24M0 12h24", c: "#ffffff", w: 7 },
      { t: "line", d: "M12 0v24M0 12h24", c: "#c8102e", w: 4 },
    ],
  },
  PH: {
    name: "필리핀",
    shapes: [
      { t: "rect", w: 24, h: 12, c: "#0038a8" },
      { t: "rect", y: 12, w: 24, h: 12, c: "#ce1126" },
      { t: "path", d: "M0 0 13 12 0 24z", c: "#ffffff" },
      { t: "circle", cx: 4.4, cy: 12, r: 2.2, c: "#fcd116" },
    ],
  },
}

/** 저장된 나라 코드에 이름이 없을 때 쓸 값 */
export function flagNameOf(code: string, fallback?: string | null): string {
  return FLAGS[code]?.name ?? (fallback || code)
}
