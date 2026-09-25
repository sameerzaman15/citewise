"use client"

import { useState } from "react"
import { FileText, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import {
  FILE_TOO_LARGE,
  MAX_UPLOAD_BYTES,
  MOUSE_QUERY,
  PRIVACY_NOTE,
  UNSUPPORTED_TYPE,
} from "@/lib/copy"
import { formatBytes, formatSeconds } from "@/lib/format"
import { SAMPLES } from "@/lib/samples"
import type { SampleMeta } from "@/lib/types"

export type ActiveDocView = {
  name: string
  pages: number | null
  chunkCount: number
  embeddingModel: string
  indexedMs: number
  cached: boolean
}

export type IndexProgress = {
  phase: "idle" | "reading" | "embedding" | "ready"
  modelPercent: number | null
  embedDone: number
  embedTotal: number
}

export function DocumentPane({
  active,
  activeSampleId,
  progress,
  error,
  onSample,
  onUpload,
  onQuestion,
  onMouseExample,
}: {
  active: ActiveDocView | null
  activeSampleId?: string
  progress: IndexProgress
  error: string | null
  onSample: (sample: SampleMeta) => void
  onUpload: (file: File) => void
  onQuestion: (question: string) => void
  onMouseExample: () => void
}) {
  const [dragOver, setDragOver] = useState(false)
  const busy = progress.phase === "reading" || progress.phase === "embedding"

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto p-3 sm:p-4">
      <div>
        <h2 className="font-serif text-lg">Documents</h2>
        <p className="mt-1 text-sm text-muted-foreground">One document at a time. Samples are fictional.</p>
      </div>

      <ul className="grid gap-2">
        {SAMPLES.map((sample) => (
          <li key={sample.id}>
            <Card className={activeSampleId === sample.id ? "ring-2 ring-primary" : undefined}>
              <CardContent className="grid gap-2 p-3">
                <button
                  type="button"
                  data-testid={`sample-${sample.id}`}
                  className="text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => onSample(sample)}
                  disabled={busy}
                >
                  <span className="flex items-start gap-2">
                    <FileText className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                    <span>
                      <span className="block font-medium leading-snug">{sample.title}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {sample.kind.toUpperCase()} · {formatBytes(sample.bytes)}
                      </span>
                    </span>
                  </span>
                </button>
                <p className="text-sm text-muted-foreground">{sample.blurb}</p>
                <div className="flex flex-wrap gap-1.5">
                  {sample.questions.map((question) => (
                    <button
                      key={question}
                      type="button"
                      className="rounded-full border border-border bg-background px-2 py-1 text-left text-xs text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={() => onQuestion(question)}
                      disabled={busy}
                    >
                      {question}
                    </button>
                  ))}
                </div>
                {sample.id === "voltline-catalog" ? (
                  <Button
                    type="button"
                    variant="secondary"
                    className="h-auto whitespace-normal py-2 text-left"
                    onClick={onMouseExample}
                    disabled={busy}
                  >
                    Try the classic example: {MOUSE_QUERY}
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>

      <div
        className={`rounded-lg border border-dashed p-3 ${dragOver ? "border-primary bg-accent" : "border-border bg-card"}`}
        onDragOver={(event) => {
          event.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(event) => {
          event.preventDefault()
          setDragOver(false)
          const file = event.dataTransfer.files[0]
          if (file) onUpload(file)
        }}
      >
        <label className="grid cursor-pointer gap-2 text-sm">
          <span className="flex items-center gap-2 font-medium">
            <Upload className="size-4 text-primary" aria-hidden />
            Upload a PDF, TXT, or MD file
          </span>
          <span className="text-muted-foreground">Up to 4 MB, 50 pages, and 200,000 characters.</span>
          <input
            data-testid="upload-input"
            className="sr-only"
            type="file"
            accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ""
              if (file) onUpload(file)
            }}
          />
        </label>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{PRIVACY_NOTE}</p>
      </div>

      {error ? (
        <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {progress.phase !== "idle" && progress.phase !== "ready" ? (
        <div className="rounded-lg border border-border bg-card p-3" aria-live="polite">
          <p className="text-sm font-medium">Indexing</p>
          <ol className="mt-2 grid gap-1 text-sm text-muted-foreground">
            <li>{progress.phase === "reading" ? "Parsing and chunking…" : "Parsing and chunking, done."}</li>
            <li>
              {progress.phase === "embedding"
                ? `Embedding ${progress.embedDone} of ${progress.embedTotal || "…"}`
                : "Embedding"}
            </li>
          </ol>
          {progress.modelPercent !== null ? (
            <div className="mt-3 grid gap-1">
              <p className="text-xs text-muted-foreground">Loading the embedding model (23 MB)…</p>
              <Progress value={progress.modelPercent} />
            </div>
          ) : null}
          {progress.phase === "embedding" && progress.embedTotal > 0 ? (
            <Progress className="mt-3" value={(progress.embedDone / progress.embedTotal) * 100} />
          ) : null}
        </div>
      ) : null}

      {active ? (
        <Card data-testid="active-doc">
          <CardContent className="grid gap-1 p-3 text-sm">
            <p className="font-medium">{active.name}</p>
            <p className="text-muted-foreground">
              {active.pages ? `${active.pages} pages` : "Text file"} ·{" "}
              <span data-testid="chunk-count">{active.chunkCount}</span> chunks
            </p>
            <p className="font-mono text-xs text-muted-foreground" data-testid="embedding-model">
              {active.embeddingModel}
            </p>
            <p>
              Indexed in {formatSeconds(active.indexedMs)}
              {active.cached ? " (from cache)" : ""}
            </p>
          </CardContent>
        </Card>
      ) : null}

    </div>
  )
}

export function clientUploadError(file: File): string | null {
  if (!/\.(pdf|txt|md)$/i.test(file.name)) return UNSUPPORTED_TYPE
  if (file.size > MAX_UPLOAD_BYTES) return FILE_TOO_LARGE
  return null
}
