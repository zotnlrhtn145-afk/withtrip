/** Clears leftover Base UI / modal scroll-lock inline styles that block wheel scrolling. */
export function clearDocumentScrollLock() {
  if (typeof document === "undefined") return

  const html = document.documentElement
  const body = document.body

  html.style.removeProperty("overflow")
  html.style.removeProperty("overflow-x")
  html.style.removeProperty("overflow-y")
  html.style.removeProperty("scroll-behavior")
  html.style.removeProperty("scrollbar-gutter")
  html.removeAttribute("data-base-ui-scroll-locked")

  body.style.removeProperty("overflow")
  body.style.removeProperty("overflow-x")
  body.style.removeProperty("overflow-y")
  body.style.removeProperty("position")
  body.style.removeProperty("height")
  body.style.removeProperty("width")
  body.style.removeProperty("box-sizing")
  body.style.removeProperty("scroll-behavior")
}
