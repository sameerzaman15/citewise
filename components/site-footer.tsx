import { FOOTER_NOTE } from "@/lib/copy"

export function SiteFooter() {
  return (
    <footer className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-border px-4 py-3 text-sm text-muted-foreground sm:px-6">
      <p>{FOOTER_NOTE}</p>
      <p>
        <a
          href="https://sameer-zaman.vercel.app"
          target="_blank"
          rel="noopener"
          className="text-foreground underline-offset-4 hover:underline"
        >
          Built by Sameer Zaman
        </a>
      </p>
    </footer>
  )
}
