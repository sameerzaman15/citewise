"use client"

import { useEffect, useRef, useState } from "react"

const STEPS = ["Upload", "Parse", "Chunk", "Embed", "Retrieve", "Answer"]

export function Pipeline() {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setVisible(true)
      },
      { threshold: 0.4 },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={ref} className="overflow-x-auto" aria-label="Indexing pipeline">
      <svg viewBox="0 0 920 120" className="h-28 w-full min-w-[640px]" role="img">
        <title>Upload, parse, chunk, embed, retrieve, then answer with citations</title>
        {STEPS.map((step, index) => {
          const x = 20 + index * 150
          return (
            <g key={step}>
              {index < STEPS.length - 1 ? (
                <line
                  x1={x + 108}
                  y1={46}
                  x2={x + 142}
                  y2={46}
                  stroke="#4338CA"
                  strokeWidth="2"
                  strokeDasharray="40"
                  strokeDashoffset={visible ? 0 : 40}
                  style={{ transition: "stroke-dashoffset 700ms ease" }}
                />
              ) : null}
              <rect x={x} y={22} width={108} height={48} rx={10} fill="#FFFFFF" stroke="#4338CA" />
              <text x={x + 54} y={51} textAnchor="middle" fontSize="14" fill="#1C1917" fontFamily="Georgia, serif">
                {step}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
