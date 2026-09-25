import { describe, expect, it } from "vitest"
import { createCitationNormalizer, normalizeCitations, parseCitationNumbers, splitByCitations } from "@/lib/citations"

describe("citations", () => {
  it("collects unique citation numbers in order", () => {
    expect(parseCitationNumbers("See [2] and [1][2].")).toEqual([1, 2])
    expect(parseCitationNumbers("No citations here.")).toEqual([])
  })

  it("splits prose around citation chips", () => {
    expect(splitByCitations("Battery life is long [1].")).toEqual([
      { type: "text", value: "Battery life is long " },
      { type: "cite", n: 1 },
      { type: "text", value: "." },
    ])
  })

  it("treats fullwidth brackets as the same citation", () => {
    expect(parseCitationNumbers("Lasts 70 hours 【1】 and also 【2】[1].")).toEqual([1, 2])
    expect(splitByCitations("Lasts 70 hours 【1】.")).toEqual([
      { type: "text", value: "Lasts 70 hours " },
      { type: "cite", n: 1 },
      { type: "text", value: "." },
    ])
    expect(splitByCitations("Mixed 【2] and [3】.")).toEqual([
      { type: "text", value: "Mixed " },
      { type: "cite", n: 2 },
      { type: "text", value: " and " },
      { type: "cite", n: 3 },
      { type: "text", value: "." },
    ])
  })

  it("rewrites stored fullwidth citations to ASCII brackets", () => {
    expect(normalizeCitations("Charge lasts 70 hours 【1】.")).toBe("Charge lasts 70 hours [1].")
    expect(normalizeCitations("Already ASCII [2][3].")).toBe("Already ASCII [2][3].")
  })

  it("normalizes a citation split across stream deltas", () => {
    const normalizer = createCitationNormalizer()
    expect(normalizer.push("Charge lasts 70 hours 【")).toBe("Charge lasts 70 hours ")
    expect(normalizer.push("1】.")).toBe("[1].")
    expect(normalizer.flush()).toBe("")
  })
})
