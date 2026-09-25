export const NO_KEY_BANNER =
  "This demo is running without an AI key, so answers are turned off. Retrieval and the keyword vs semantic comparison still work. Site owner: add OPENAI_API_KEY or GROQ_API_KEY in Vercel, then redeploy."

export const NOT_FOUND_ANSWER = "I couldn't find that in this document."

export const INVALID_KEY_MESSAGE =
  "The configured AI key was rejected. Check the key in your environment variables."

export const DEMO_BUSY_MESSAGE = "The demo is busy right now. Please try again in a few seconds."

export const PRIVACY_NOTE =
  "Files are processed in memory for this session and not stored. Don't upload confidential documents."

export const OCR_ERROR =
  "This PDF has no selectable text. OCR is out of scope for this demo."

export const FILE_TOO_LARGE = "This file is over the 4 MB limit."

export const UNSUPPORTED_TYPE = "Only PDF, TXT, and MD files are supported."

export const TOO_MANY_PAGES = "This PDF is over the 50 page limit."

export const TOO_MANY_CHARS = "This document is over the 200,000 character limit."

export const KEYWORD_LABEL = "Keyword search: all words must match"

export const MOUSE_QUERY = "mouse without cable"

export const COMPARE_EXPLAINER =
  "Keyword search needs your exact words. Semantic search matches meaning, so 'without cable' finds 'wireless'."

export const PORTFOLIO_LINE =
  "A portfolio demo by Sameer Zaman. Sample documents are fictional."

export const FOOTER_NOTE = "Concept demo. Sample documents are fictional."

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024
export const MAX_PAGES = 50
export const MAX_CHARS = 200_000
export const MAX_CHUNKS = 300
export const TARGET_CHUNK_CHARS = 800
export const CHUNK_OVERLAP_CHARS = 120
export const DEFAULT_TOP_K = 4
export const CONTEXT_CHAR_CAP = 12_000
export const HISTORY_MESSAGE_CAP = 6
export const MAX_OUTPUT_TOKENS = 600

export function rateLimitMessage(
  limit: number,
  windowMinutes: number,
  retryAfterSeconds: number,
  noun: "questions" | "uploads" | "embedding requests",
): string {
  const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60))
  const unit = minutes === 1 ? "minute" : "minutes"
  return `You've reached the demo limit (${limit} ${noun} per ${windowMinutes} minutes). Try again in ${minutes} ${unit}.`
}

export function dailyCapMessage(): string {
  return "You've reached the demo's daily question limit. Try again tomorrow."
}
