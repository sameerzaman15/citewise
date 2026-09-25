import { describe, expect, it } from "vitest"
import { parseCitationNumbers, splitByCitations } from "@/lib/citations"

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
})
