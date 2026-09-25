const CITATION = /\[(\d+)\]/g

export type CitationPart =
  | { type: "text"; value: string }
  | { type: "cite"; n: number }

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
