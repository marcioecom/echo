"use client"

import { useEffect, useRef } from "react"

type Particle = {
  color: string
  life: number
  rotation: number
  size: number
  spin: number
  vx: number
  vy: number
  x: number
  y: number
}

// Moss green and warm paper tones taken from the UI tokens, so the burst reads
// as Echo celebrating instead of a generic party effect.
const COLORS = ["#507e00", "#87b651", "#436416", "#e9ece7", "#c9a978"]

const DURATION_MS = 3_200
const GRAVITY = 0.22

/**
 * A single burst, played once per browser session. Used for the moment the
 * first WhatsApp message comes back answered — a genuine peak in the first-run
 * flow, not decoration. The canvas stays mounted and clears itself so the
 * celebration outlives the data transition that started it.
 */
export function Confetti({
  active,
  storageKey,
}: {
  active: boolean
  storageKey: string
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const playedRef = useRef(false)

  useEffect(() => {
    if (!active || playedRef.current) return
    if (window.sessionStorage.getItem(storageKey)) return
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext("2d")
    if (!context) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    const ctx: CanvasRenderingContext2D = context
    playedRef.current = true
    window.sessionStorage.setItem(storageKey, "1")
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const width = window.innerWidth
    const height = window.innerHeight
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const particles = createParticles(width, height)
    const startedAt = performance.now()
    let frame = 0

    function tick(now: number) {
      ctx.clearRect(0, 0, width, height)
      let alive = false

      for (const particle of particles) {
        particle.vy += GRAVITY
        particle.vx *= 0.994
        particle.x += particle.vx
        particle.y += particle.vy
        particle.rotation += particle.spin
        particle.life -= 0.008

        if (particle.life <= 0 || particle.y > height + 30) continue
        alive = true

        ctx.save()
        ctx.globalAlpha = Math.min(1, particle.life)
        ctx.translate(particle.x, particle.y)
        ctx.rotate(particle.rotation)
        ctx.fillStyle = particle.color
        ctx.fillRect(
          -particle.size / 2,
          -particle.size / 4,
          particle.size,
          particle.size / 2
        )
        ctx.restore()
      }

      if (alive && now - startedAt < DURATION_MS) {
        frame = requestAnimationFrame(tick)
      } else {
        ctx.clearRect(0, 0, width, height)
      }
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [active, storageKey])

  return (
    <canvas
      aria-hidden
      className="pointer-events-none fixed inset-0 z-50 size-full motion-reduce:hidden"
      ref={canvasRef}
    />
  )
}

function createParticles(width: number, height: number): Particle[] {
  const originX = width / 2
  const originY = Math.min(height * 0.3, 260)

  return Array.from({ length: 130 }, () => {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.85
    const speed = 8 + Math.random() * 10

    return {
      x: originX + (Math.random() - 0.5) * 120,
      y: originY + (Math.random() - 0.5) * 16,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: 6 + Math.random() * 7,
      rotation: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 0.35,
      color: COLORS[Math.floor(Math.random() * COLORS.length)] ?? COLORS[0]!,
      life: 1,
    }
  })
}
