/** Figma 276:4870 — keep the actual cover visible across Next route loading. */
export function openWithCover(source: HTMLElement, id: string, navigate: () => void) {
  const rect = source.getBoundingClientRect()
  const layer = document.createElement("div")
  Object.assign(layer.style, { position: "fixed", inset: "0", zIndex: "9999", background: "transparent", pointerEvents: "auto" })
  layer.setAttribute("aria-hidden", "true")
  const backdrop = document.createElement("div")
  Object.assign(backdrop.style, { position: "absolute", inset: "0", background: "white", opacity: "0" })
  const copy = source.cloneNode(true) as HTMLElement
  copy.inert = true
  copy.removeAttribute("id")
  // Inline computed appearance: CSS-module ancestry disappears in the root overlay.
  const originals = [source, ...source.querySelectorAll<HTMLElement>("*")]
  const copies = [copy, ...copy.querySelectorAll<HTMLElement>("*")]
  originals.forEach((node, i) => {
    const css = getComputedStyle(node)
    for (const key of Array.from(css)) copies[i].style.setProperty(key, css.getPropertyValue(key))
    copies[i].style.animation = "none"
    copies[i].removeAttribute("id")
  })
  Object.assign(copy.style, { position: "absolute", left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px`, margin: "0", transform: "none" })
  layer.append(backdrop, copy); document.body.append(layer)
  let done = false
  let timeout: ReturnType<typeof setTimeout>
  const observer = new MutationObserver(check)
  const clear = () => { observer.disconnect(); clearTimeout(timeout); layer.remove() }
  function check() {
    const target = document.querySelector<HTMLElement>(`[data-trip-cover="${CSS.escape(id)}"]`)
    if (!target || done) return
    done = true; observer.disconnect()
    const to = target.getBoundingClientRect()
    if (!to.width || !to.height) { clear(); return }
    backdrop.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 450, fill: "forwards" })
    const anim = copy.animate([
      { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px`, borderRadius: "21px 21px 0 0" },
      { left: `${to.left}px`, top: `${to.top}px`, width: `${to.width}px`, height: `${to.height}px`, borderRadius: getComputedStyle(target).borderRadius },
    ], { duration: 850, easing: "cubic-bezier(.22,1,.36,1)", fill: "forwards" })
    anim.finished.then(async () => {
      const img = target.querySelector("img")
      if (img && !img.complete) await Promise.race([img.decode().catch(() => {}), new Promise(resolve => setTimeout(resolve, 1500))])
      if (!layer.isConnected) return
      await layer.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, fill: "forwards" }).finished
      clear()
    }).catch(clear)
  }
  observer.observe(document.body, { childList: true, subtree: true })
  timeout = setTimeout(clear, 5500)
  try { navigate(); check() } catch { clear() }
}
