import type { Metadata } from "next"
import { Pipeline } from "@/components/how-it-works/pipeline"
import { getPublicStatus } from "@/lib/ai/providers"
import { COMPARE_EXPLAINER, MOUSE_QUERY } from "@/lib/copy"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "How it works",
  description:
    "How Citewise chunks a document, embeds it, retrieves passages, and cites them. A concept demo by Sameer Zaman.",
}

export default function HowItWorksPage() {
  const status = getPublicStatus()
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
      <p className="text-sm text-primary">Concept demo</p>
      <h1 className="mt-2 font-serif text-4xl tracking-tight">How Citewise works</h1>
      <p className="mt-3 text-muted-foreground">
        A short tour of the pipeline behind the chat. Sample documents are fictional. This page is part of a portfolio
        demo by Sameer Zaman.
      </p>

      <div className="mt-8 rounded-xl border border-border bg-card p-4">
        <Pipeline />
      </div>

      <section className="mt-10 space-y-3">
        <h2 className="font-serif text-2xl">What chunking is</h2>
        <p>
          A model cannot read a whole handbook in one glance, and it should not. Citewise splits the file into passages
          of about 800 characters, with a little overlap when a long passage has to be cut, and it never cuts a word in
          half. Product catalogs split on the line between items. A PDF keeps the page number on each passage.
        </p>
        <p className="text-sm text-muted-foreground">
          Careful chunking is included in the RAG chatbot package.
        </p>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="font-serif text-2xl">What embeddings are</h2>
        <p>
          Each passage is turned into a list of numbers that stands for its meaning. The question is turned into the
          same kind of list. Citewise compares them with cosine similarity and keeps the closest passages. With an
          OpenAI key, that step uses text-embedding-3-small on the server. With no key, the browser downloads a small
          MiniLM model once and does the math locally.
        </p>
        <p className="text-sm text-muted-foreground">
          Choosing and running the embedding model is included in the RAG chatbot package.
        </p>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="font-serif text-2xl">Keyword search and semantic search</h2>
        <p>
          Try &quot;{MOUSE_QUERY}&quot; on the Voltline catalog. Keyword search requires every word to appear in the
          same passage, so it returns nothing: the wireless mice never say &quot;without&quot; or &quot;cable&quot;.
          Semantic search still ranks those mice first, because the meaning is the same.
        </p>
        <p>{COMPARE_EXPLAINER}</p>
        <p className="text-sm text-muted-foreground">
          The side-by-side comparison is included in the RAG chatbot package.
        </p>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="font-serif text-2xl">Why answers cite sources</h2>
        <p>
          The model is told to answer only from the numbered passages and to mark each claim with [1] or [2]. Those
          numbers become chips. Hover one to read the excerpt. Click it and the retrieval panel scrolls to that chunk.
          You can see the score, not just the sentence.
        </p>
        <p className="text-sm text-muted-foreground">
          Answers that point at the passage they used are included in the RAG chatbot package.
        </p>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="font-serif text-2xl">Why it says it could not find that</h2>
        <p>
          If no passage clears the score threshold, Citewise does not call the model. It replies &quot;I couldn&apos;t
          find that in this document.&quot; and shows the two closest passages greyed out. A question such as the
          CEO&apos;s favorite color should take that path. Guessing would be worse than a blank.
        </p>
        <p className="text-sm text-muted-foreground">
          A clear not-found reply is included in the RAG chatbot package.
        </p>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="font-serif text-2xl">What a production build adds</h2>
        <p>
          This demo keeps the index in the browser session and forgets uploads when you close the tab. A client build
          keeps vectors in a database such as Postgres with pgvector, signs people in, re-indexes when a document
          changes, and checks answers against an evaluation set. OCR for scanned PDFs, several documents at once, and
          admin tools sit on top of the same pipeline.
        </p>
        <p className="text-sm text-muted-foreground">
          That production version is the RAG chatbot package: a persistent index, sign-in, re-indexing, and an
          evaluation set.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="font-serif text-2xl">What this deployment is using</h2>
        <div className="mt-3 overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-left text-sm">
            <tbody>
              <Row label="Chat provider" value={status.llmProvider} />
              <Row label="Chat model" value={status.llmModel ?? "none"} />
              <Row label="Answers enabled" value={status.chatEnabled ? "yes" : "no"} />
              <Row label="OpenAI key set" value={status.hasOpenAIKey ? "yes" : "no"} />
              <Row label="Groq key set" value={status.hasGroqKey ? "yes" : "no"} />
              <Row label="Embedding provider" value={status.embeddingProvider} />
              <Row label="Embedding model" value={status.embeddingModel} />
              <Row label="Embedding dimensions" value={String(status.embeddingDimensions)} />
              <Row label="Rate limit store" value={status.rateLimit.backend} />
              <Row label="Chat limit" value={`${status.rateLimit.chatPer10Min} / 10 min`} />
              <Row label="Ingest limit" value={`${status.rateLimit.ingestPer10Min} / 10 min`} />
              <Row label="Embed limit" value={`${status.rateLimit.embedPer10Min} / 10 min`} />
              <Row
                label="Daily cap"
                value={
                  status.rateLimit.dailyCapActive
                    ? `${status.rateLimit.dailyRequestCap} chat requests`
                    : "off until Upstash is set"
                }
              />
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          The status route returns booleans and model names only. It never returns key values.
        </p>
      </section>
    </main>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <tr className="border-b border-border last:border-0">
      <th className="px-3 py-2 font-medium">{label}</th>
      <td className="px-3 py-2 font-mono text-xs tabular-nums">{value}</td>
    </tr>
  )
}
