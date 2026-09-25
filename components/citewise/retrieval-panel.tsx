"use client"

import { useState } from "react"
import { COMPARE_EXPLAINER, KEYWORD_LABEL } from "@/lib/copy"
import { formatScore } from "@/lib/format"
import { highlightParts } from "@/lib/highlight"
import type { Chunk, RetrievalHit } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { RetrievalSettings } from "@/components/citewise/retrieval-settings"
import { cn } from "@/lib/utils"

export type PanelMode = "semantic" | "keyword" | "compare"

export type PanelState = {
  query: string
  semantic: RetrievalHit[]
  keyword: Chunk[]
  belowThreshold: boolean
  latencyMs: number
  topK: number
  threshold: number
  embeddingModel: string
  dimensions: number
}

export function RetrievalPanel({
  panel,
  mode,
  onMode,
  topK,
  threshold,
  onTopK,
  onThreshold,
  highlightedId,
  citedIds,
}: {
  panel: PanelState | null
  mode: PanelMode
  onMode: (mode: PanelMode) => void
  topK: number
  threshold: number
  onTopK: (value: number) => void
  onThreshold: (value: number) => void
  highlightedId: string | null
  citedIds: Set<string>
}) {
  return (
    <section className="flex h-full min-h-0 min-w-0 flex-col" aria-label="What the AI read" data-testid="retrieval-panel">
      <div className="flex items-start justify-between gap-2 border-b border-border px-3 py-3">
        <div className="min-w-0">
          <h2 className="font-serif text-lg">What the AI read</h2>
          <p className="break-words text-sm text-muted-foreground [overflow-wrap:anywhere]">
            {panel?.query ? panel.query : "Ask a question to see the passages."}
          </p>
        </div>
        <Advanced
          topK={topK}
          threshold={threshold}
          onTopK={onTopK}
          onThreshold={onThreshold}
        />
      </div>
      <div className="px-3 py-2">
        <ToggleGroup
          type="single"
          value={mode}
          onValueChange={(value) => {
            if (value === "semantic" || value === "keyword" || value === "compare") onMode(value)
          }}
          variant="outline"
          size="sm"
          className="w-full"
          aria-label="Retrieval view"
        >
          <ToggleGroupItem value="semantic" className="flex-1">Semantic</ToggleGroupItem>
          <ToggleGroupItem value="keyword" className="flex-1">Keyword</ToggleGroupItem>
          <ToggleGroupItem value="compare" className="flex-1" data-testid="mode-compare">Compare</ToggleGroupItem>
        </ToggleGroup>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {!panel ? (
          <p className="px-1 py-6 text-sm text-muted-foreground">
            Retrieved passages show up here with a similarity score, a page label, and the text the model was given.
          </p>
        ) : mode === "compare" ? (
          <CompareView panel={panel} highlightedId={highlightedId} citedIds={citedIds} />
        ) : mode === "keyword" ? (
          <KeywordList chunks={panel.keyword} />
        ) : (
          <SemanticList
            hits={panel.semantic}
            query={panel.query}
            threshold={panel.threshold}
            belowThreshold={panel.belowThreshold}
            highlightedId={highlightedId}
            citedIds={citedIds}
          />
        )}
      </div>
      <footer className="break-words border-t border-border px-3 py-2 font-mono text-[11px] leading-relaxed text-muted-foreground tabular-nums [overflow-wrap:anywhere]">
        {panel
          ? `top-k ${panel.topK} · threshold ${panel.threshold.toFixed(2)} · ${panel.embeddingModel} · ${panel.dimensions} dims · ${Math.round(panel.latencyMs)} ms`
          : `top-k ${topK} · threshold ${threshold.toFixed(2)}`}
      </footer>
    </section>
  )
}

function Advanced(props: {
  topK: number
  threshold: number
  onTopK: (value: number) => void
  onThreshold: (value: number) => void
}) {
  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" size="sm" className="hidden lg:inline-flex">
            Advanced
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72">
          <p className="mb-3 text-sm font-medium">Advanced</p>
          <RetrievalSettings {...props} />
        </PopoverContent>
      </Popover>
      <Sheet>
        <SheetTrigger asChild>
          <Button type="button" variant="outline" size="sm" className="lg:hidden">
            Advanced
          </Button>
        </SheetTrigger>
        <SheetContent side="bottom">
          <SheetHeader>
            <SheetTitle>Advanced</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-6">
            <RetrievalSettings {...props} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}

function CompareView({
  panel,
  highlightedId,
  citedIds,
}: {
  panel: PanelState
  highlightedId: string | null
  citedIds: Set<string>
}) {
  const top = panel.semantic[0]
  return (
    <div className="grid min-w-0 gap-3">
      <div className="grid min-w-0 grid-cols-2 gap-2">
        <div className="min-w-0 rounded-lg border border-border p-2">
          <p className="text-xs text-muted-foreground">{KEYWORD_LABEL}</p>
          <p className="mt-1 font-mono text-3xl tabular-nums" data-testid="keyword-count">
            {panel.keyword.length}
          </p>
          <p className="text-sm text-muted-foreground">{panel.keyword.length === 1 ? "result" : "results"}</p>
          <KeywordList chunks={panel.keyword} compact />
        </div>
        <div className="min-w-0 rounded-lg border border-border p-2">
          <p className="text-xs text-muted-foreground">Semantic search: ranked by meaning</p>
          <SemanticList
            hits={panel.semantic}
            query={panel.query}
            threshold={panel.threshold}
            belowThreshold={false}
            highlightedId={highlightedId}
            citedIds={citedIds}
          />
        </div>
      </div>
      <div className="rounded-lg bg-accent px-3 py-2 text-sm leading-relaxed">
        <p>{COMPARE_EXPLAINER}</p>
        {top ? (
          <p className="mt-1 font-mono text-xs tabular-nums" data-testid="semantic-score">
            Top semantic match scored {formatScore(top.score)} with this model.
          </p>
        ) : null}
      </div>
    </div>
  )
}

function KeywordList({ chunks, compact = false }: { chunks: Chunk[]; compact?: boolean }) {
  if (chunks.length === 0) {
    return <p className={cn("text-sm text-muted-foreground", !compact && "px-1 py-4")}>No chunk contains every word.</p>
  }
  return (
    <ul className="mt-2 grid gap-2">
      {chunks.slice(0, 8).map((chunk) => (
        <li key={chunk.id} className="rounded-md bg-muted px-2 py-1.5 text-sm">
          <ChunkLabel chunk={chunk} />
          <p className="mt-1 line-clamp-3 break-words font-serif leading-snug [overflow-wrap:anywhere]">{chunk.text}</p>
        </li>
      ))}
    </ul>
  )
}

function SemanticList({
  hits,
  query,
  threshold,
  belowThreshold,
  highlightedId,
  citedIds,
}: {
  hits: RetrievalHit[]
  query: string
  threshold: number
  belowThreshold: boolean
  highlightedId: string | null
  citedIds: Set<string>
}) {
  if (hits.length === 0) {
    return <p className="px-1 py-4 text-sm text-muted-foreground">No passages yet.</p>
  }
  return (
    <ol className="mt-2 grid gap-2">
      {belowThreshold ? (
        <li className="text-xs text-muted-foreground">Closest matches, below the score threshold.</li>
      ) : null}
      {hits.map((hit, rank) => (
        <SemanticRow
          key={hit.chunk.id}
          hit={hit}
          rank={rank + 1}
          query={query}
          muted={belowThreshold || hit.score < threshold}
          highlighted={highlightedId === hit.chunk.id}
          cited={citedIds.has(hit.chunk.id)}
          lead={rank === 0}
        />
      ))}
    </ol>
  )
}

function SemanticRow({
  hit,
  rank,
  query,
  muted,
  highlighted,
  cited,
  lead,
}: {
  hit: RetrievalHit
  rank: number
  query: string
  muted: boolean
  highlighted: boolean
  cited: boolean
  lead: boolean
}) {
  const [open, setOpen] = useState(false)
  const parts = highlightParts(open ? hit.chunk.text : hit.chunk.text, query)
  return (
    <li
      id={`chunk-${hit.chunk.id}`}
      data-testid={lead ? "semantic-top" : undefined}
      className={cn(
        "scroll-mt-3 rounded-lg border border-border bg-card p-2",
        cited && "border-l-4 border-l-[#FDE68A]",
        highlighted && "ring-2 ring-primary",
        muted && "opacity-70",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs tabular-nums text-muted-foreground">{rank}</span>
        <span className="font-mono text-sm tabular-nums">{formatScore(hit.score)}</span>
        {cited ? <Badge>Cited</Badge> : null}
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-stone-200 dark:bg-stone-700" aria-hidden>
        <div
          className={cn("h-full rounded-full", muted ? "bg-stone-400" : "bg-primary")}
          style={{ width: `${Math.max(2, Math.min(100, hit.score * 100))}%` }}
        />
      </div>
      <div className="mt-2">
        <ChunkLabel chunk={hit.chunk} />
      </div>
      <p className={cn("mt-1 break-words font-serif text-sm leading-snug [overflow-wrap:anywhere]", !open && "line-clamp-3")}>
        {parts.map((part, index) =>
          part.match ? (
            <mark key={index} className="rounded-sm bg-highlight px-0.5 text-inherit">
              {part.text}
            </mark>
          ) : (
            <span key={index}>{part.text}</span>
          ),
        )}
      </p>
      <Button type="button" variant="ghost" size="sm" className="mt-1 px-0" onClick={() => setOpen((value) => !value)}>
        {open ? "Show less" : "Show full chunk"}
      </Button>
    </li>
  )
}

function ChunkLabel({ chunk }: { chunk: Chunk }) {
  const page = chunk.page ? `p. ${chunk.page}` : "no page"
  return (
    <p className="font-mono text-[11px] text-muted-foreground">
      Chunk {chunk.index + 1} · {page}
    </p>
  )
}
