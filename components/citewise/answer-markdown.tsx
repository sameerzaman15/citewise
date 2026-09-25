"use client"

import { Children, isValidElement, type ReactNode } from "react"
import ReactMarkdown from "react-markdown"
import { splitByCitations } from "@/lib/citations"
import type { RetrievalHit } from "@/lib/types"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

const ALLOWED = ["p", "ul", "ol", "li", "strong", "em", "code", "a", "h1", "h2", "h3", "blockquote", "br"]

export function AnswerMarkdown({
  text,
  hits,
  onCite,
}: {
  text: string
  hits: RetrievalHit[]
  onCite: (n: number) => void
}) {
  const render = (children: ReactNode) => <Inline hits={hits} onCite={onCite}>{children}</Inline>

  return (
    <ReactMarkdown
      allowedElements={ALLOWED}
      unwrapDisallowed
      components={{
        p: ({ children }) => <p className="mb-2 leading-relaxed last:mb-0">{render(children)}</p>,
        ul: ({ children }) => <ul className="mb-2 list-disc space-y-1 pl-5 last:mb-0">{children}</ul>,
        ol: ({ children }) => <ol className="mb-2 list-decimal space-y-1 pl-5 last:mb-0">{children}</ol>,
        li: ({ children }) => <li>{render(children)}</li>,
        strong: ({ children }) => <strong className="font-semibold">{render(children)}</strong>,
        em: ({ children }) => <em>{render(children)}</em>,
        h1: ({ children }) => <h3 className="mt-3 mb-1 font-serif text-lg">{render(children)}</h3>,
        h2: ({ children }) => <h3 className="mt-3 mb-1 font-serif text-lg">{render(children)}</h3>,
        h3: ({ children }) => <h3 className="mt-3 mb-1 font-serif text-base">{render(children)}</h3>,
        blockquote: ({ children }) => (
          <blockquote className="my-2 border-l-2 border-primary/40 pl-3 text-muted-foreground">{children}</blockquote>
        ),
        code: ({ children }) => (
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">{children}</code>
        ),
        a: ({ href, children }) => {
          if (!href || !/^https?:\/\//i.test(href)) return <span>{children}</span>
          return (
            <a href={href} target="_blank" rel="noopener" className="text-primary underline-offset-4 hover:underline">
              {children}
            </a>
          )
        },
      }}
    >
      {text}
    </ReactMarkdown>
  )
}

function Inline({
  children,
  hits,
  onCite,
}: {
  children: ReactNode
  hits: RetrievalHit[]
  onCite: (n: number) => void
}) {
  return Children.map(children, (child, index) => {
    if (typeof child === "string") {
      return splitByCitations(child).map((part, partIndex) =>
        part.type === "text" ? (
          <span key={`${index}-${partIndex}`}>{part.value}</span>
        ) : (
          <CiteChip key={`${index}-${partIndex}`} n={part.n} hit={hits[part.n - 1]} onCite={onCite} />
        ),
      )
    }
    if (isValidElement<{ children?: ReactNode }>(child) && child.props.children) {
      return child
    }
    return child
  })
}

function CiteChip({
  n,
  hit,
  onCite,
}: {
  n: number
  hit: RetrievalHit | undefined
  onCite: (n: number) => void
}) {
  const excerpt = hit?.chunk.text.slice(0, 280) ?? "This number is not in the retrieved passages."
  const page = hit?.chunk.page ? `Page ${hit.chunk.page}` : "No page number"

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={() => onCite(n)}
          className="mx-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 align-baseline font-mono text-[11px] font-medium text-primary-foreground tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {n}
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <p className="mb-1 font-mono text-[11px] text-muted-foreground">{page}</p>
        <p className="font-serif text-sm leading-snug">{excerpt}</p>
      </TooltipContent>
    </Tooltip>
  )
}
