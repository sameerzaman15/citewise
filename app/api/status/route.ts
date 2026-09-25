import { getPublicStatus } from "@/lib/ai/providers"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export function GET() {
  return Response.json(getPublicStatus())
}
