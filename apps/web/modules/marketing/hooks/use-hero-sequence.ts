"use client"

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react"

/**
 * The hero scene is a short, narrated loop: a message arrives, Echo reads
 * a source document, answers, then hands an exception to a person.
 * One phase at a time keeps the animation honest about what is happening.
 */
export const heroPhases = [
  "idle",
  "questionOne",
  "channelIn",
  "knowledgeIn",
  "source",
  "knowledgeOut",
  "answerOne",
  "questionTwo",
  "channelInTwo",
  "knowledgeInTwo",
  "noMatch",
  "knowledgeOutTwo",
  "handoff",
  "done",
] as const

export type HeroPhase = (typeof heroPhases)[number]

export type HeroMode = "idle" | "playing" | "paused" | "ended"

const phaseDurations: Record<HeroPhase, number> = {
  idle: 340,
  questionOne: 680,
  channelIn: 560,
  knowledgeIn: 560,
  source: 640,
  knowledgeOut: 520,
  answerOne: 760,
  questionTwo: 900,
  channelInTwo: 520,
  knowledgeInTwo: 520,
  noMatch: 680,
  knowledgeOutTwo: 520,
  handoff: 700,
  done: 0,
}

export function reachedPhase(current: HeroPhase, target: HeroPhase) {
  return heroPhases.indexOf(current) >= heroPhases.indexOf(target)
}

const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect

export function useHeroSequence() {
  const stageRef = useRef<HTMLDivElement>(null)
  const [phase, setPhase] = useState<HeroPhase>("done")
  const [mode, setMode] = useState<HeroMode>("ended")
  const [reducedMotion, setReducedMotion] = useState(false)

  // Server and no-JS render the finished scene; motion-capable browsers
  // rewind before paint so the sequence can start from the beginning.
  useIsomorphicLayoutEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)")

    if (media.matches) {
      setReducedMotion(true)
      setPhase("done")
      setMode("ended")
      return
    }

    setPhase("idle")
    setMode(typeof IntersectionObserver === "undefined" ? "playing" : "idle")
  }, [])

  useEffect(() => {
    if (mode !== "playing") return

    const next = heroPhases[heroPhases.indexOf(phase) + 1]
    if (!next) return

    const timeout = window.setTimeout(() => {
      setPhase(next)
      if (next === "done") setMode("ended")
    }, phaseDurations[phase])

    return () => window.clearTimeout(timeout)
  }, [mode, phase])

  useEffect(() => {
    if (reducedMotion || mode !== "idle") return

    const node = stageRef.current
    if (!node) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return
        observer.disconnect()
        setMode("playing")
      },
      { threshold: 0.25 }
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [mode, reducedMotion])

  const toggle = useCallback(() => {
    if (mode === "playing") {
      setMode("paused")
      return
    }

    if (mode === "paused") {
      setMode("playing")
      return
    }

    setPhase("idle")
    setMode("playing")
  }, [mode])

  return { stageRef, phase, mode, reducedMotion, toggle }
}
