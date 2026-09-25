const CITATION = /[\[【](\d+)[\]】]/g
const TRAILING_OPEN = /[\[【]\d{0,4}$/

export type CitationPart = { type: "text"; value: string } | { type: "cite"; n: number }

/** Rewrite fullwidth brackets such as 【1】 to ASCII [1]. */
export function normalizeCitations(text: string): string {
  return text.replace(CITATION, "[$1]")
}

/**
 * Normalize citation brackets across streamed deltas.
 * A marker split as "【" + "1】" is held until the closing bracket arrives.
 */
export function createCitationNormalizer() {
  let held = ""
  return {
    push(delta: string): string {
      const combined = held + delta
      const trailing = TRAILING_OPEN.exec(combined)
      if (trailing) {
        held = trailing[0]
        return normalizeCitations(combined.slice(0, trailing.index))
      }
      held = ""
      return normalizeCitations(combined)
    },
    flush(): string {
      const rest = held
      held = ""
      return normalizeCitations(rest)
    },
  }
}

export function parseCitationNumbers(text: string): number[] {
  const found = new Set<number>()
  for (const match of text.matchAll(CITATION)) {
    const n = Number(match[1])
    if (Number.isInteger(n) && n > 0) found.add(n)
  }
  return [...found].sort((a, b) => a - b)
}

export function splitByCitations(text: string): CitationPart[] {
  const parts: CitationPart[] = []
  let last = 0
  for (const match of text.matchAll(CITATION)) {
    const index = match.index ?? 0
    if (index > last) {
      parts.push({ type: "text", value: text.slice(last, index) })
    }
    parts.push({ type: "cite", n: Number(match[1]) })
    last = index + match[0].length
  }
  if (last < text.length) {
    parts.push({ type: "text", value: text.slice(last) })
  }
  if (parts.length === 0) parts.push({ type: "text", value: text })
  return parts
}
