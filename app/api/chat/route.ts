import { APICallError, createUIMessageStream, createUIMessageStreamResponse, streamText, toUIMessageStream } from "ai"
import { z } from "zod"
import { INVALID_KEY_MESSAGE, MAX_OUTPUT_TOKENS, NO_KEY_BANNER, NOT_FOUND_ANSWER } from "@/lib/copy"
import { buildInstructions, capContext, capHistory, textFromUnknownMessage } from "@/lib/ai/messages"
import { chatProviderOptions, getChatModel, getPublicStatus } from "@/lib/ai/providers"
import { enforceRateLimit } from "@/lib/rate-limit"
import type { ContextPassage } from "@/lib/types"

export const runtime = "nodejs"
export const maxDuration = 30
export const dynamic = "force-dynamic"

const passageSchema = z.object({
  n: z.number().int().min(1).max(20),
  chunkId: z.string().min(1).max(80),
  text: z.string().max(8000),
  page: z.number().int().min(1).nullable().optional(),
  docName: z.string().max(200),
})

const messageSchema = z
  .object({
    id: z.string().optional(),
    role: z.enum(["user", "assistant", "system"]),
    parts: z.array(z.object({ type: z.string(), text: z.string().optional() }).passthrough()).optional(),
    content: z.string().optional(),
  })
  .passthrough()

const bodySchema = z.object({
  messages: z.array(messageSchema).min(1).max(40),
  context: z.array(passageSchema).max(8),
})

export async function POST(request: Request) {
  let json: unknown
  try {
    json = await request.json()
  } catch {
    return Response.json({ code: "BAD_REQUEST", message: "Send JSON." }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return Response.json(
      { code: "BAD_REQUEST", message: "The chat request was not valid." },
      { status: 400 },
    )
  }

  const limited = await enforceRateLimit(request, "chat")
  if (limited) return limited

  const status = getPublicStatus()
  if (!status.chatEnabled) {
    return Response.json({ code: "NO_API_KEY", message: NO_KEY_BANNER }, { status: 503 })
  }

  const history = capHistory(
    parsed.data.messages
      .map((message) => textFromUnknownMessage(message))
      .filter((message): message is NonNullable<typeof message> => message !== null),
  )
  const context = capContext(
    parsed.data.context.map(
      (passage): ContextPassage => ({
        n: passage.n,
        chunkId: passage.chunkId,
        text: passage.text,
        page: passage.page ?? null,
        docName: passage.docName,
      }),
    ),
  )

  if (context.length === 0) {
    return staticAnswer(NOT_FOUND_ANSWER)
  }

  const model = getChatModel()
  if (!model) {
    return Response.json({ code: "NO_API_KEY", message: NO_KEY_BANNER }, { status: 503 })
  }

  try {
    const result = streamText({
      model,
      system: buildInstructions(context),
      messages: history.map((message) => ({ role: message.role, content: message.text })),
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      maxRetries: 0,
      abortSignal: request.signal,
      providerOptions: chatProviderOptions(),
    })

    return createUIMessageStreamResponse({
      stream: toUIMessageStream({
        stream: result.stream,
        onError: (error) => {
          if (APICallError.isInstance(error) && error.statusCode === 401) {
            return INVALID_KEY_MESSAGE
          }
          return "The model could not answer just now. Try again in a moment."
        },
      }),
    })
  } catch (error) {
    if (APICallError.isInstance(error) && error.statusCode === 401) {
      return Response.json({ code: "INVALID_API_KEY", message: INVALID_KEY_MESSAGE }, { status: 401 })
    }
    console.error("chat failed", error)
    return Response.json(
      { code: "CHAT_FAILED", message: "The model could not answer just now. Try again in a moment." },
      { status: 502 },
    )
  }
}

function staticAnswer(text: string): Response {
  const stream = createUIMessageStream({
    execute({ writer }) {
      const id = "static"
      writer.write({ type: "start" })
      writer.write({ type: "start-step" })
      writer.write({ type: "text-start", id })
      writer.write({ type: "text-delta", id, delta: text })
      writer.write({ type: "text-end", id })
      writer.write({ type: "finish-step" })
      writer.write({ type: "finish", finishReason: "stop" })
    },
  })
  return createUIMessageStreamResponse({ stream })
}
