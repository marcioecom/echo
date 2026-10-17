export interface ComposePacing {
  msPerChar: number
  minMs: number
  maxMs: number
}

export const defaultComposePacing: ComposePacing = {
  msPerChar: 30,
  minMs: 1_000,
  maxMs: 6_000,
}

export function humanSendDelayMs(
  body: string,
  pacing: ComposePacing = defaultComposePacing
): number {
  const scaled = body.length * pacing.msPerChar
  return Math.min(pacing.maxMs, Math.max(pacing.minMs, scaled))
}
