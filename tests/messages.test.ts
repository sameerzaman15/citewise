import { describe, expect, it } from "vitest"
import { buildInstructions, capContext, capHistory, textFromUnknownMessage } from "@/lib/ai/messages"
import { CONTEXT_CHAR_CAP, HISTORY_MESSAGE_CAP, NOT_FOUND_ANSWER } from "@/lib/copy"
import type { ContextPassage } from "@/lib/types"

function passage(n: number, text: string): ContextPassage {
  return { n, chunkId: `c${n}`, text, page: 1, docName: "Doc" }
}

describe("context and history caps", () => {
  it("keeps the last six messages", () => {
    const messages = Array.from({ length: 8 }, (_, index) => ({
      role: index % 2 === 0 ? ("user" as const) : ("assistant" as const),
      text: `message ${index}`,
    }))
    const capped = capHistory(messages)
    expect(capped).toHaveLength(HISTORY_MESSAGE_CAP)
    expect(capped[0]?.text).toBe("message 2")
    expect(capped.at(-1)?.text).toBe("message 7")
  })

  it("stops context at 12,000 characters", () => {
    const passages = [passage(1, "a".repeat(8_000)), passage(2, "b".repeat(8_000))]
    const capped = capContext(passages)
    const total = capped.reduce((sum, item) => sum + item.text.length, 0)
    expect(total).toBeLessThanOrEqual(CONTEXT_CHAR_CAP)
    expect(capped).toHaveLength(2)
    expect(capped[1]?.text.length).toBe(4_000)
  })

  it("reads text parts from a UI message", () => {
    expect(
      textFromUnknownMessage({
        role: "assistant",
        parts: [{ type: "text", text: NOT_FOUND_ANSWER }],
      }),
    ).toEqual({ role: "assistant", text: NOT_FOUND_ANSWER })
  })

  it("normalizes fullwidth citations in stored assistant text", () => {
    expect(
      textFromUnknownMessage({
        role: "assistant",
        parts: [{ type: "text", text: "The mouse is wireless 【1】." }],
      }),
    ).toEqual({ role: "assistant", text: "The mouse is wireless [1]." })
  })

  it("requires an ASCII citation for every factual claim", () => {
    const instructions = buildInstructions([passage(1, "Battery lasts 70 hours.")])
    expect(instructions).toContain("Every factual claim must cite one of those passages.")
    expect(instructions).toContain("ASCII square brackets only, like [1] or [2][3].")
    expect(instructions).toContain("Each number must refer to a passage below.")
    expect(instructions).toContain("[1] (page 1, Doc)")
    expect(instructions).toContain("Do not use fullwidth brackets")
  })
})
