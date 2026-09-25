import Link from "next/link"
import { ThemeToggle } from "@/components/theme-toggle"
import { Badge } from "@/components/ui/badge"

export function SiteHeader() {
  return (
    <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-6">
      <div className="flex min-w-0 items-center gap-2">
        <Link href="/" className="font-serif text-xl tracking-tight text-foreground">
          Citewise
        </Link>
        <Badge variant="outline" data-testid="concept-badge">
          Concept demo
        </Badge>
      </div>
      <nav className="flex items-center gap-1 sm:gap-2" aria-label="Pages">
        <Link
          href="/"
          className="rounded-md px-2 py-1 text-sm text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          App
        </Link>
        <Link
          href="/how-it-works"
          className="rounded-md px-2 py-1 text-sm text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          How it works
        </Link>
        <ThemeToggle />
      </nav>
    </header>
  )
}
