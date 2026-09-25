"use client"

import { useEffect, useRef, useState } from "react"
import { Copy, Square } from "lucide-react"
import { toast } from "sonner"
import { AnswerMarkdown } from "@/components/citewise/answer-markdown"
import type { SavedRetrieval } from "@/components/citewise/types"
import { Button } from "@/components/ui/button"
import { NO_KEY_BANNER } from "@/lib/copy"
import { textFromUnknownMessage } from "@/lib/ai/messages"
import type { UIMessage } from "ai"

export function ChatPane({
  messages,
  status,
  chatEnabled,
  error,
  retrievals,
  onSubmit,
  onRetry,
  onStop,
  onNew,
  onCite,
  onOpenSources,
}: {
  messages: UIMessage[]
  status: "submitted" | "streaming" | "ready" | "error"
  chatEnabled: boolean
  error: string | null
  retrievals: Record<string, SavedRetrieval>
  onSubmit: (question: string) => Promise<boolean>
  onRetry?: () => void
  onStop: () => void
  onNew: () => void
  onCite: (messageId: string, n: number) => void
  onOpenSources: (messageId: string) => void
}) {
  const [draft, setDraft] = useState("")
  const listRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const followRef = useRef(true)
  const pinnedAtRef = useRef(0)
  const busy = status === "submitted" || status === "streaming"
  const lastMessage = messages.at(-1)
  const lastText = lastMessage ? (textFromUnknownMessage(lastMessage)?.text ?? "") : ""
  const lastSourceCount = lastMessage ? (retrievals[lastMessage.id]?.semantic.length ?? 0) : 0

  useEffect(() => {
    if (status === "submitted") followRef.current = true
  }, [status])

  useEffect(() => {
    const list = listRef.current
    const content = contentRef.current
    if (!list || !content) return
    const pin = () => {
      if (!followRef.current) return
      pinnedAtRef.current = performance.now()
      list.scrollTop = list.scrollHeight
    }
    pin()
    const observer = new ResizeObserver(() => {
      pin()
    })
    observer.observe(content)
    return () => observer.disconnect()
  }, [lastText, lastSourceCount, messages.length, status, error])

  return (
    <section className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden" aria-label="Chat">
      {!chatEnabled ? (
        <p
          data-testid="no-key-banner"
          className="shrink-0 border-b border-border bg-highlight/40 px-4 py-3 text-sm leading-relaxed text-foreground dark:bg-highlight"
        >
          {NO_KEY_BANNER}
        </p>
      ) : null}
      <div className="flex shrink-0 items-center justify-end gap-2 border-b border-border px-3 py-2">
        <Button type="button" variant="ghost" size="sm" onClick={onNew} disabled={messages.length === 0}>
          New chat
        </Button>
      </div>
      <div
        ref={listRef}
        data-testid="message-list"
        className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain"
        onScroll={(event) => {
          if (performance.now() - pinnedAtRef.current < 80) return
          const list = event.currentTarget
          const gap = list.scrollHeight - list.scrollTop - list.clientHeight
          followRef.current = gap < 48
        }}
      >
        <div ref={contentRef} className="min-w-0 space-y-4 px-4 py-4">
        {messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Ask a question about the active document. Answers cite the passages they use, like [1].
          </p>
        ) : null}
        {messages.map((message, index) => {
          const text = textFromUnknownMessage(message)?.text ?? ""
          const saved = retrievals[message.id]
          const streaming = busy && index === messages.length - 1 && message.role === "assistant"
          if (message.role === "user") {
            return (
              <p key={message.id} className="ml-8 min-w-0 break-words text-sm font-medium [overflow-wrap:anywhere]">
                {text}
              </p>
            )
          }
          return (
            <article key={message.id} className={streaming ? "streaming-caret min-w-0" : "min-w-0"}>
              <div className="min-w-0 break-words rounded-lg bg-card px-3 py-2 text-sm shadow-sm ring-1 ring-border [overflow-wrap:anywhere]">
                <AnswerMarkdown text={text} hits={saved?.semantic ?? []} onCite={(n) => onCite(message.id, n)} />
              </div>
              {saved ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary lg:hidden"
                    onClick={() => onOpenSources(message.id)}
                  >
                    {saved.semantic.length} sources
                  </button>
                  <SourcesRow saved={saved} onCite={(n) => onCite(message.id, n)} />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      void navigator.clipboard.writeText(text).then(
                        () => toast.success("Answer copied"),
                        () => toast.error("Could not copy the answer"),
                      )
                    }}
                  >
                    <Copy />
                    Copy
                  </Button>
                </div>
              ) : null}
            </article>
          )
        })}
        {status === "submitted" ? <p className="text-sm text-muted-foreground">Reading the passages…</p> : null}
        {error ? (
          <div role="alert" className="flex min-w-0 flex-wrap items-center gap-2">
            <p className="min-w-0 break-words text-sm text-destructive [overflow-wrap:anywhere]">{error}</p>
            {onRetry ? (
              <Button type="button" variant="outline" size="sm" onClick={onRetry} disabled={busy}>
                Try again
              </Button>
            ) : null}
          </div>
        ) : null}
        </div>
      </div>
      <form
        data-testid="chat-composer"
        className="shrink-0 border-t border-border bg-background p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        onSubmit={(event) => {
          event.preventDefault()
          const question = draft.trim()
          if (!question || !chatEnabled || busy) return
          void onSubmit(question).then((ok) => {
            if (ok) setDraft("")
          })
        }}
      >
        <label className="sr-only" htmlFor="question">
          Question
        </label>
        <div className="flex min-w-0 items-end gap-2">
          <textarea
            id="question"
            data-testid="chat-input"
            rows={2}
            value={draft}
            disabled={!chatEnabled || busy}
            placeholder={chatEnabled ? "Ask a question about this document" : NO_KEY_BANNER}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault()
                event.currentTarget.form?.requestSubmit()
              }
            }}
            className="min-h-16 min-w-0 flex-1 resize-none rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-70"
          />
          {busy ? (
            <Button type="button" variant="outline" onClick={onStop}>
              <Square />
              Stop
            </Button>
          ) : (
            <Button type="submit" disabled={!chatEnabled || draft.trim().length === 0}>
              Ask
            </Button>
          )}
        </div>
      </form>
    </section>
  )
}

function SourcesRow({ saved, onCite }: { saved: SavedRetrieval; onCite: (n: number) => void }) {
  const cited = saved.semantic
  if (cited.length === 0) return null
  return (
    <ul className="flex min-w-0 flex-1 flex-col gap-1">
      {cited.map((hit, index) => (
        <li key={hit.chunk.id}>
          <button
            type="button"
            className="block w-full min-w-0 whitespace-normal break-words text-left text-xs text-muted-foreground hover:text-foreground [overflow-wrap:anywhere]"
            onClick={() => onCite(index + 1)}
          >
            [{index + 1}] {hit.chunk.page ? `p. ${hit.chunk.page}` : "no page"} · {hit.chunk.text.slice(0, 80)}
          </button>
        </li>
      ))}
    </ul>
  )
}
