import { CitewiseApp } from "@/components/citewise/citewise-app"
import { getPublicStatus } from "@/lib/ai/providers"

export const dynamic = "force-dynamic"

export default function HomePage() {
  const status = getPublicStatus()
  return (
    <main data-citewise="" className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden lg:h-[calc(100dvh-7.5rem)]">
      <CitewiseApp initialStatus={status} />
    </main>
  )
}
