"use client"

import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport, type UIMessage } from "ai"
import { useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { ChatPane } from "@/components/citewise/chat-pane"
import { clientUploadError, DocumentPane, type IndexProgress } from "@/components/citewise/document-pane"
import { RetrievalPanel, type PanelMode, type PanelState } from "@/components/citewise/retrieval-panel"
import type { ActiveDocument, SavedRetrieval } from "@/components/citewise/types"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { defaultThreshold, type PublicStatus } from "@/lib/ai/config"
import { textFromUnknownMessage } from "@/lib/ai/messages"
import { parseCitationNumbers } from "@/lib/citations"
import { embedWithBrowser, ensureBrowserModel, onEmbedEvent } from "@/lib/client/browser-embed"
import { readSampleSession, writeSessionIndex } from "@/lib/client/session-index"
import {
  MOUSE_QUERY,
  NOT_FOUND_ANSWER,
  PORTFOLIO_LINE,
} from "@/lib/copy"
import { keywordSearch } from "@/lib/keyword-search"
import { SAMPLES } from "@/lib/samples"
import type { ContextPassage, IngestPayload } from "@/lib/types"
import { VectorStore } from "@/lib/vector-store"

type MobileTab = "chat" | "sources" | "document"

export function CitewiseApp({ initialStatus }: { initialStatus: PublicStatus }) {
  const status = initialStatus
  const [doc, setDoc] = useState<ActiveDocument | null>(null)
  const [progress, setProgress] = useState<IndexProgress>({
    phase: "idle",
    modelPercent: null,
    embedDone: 0,
    embedTotal: 0,
  })
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<PanelMode>("semantic")
  const [topK, setTopK] = useState(4)
  const [threshold, setThreshold] = useState(defaultThreshold(status.embeddingModel))
  const [panel, setPanel] = useState<PanelState | null>(null)
  const [retrievals, setRetrievals] = useState<Record<string, SavedRetrieval>>({})
  const [highlightedId, setHighlightedId] = useState<string | null>(null)
  const [mobileTab, setMobileTab] = useState<MobileTab>("chat")
  const [confirmOpen, setConfirmOpen] = useState(false)
  const pendingAction = useRef<(() => void) | null>(null)
  const queryVectorRef = useRef<number[] | null>(null)
  const latestRef = useRef({
    context: [] as ContextPassage[],
    doc: null as ActiveDocument | null,
    topK: 4,
    threshold: defaultThreshold(status.embeddingModel),
    pending: null as SavedRetrieval | null,
  })

  const [transport] = useState(
    // The ref is read when a question is sent, after render.
    // eslint-disable-next-line react-hooks/refs
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        prepareSendMessagesRequest: ({ messages }) => ({
          body: { messages, context: latestRef.current.context },
        }),
        fetch: async (input, init) => {
          const response = await globalThis.fetch(input, init)
          if (!response.ok) {
            let message = "The request failed."
            try {
              const payload = (await response.json()) as { message?: string }
              if (payload.message) message = payload.message
            } catch {
              // The status line is enough.
            }
            throw new Error(message)
          }
          return response
        },
      }),
  )

  const chat = useChat({
    transport,
    onFinish: ({ message, isError, isAbort }) => {
      const saved = latestRef.current.pending
      if (!saved || isError || isAbort) return
      setRetrievals((current) => (current[message.id] ? current : { ...current, [message.id]: saved }))
    },
  })
  const busy = chat.status === "submitted" || chat.status === "streaming"

  useEffect(() => {
    return onEmbedEvent((event) => {
      if (event.type === "progress" && event.total > 0) {
        setProgress((current) => ({
          ...current,
          modelPercent: Math.round((event.loaded / event.total) * 100),
        }))
      }
      if (event.type === "embed-progress") {
        setProgress((current) => ({
          ...current,
          phase: "embedding",
          embedDone: event.done,
          embedTotal: event.total,
        }))
      }
      if (event.type === "ready" || event.type === "vectors") {
        setProgress((current) => ({ ...current, modelPercent: null }))
      }
    })
  }, [])

  const citedIds = useMemo(() => {
    const last = [...chat.messages].reverse().find((message) => message.role === "assistant")
    const saved = last ? retrievals[last.id] : undefined
    const source = saved?.semantic ?? panel?.semantic ?? []
    const text = last ? (textFromUnknownMessage(last)?.text ?? "") : ""
    const ids = parseCitationNumbers(text)
      .map((n) => source[n - 1]?.chunk.id)
      .filter((id): id is string => Boolean(id))
    return new Set(ids)
  }, [chat.messages, retrievals, panel])

  function guardSwitch(action: () => void) {
    if (chat.messages.length > 0) {
      pendingAction.current = action
      setConfirmOpen(true)
      return
    }
    action()
  }

  async function indexFromPayload(payload: IngestPayload, started: number, sampleId?: string) {
    let vectors = payload.vectors
    let model = payload.embeddingModel
    let dimensions = payload.embeddingDimensions
    if (!vectors) {
      setProgress((current) => ({
        ...current,
        phase: "embedding",
        embedDone: 0,
        embedTotal: payload.chunks.length,
      }))
      if (payload.embeddingProvider === "browser") {
        await ensureBrowserModel()
      }
      const embedded = await embedWithBrowser(payload.chunks.map((chunk) => chunk.text))
      vectors = embedded.vectors
      model = embedded.model
      dimensions = embedded.dimensions
    }
    const active: ActiveDocument = {
      name: payload.name,
      sampleId,
      pages: payload.pages,
      chunks: payload.chunks,
      vectors,
      embeddingModel: model,
      embeddingDimensions: dimensions,
      indexedMs: performance.now() - started,
      cached: payload.cached,
      hash: payload.hash,
    }
    writeSessionIndex(
      {
        chunks: active.chunks,
        vectors: active.vectors,
        model: active.embeddingModel,
        dimensions: active.embeddingDimensions,
        pages: active.pages,
        charCount: payload.charCount,
        name: active.name,
        hash: active.hash,
      },
      sampleId,
    )
    latestRef.current.doc = active
    latestRef.current.threshold = defaultThreshold(model)
    setDoc(active)
    setThreshold(latestRef.current.threshold)
    setPanel(null)
    queryVectorRef.current = null
    setProgress({ phase: "ready", modelPercent: null, embedDone: 0, embedTotal: 0 })
  }

  function adoptSession(sampleId: string, model: string): boolean {
    const cached = readSampleSession(sampleId, model)
    if (!cached) return false
    const started = performance.now()
    const active: ActiveDocument = {
      name: cached.name,
      sampleId,
      pages: cached.pages,
      chunks: cached.chunks,
      vectors: cached.vectors,
      embeddingModel: cached.model,
      embeddingDimensions: cached.dimensions,
      indexedMs: performance.now() - started,
      cached: true,
      hash: cached.hash,
    }
    latestRef.current.doc = active
    latestRef.current.threshold = defaultThreshold(cached.model)
    setDoc(active)
    setThreshold(latestRef.current.threshold)
    setPanel(null)
    queryVectorRef.current = null
    setProgress({ phase: "ready", modelPercent: null, embedDone: 0, embedTotal: 0 })
    return true
  }

  async function loadSample(sampleId: string) {
    if (latestRef.current.doc?.sampleId === sampleId && latestRef.current.doc.chunks.length > 0) return
    setError(null)
    chat.setMessages([])
    setRetrievals({})
    if (adoptSession(sampleId, status.embeddingModel)) return
    setProgress({ phase: "reading", modelPercent: null, embedDone: 0, embedTotal: 0 })
    const started = performance.now()
    const response = await fetch("/api/ingest", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sampleId }),
    })
    const payload = (await response.json()) as IngestPayload & { message?: string }
    if (!response.ok) {
      setProgress({ phase: "idle", modelPercent: null, embedDone: 0, embedTotal: 0 })
      throw new Error(payload.message || "The sample could not be indexed.")
    }
    await indexFromPayload(payload, started, sampleId)
  }

  async function uploadFile(file: File) {
    const localError = clientUploadError(file)
    if (localError) {
      setError(localError)
      return
    }
    setError(null)
    chat.setMessages([])
    setRetrievals({})
    setProgress({ phase: "reading", modelPercent: null, embedDone: 0, embedTotal: 0 })
    const started = performance.now()
    const form = new FormData()
    form.set("file", file)
    const response = await fetch("/api/ingest", { method: "POST", body: form })
    const payload = (await response.json()) as IngestPayload & { message?: string }
    if (!response.ok) {
      setProgress({ phase: "idle", modelPercent: null, embedDone: 0, embedTotal: 0 })
      setError(payload.message || "The file could not be indexed.")
      return
    }
    try {
      await indexFromPayload(payload, started)
    } catch (caught) {
      setProgress({ phase: "idle", modelPercent: null, embedDone: 0, embedTotal: 0 })
      setError(caught instanceof Error ? caught.message : "Embedding failed.")
    }
  }

  function searchCurrent(query: string, vector: number[], k: number, minScore: number): SavedRetrieval {
    const active = latestRef.current.doc
    if (!active) {
      return {
        query,
        semantic: [],
        keyword: [],
        belowThreshold: true,
        latencyMs: 0,
        topK: k,
        threshold: minScore,
        embeddingModel: status.embeddingModel,
        dimensions: status.embeddingDimensions,
      }
    }
    const started = performance.now()
    const store = new VectorStore()
    store.add(active.chunks.map((chunk, index) => ({ chunk, vector: active.vectors[index] ?? [] })))
    const ranked = store.search(vector, Math.max(k, 2))
    const keyword = keywordSearch(active.chunks, query)
    const top = ranked.slice(0, k)
    const passing = top.filter((hit) => hit.score >= minScore)
    const semantic = passing.length > 0 ? top : ranked.slice(0, 2)
    return {
      query,
      semantic,
      keyword,
      belowThreshold: passing.length === 0,
      latencyMs: performance.now() - started,
      topK: k,
      threshold: minScore,
      embeddingModel: active.embeddingModel,
      dimensions: active.embeddingDimensions,
    }
  }

  function publish(saved: SavedRetrieval, nextMode?: PanelMode) {
    if (nextMode) setMode(nextMode)
    setPanel(savedToPanel(saved))
    return saved
  }

  async function retrieve(query: string, nextMode?: PanelMode): Promise<SavedRetrieval> {
    const active = latestRef.current.doc
    if (!active) throw new Error("Choose a document first.")
    const started = performance.now()
    let vector = queryVectorRef.current
    const sameQuestion = panel?.query === query && vector
    if (!sameQuestion || !vector) {
      if (status.embeddingProvider === "openai") {
        const response = await fetch("/api/embed", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text: query }),
        })
        const payload = (await response.json()) as { vector?: number[]; message?: string }
        if (!response.ok || !payload.vector) {
          throw new Error(payload.message || "Could not embed the question.")
        }
        vector = payload.vector
      } else {
        setProgress((current) => ({ ...current, phase: "embedding", modelPercent: current.modelPercent }))
        await ensureBrowserModel()
        const embedded = await embedWithBrowser([query])
        vector = embedded.vectors[0]
        setProgress({ phase: "ready", modelPercent: null, embedDone: 0, embedTotal: 0 })
      }
      if (!vector) throw new Error("Could not embed the question.")
      queryVectorRef.current = vector
    }
    const saved = searchCurrent(query, vector, latestRef.current.topK, latestRef.current.threshold)
    saved.latencyMs += performance.now() - started
    publish(saved, nextMode)
    return saved
  }

  function applyLocalAnswer(question: string, answer: string, saved: SavedRetrieval) {
    const user = localMessage("user", question)
    const assistant = localMessage("assistant", answer)
    chat.setMessages((current) => [...current, user, assistant])
    setRetrievals((current) => ({ ...current, [assistant.id]: saved }))
  }

  async function ask(question: string, options?: { compare?: boolean }) {
    if (!latestRef.current.doc) {
      setError("Choose a document first.")
      setMobileTab("document")
      return
    }
    setError(null)
    try {
      const saved = await retrieve(question, options?.compare ? "compare" : undefined)
      if (options?.compare) setMobileTab("sources")
      const passages = saved.belowThreshold
        ? []
        : saved.semantic.filter((hit) => hit.score >= saved.threshold)
      if (passages.length === 0) {
        applyLocalAnswer(question, NOT_FOUND_ANSWER, { ...saved, semantic: saved.semantic })
        return
      }
      if (!status.chatEnabled) {
        if (!options?.compare) setMobileTab("sources")
        return
      }
      latestRef.current.context = passages.map((hit, index) => ({
        n: index + 1,
        chunkId: hit.chunk.id,
        text: hit.chunk.text,
        page: hit.chunk.page ?? null,
        docName: latestRef.current.doc?.name ?? "Document",
      }))
      latestRef.current.pending = saved
      await chat.sendMessage({ text: question })
      setMobileTab("chat")
    } catch (caught) {
      setProgress({ phase: "idle", modelPercent: null, embedDone: 0, embedTotal: 0 })
      const message = caught instanceof Error ? caught.message : "Something went wrong."
      setError(message)
      toast.error(message)
    }
  }

  function rerunFromSlider(nextK: number, nextThreshold: number) {
    const vector = queryVectorRef.current
    const query = panel?.query
    if (!vector || !query) return
    const saved = searchCurrent(query, vector, nextK, nextThreshold)
    setPanel(savedToPanel(saved))
  }

  async function openSample(sampleId: string, after?: () => void) {
    try {
      await loadSample(sampleId)
      after?.()
    } catch (caught) {
      setProgress({ phase: "idle", modelPercent: null, embedDone: 0, embedTotal: 0 })
      setError(caught instanceof Error ? caught.message : "The sample could not be indexed.")
    }
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-end sm:justify-between sm:px-6 max-lg:max-h-[38dvh] max-lg:overflow-y-auto">
        <div className="min-w-0">
          <h1 className="font-serif text-3xl tracking-tight sm:text-4xl">Citewise</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground sm:text-base">
            Ask questions about a PDF or text file and get streamed answers that cite the passages they came from.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{PORTFOLIO_LINE}</p>
        </div>
        <Button
          type="button"
          data-testid="mouse-example"
          className="h-auto whitespace-normal py-2"
          onClick={() => {
            const run = () => {
              void openSample("voltline-catalog", () => {
                void ask(MOUSE_QUERY, { compare: true })
              })
            }
            if (latestRef.current.doc && latestRef.current.doc.sampleId !== "voltline-catalog") guardSwitch(run)
            else run()
          }}
        >
          Try the classic example: {MOUSE_QUERY}
        </Button>
      </div>

      <Tabs
        value={mobileTab}
        onValueChange={(value) => {
          if (value === "chat" || value === "sources" || value === "document") setMobileTab(value)
        }}
        className="shrink-0 px-3 pt-3 lg:hidden"
      >
        <TabsList data-testid="mobile-tabs" className="grid w-full grid-cols-3">
          <TabsTrigger value="chat">Chat</TabsTrigger>
          <TabsTrigger value="sources">Sources</TabsTrigger>
          <TabsTrigger value="document">Document</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="grid min-h-0 min-w-0 flex-1 max-lg:grid-rows-[minmax(0,1fr)] max-lg:overflow-hidden lg:grid-cols-[280px_minmax(0,1fr)_360px]">
        <div className={mobileTab === "document" ? "min-h-0 min-w-0 max-lg:h-full max-lg:overflow-hidden lg:block" : "hidden min-h-0 min-w-0 max-lg:h-full max-lg:overflow-hidden lg:block"}>
          <DocumentPane
            active={
              doc
                ? {
                    name: doc.name,
                    pages: doc.pages,
                    chunkCount: doc.chunks.length,
                    embeddingModel: doc.embeddingModel,
                    indexedMs: doc.indexedMs,
                    cached: doc.cached,
                  }
                : null
            }
            activeSampleId={doc?.sampleId}
            progress={progress}
            error={error}
            onSample={(sample) => {
              const run = () => {
                void openSample(sample.id)
              }
              if (doc && doc.sampleId !== sample.id) guardSwitch(run)
              else run()
            }}
            onUpload={(file) => {
              const run = () => {
                void uploadFile(file)
              }
              if (doc) guardSwitch(run)
              else run()
            }}
            onQuestion={(question) => {
              const sample = SAMPLES.find((item) => item.questions.includes(question))
              const run = () => {
                void openSample(sample?.id ?? latestRef.current.doc?.sampleId ?? "", () => {
                  void ask(question)
                })
              }
              if (!sample || latestRef.current.doc?.sampleId === sample.id) {
                void ask(question)
                return
              }
              if (doc) guardSwitch(run)
              else run()
            }}
            onMouseExample={() => {
              const run = () => {
                void openSample("voltline-catalog", () => {
                  void ask(MOUSE_QUERY, { compare: true })
                })
              }
              if (latestRef.current.doc && latestRef.current.doc.sampleId !== "voltline-catalog") guardSwitch(run)
              else run()
            }}
          />
        </div>
        <div className={mobileTab === "chat" ? "min-h-0 min-w-0 max-lg:h-full max-lg:overflow-hidden border-border lg:block lg:border-x" : "hidden min-h-0 min-w-0 max-lg:h-full max-lg:overflow-hidden lg:block lg:border-x"}>
          <ChatPane
            messages={chat.messages}
            status={chat.status}
            chatEnabled={status.chatEnabled}
            error={chat.error?.message ?? null}
            retrievals={retrievals}
            onSubmit={(question) => {
              void ask(question)
            }}
            onStop={() => chat.stop()}
            onNew={() => {
              chat.stop()
              chat.setMessages([])
              setRetrievals({})
              setPanel(null)
              queryVectorRef.current = null
            }}
            onCite={(messageId, n) => {
              const saved = retrievals[messageId]
              if (saved) setPanel(savedToPanel(saved))
              const chunkId = saved?.semantic[n - 1]?.chunk.id
              if (chunkId) {
                setHighlightedId(chunkId)
                setMobileTab("sources")
              }
            }}
            onOpenSources={(messageId) => {
              const saved = retrievals[messageId]
              if (saved) setPanel(savedToPanel(saved))
              setMobileTab("sources")
            }}
          />
        </div>
        <div className={mobileTab === "sources" ? "min-h-0 min-w-0 max-lg:h-full max-lg:overflow-hidden lg:block" : "hidden min-h-0 min-w-0 max-lg:h-full max-lg:overflow-hidden lg:block"}>
          <RetrievalPanel
            panel={panel}
            mode={mode}
            onMode={setMode}
            topK={topK}
            threshold={threshold}
            onTopK={(value) => {
              latestRef.current.topK = value
              setTopK(value)
              rerunFromSlider(value, latestRef.current.threshold)
            }}
            onThreshold={(value) => {
              latestRef.current.threshold = value
              setThreshold(value)
              rerunFromSlider(latestRef.current.topK, value)
            }}
            highlightedId={highlightedId}
            citedIds={citedIds}
          />
        </div>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Switch document?</DialogTitle>
            <DialogDescription>Switching documents clears this chat.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                chat.stop()
                chat.setMessages([])
                setRetrievals({})
                setConfirmOpen(false)
                const action = pendingAction.current
                pendingAction.current = null
                action?.()
              }}
            >
              Switch document
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {busy ? <span className="sr-only">Answer is streaming</span> : null}
    </div>
  )
}

function localMessage(role: "user" | "assistant", text: string): UIMessage {
  return { id: crypto.randomUUID(), role, parts: [{ type: "text", text }] }
}

function savedToPanel(saved: SavedRetrieval): PanelState {
  return saved
}
