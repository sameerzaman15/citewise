import { tokenize } from "@/lib/keyword-search"

export type HighlightPart = { text: string; match: boolean }

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/** Soft-highlight query words inside a passage. Short tokens are ignored so "a" does not light up everything. */
export function highlightParts(text: string, query: string): HighlightPart[] {
  const terms = [...new Set(tokenize(query))].filter((term) => term.length > 2)
  if (terms.length === 0) return [{ text, match: false }]
  const pattern = new RegExp(`(${terms.map(escapeRegExp).join("|")})`, "ig")
  const parts: HighlightPart[] = []
  let last = 0
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0
    if (index > last) parts.push({ text: text.slice(last, index), match: false })
    parts.push({ text: match[0], match: true })
    last = index + match[0].length
  }
  if (last < text.length) parts.push({ text: text.slice(last), match: false })
  return parts.length > 0 ? parts : [{ text, match: false }]
}
