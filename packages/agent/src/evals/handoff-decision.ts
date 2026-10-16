import type { GoldenOutputs, ReferenceDecision } from "./types"

function describe(actual: GoldenOutputs): string {
  if (actual.action === "reply")
    return `reply/${actual.replyType ?? "sem tipo"}`
  return `handoff/${actual.reason ?? "sem motivo"}`
}

export function scoreHandoffDecision(
  actual: GoldenOutputs,
  expected: ReferenceDecision
): { score: number; comment: string } {
  if (expected.kind === "reply") {
    const matches =
      actual.action === "reply" && actual.replyType === expected.replyType
    return {
      score: matches ? 1 : 0,
      comment: matches
        ? `Ação reply/${expected.replyType} confere.`
        : `Esperado reply/${expected.replyType}; veio ${describe(actual)}.`,
    }
  }

  if (expected.kind === "handoff") {
    const reasonOk =
      actual.action === "handoff" &&
      actual.reason !== null &&
      (expected.reasons.length === 0 ||
        expected.reasons.includes(actual.reason))
    const expectedReasons =
      expected.reasons.length === 0
        ? "qualquer motivo"
        : expected.reasons.join(", ")
    return {
      score: reasonOk ? 1 : 0,
      comment: reasonOk
        ? `Handoff (${actual.reason}) confere.`
        : `Esperado handoff (${expectedReasons}); veio ${describe(actual)}.`,
    }
  }

  if (actual.action === "reply") {
    return {
      score: 1,
      comment:
        "Reply aceito: a referência permite admitir em vez de handoff. O conteúdo entra em correctness e groundedness.",
    }
  }

  const reasonOk =
    actual.reason !== null &&
    (expected.reasons.length === 0 || expected.reasons.includes(actual.reason))
  return {
    score: reasonOk ? 1 : 0,
    comment: reasonOk
      ? `Handoff (${actual.reason}) aceito para abstenção.`
      : `Handoff com motivo fora da lista; veio ${describe(actual)}.`,
  }
}
