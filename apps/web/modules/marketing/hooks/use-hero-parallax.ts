"use client"

import { useEffect, useRef } from "react"

export function useHeroParallax<T extends HTMLElement>() {
  const ref = useRef<T>(null)

  useEffect(() => {
    const node = ref.current
    if (!node) return

    const media = window.matchMedia("(prefers-reduced-motion: reduce)")
    if (media.matches) return

    let frame = 0

    const setOffset = (x: number, y: number) => {
      node.style.setProperty("--parallax-x", x.toFixed(3))
      node.style.setProperty("--parallax-y", y.toFixed(3))
    }

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return
      if (frame) return

      frame = window.requestAnimationFrame(() => {
        frame = 0
        const rect = node.getBoundingClientRect()
        if (rect.width === 0 || rect.height === 0) return
        setOffset(
          (event.clientX - rect.left) / rect.width - 0.5,
          (event.clientY - rect.top) / rect.height - 0.5
        )
      })
    }

    const onPointerLeave = () => setOffset(0, 0)

    node.addEventListener("pointermove", onPointerMove)
    node.addEventListener("pointerleave", onPointerLeave)

    return () => {
      node.removeEventListener("pointermove", onPointerMove)
      node.removeEventListener("pointerleave", onPointerLeave)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [])

  return ref
}
