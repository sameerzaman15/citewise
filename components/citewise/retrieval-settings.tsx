"use client"

import { Slider } from "@/components/ui/slider"

export function RetrievalSettings({
  topK,
  threshold,
  onTopK,
  onThreshold,
}: {
  topK: number
  threshold: number
  onTopK: (value: number) => void
  onThreshold: (value: number) => void
}) {
  return (
    <div className="grid gap-4">
      <label className="grid gap-2 text-sm">
        <span className="flex items-center justify-between">
          Top passages
          <span className="font-mono tabular-nums">{topK}</span>
        </span>
        <Slider
          min={1}
          max={8}
          step={1}
          value={[topK]}
          onValueChange={(value) => {
            const next = value[0]
            if (typeof next === "number") onTopK(next)
          }}
          aria-label="Number of passages to retrieve"
        />
      </label>
      <label className="grid gap-2 text-sm">
        <span className="flex items-center justify-between">
          Minimum score
          <span className="font-mono tabular-nums">{threshold.toFixed(2)}</span>
        </span>
        <Slider
          min={0.05}
          max={0.8}
          step={0.01}
          value={[threshold]}
          onValueChange={(value) => {
            const next = value[0]
            if (typeof next === "number") onThreshold(Number(next.toFixed(2)))
          }}
          aria-label="Minimum similarity score"
        />
      </label>
    </div>
  )
}
