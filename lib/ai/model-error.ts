import { APICallError } from "ai"
import { DEMO_BUSY_MESSAGE, INVALID_KEY_MESSAGE } from "@/lib/copy"

export const MODEL_UNAVAILABLE_MESSAGE = "The model could not answer just now. Try again in a moment."

type ErrorRecord = {
  message?: unknown
  code?: unknown
  statusCode?: unknown
  responseBody?: unknown
  cause?: unknown
  error?: { message?: unknown; code?: unknown }
}

function asRecord(error: unknown): ErrorRecord | null {
  if (!error || typeof error !== "object") return null
  return error as ErrorRecord
}

function statusCodeOf(error: unknown, depth = 0): number | undefined {
  if (depth > 4) return undefined
  if (APICallError.isInstance(error)) return error.statusCode
  const record = asRecord(error)
  if (!record) return undefined
  if (typeof record.statusCode === "number") return record.statusCode
  return statusCodeOf(record.cause, depth + 1)
}

function textOf(error: unknown, depth = 0): string {
  if (depth > 4 || error == null) return ""
  if (typeof error === "string") return error
  if (APICallError.isInstance(error)) {
    return [error.message, error.responseBody, textOf(error.cause, depth + 1)].filter(Boolean).join("\n")
  }
  if (error instanceof Error) return [error.message, textOf(error.cause, depth + 1)].filter(Boolean).join("\n")
  const record = asRecord(error)
  if (!record) return ""
  const nested = record.error && typeof record.error === "object" ? record.error.message : undefined
  return [record.message, record.responseBody, nested, textOf(record.cause, depth + 1)]
    .filter((part) => typeof part === "string")
    .join("\n")
}

/** Groq (and other providers) answer 429 when the free-tier token budget is spent. */
export function isProviderRateLimit(error: unknown): boolean {
  if (statusCodeOf(error) === 429) return true
  const text = textOf(error)
  return /rate_limit_exceeded/i.test(text) || (/rate limit/i.test(text) && /tokens per minute|\btpm\b/i.test(text))
}

export function messageForModelError(error: unknown): string {
  if (statusCodeOf(error) === 401) return INVALID_KEY_MESSAGE
  if (isProviderRateLimit(error)) return DEMO_BUSY_MESSAGE
  return MODEL_UNAVAILABLE_MESSAGE
}

/** Map a non-OK /api/chat JSON body to the sentence shown in the chat pane. */
export function messageFromChatResponse(status: number, payload: unknown): string {
  const record = asRecord(payload)
  if (record?.code === "RATE_LIMITED" && typeof record.message === "string" && record.message) {
    return record.message
  }
  if (status === 429) return DEMO_BUSY_MESSAGE
  if (record && typeof record.message === "string" && record.message) {
    return presentChatError(record.message) ?? record.message
  }
  const nested = record?.error && typeof record.error === "object" ? record.error.message : undefined
  if (typeof nested === "string" && nested) {
    return presentChatError(nested) ?? nested
  }
  return "The request failed."
}

export function presentChatError(message: string | null | undefined): string | null {
  if (!message) return null
  if (message === DEMO_BUSY_MESSAGE) return message
  if (/rate limit|rate_limit_exceeded|too many requests|tokens per minute/i.test(message)) {
    return DEMO_BUSY_MESSAGE
  }
  return message
}
