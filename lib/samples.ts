import type { SampleMeta } from "@/lib/types"

export const SAMPLES: SampleMeta[] = [
  {
    id: "voltline-catalog",
    title: "Voltline Electronics product catalog",
    fileName: "voltline-catalog.txt",
    kind: "txt",
    bytes: 14432,
    blurb: "Fictional catalog of mice, keyboards, displays, and cables.",
    questions: [
      "Which wireless mouse is made for travel?",
      "What does the Voltline Line mouse connect with?",
    ],
  },
  {
    id: "harbor-pine-handbook",
    title: "Harbor & Pine Studio employee handbook",
    fileName: "harbor-pine-handbook.pdf",
    kind: "pdf",
    bytes: 18615,
    blurb: "Fictional handbook covering remote work, leave, and security.",
    questions: [
      "Can I work from another country for a month?",
      "How much parental leave do I get?",
    ],
  },
  {
    id: "tidewatch-help-center",
    title: "Tidewatch help center",
    fileName: "tidewatch-help-center.txt",
    kind: "txt",
    bytes: 5375,
    blurb: "Help docs for a fictional uptime monitor: checks, alerts, status pages, billing.",
    questions: [
      "How do status pages stay updated?",
      "What happens when a monitor fails?",
    ],
  },
]

export function sampleById(id: string): SampleMeta | undefined {
  return SAMPLES.find((sample) => sample.id === id)
}
