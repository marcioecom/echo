import type { Result } from "./result"

export function matchResult<Value, Error, Output>(
  result: Result<Value, Error>,
  handlers: {
    ok: (value: Value) => Output
    err: (error: Error) => Output
  }
): Output {
  return result.ok ? handlers.ok(result.value) : handlers.err(result.error)
}

type TaggedCases<Tagged extends { type: string }, Output> = {
  [Type in Tagged["type"]]: (
    value: Extract<Tagged, { type: Type }>
  ) => Output
}

export function matchTag<Tagged extends { type: string }, Output>(
  value: Tagged,
  cases: TaggedCases<Tagged, Output>
): Output {
  const match = cases[value.type as Tagged["type"]] as (value: Tagged) => Output
  return match(value)
}
