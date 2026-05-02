import { getDocumentProxy } from "unpdf"

export type ResumeExtractResult =
  | { ok: true; text: string }
  | { ok: false; reason: "empty" | "extract_failed"; message?: string }

type TextItem = {
  str: string
  transform: number[]
  width: number
  height: number
  hasEOL?: boolean
}

export async function extractResumeText(buffer: ArrayBuffer): Promise<ResumeExtractResult> {
  try {
    const pdf = await getDocumentProxy(new Uint8Array(buffer))
    const pages: string[] = []

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const content = await page.getTextContent()
      pages.push(reflowItems(content.items as TextItem[]))
    }

    const cleaned = pages.join("\n\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim()

    if (!cleaned) {
      return { ok: false, reason: "empty" }
    }

    return { ok: true, text: cleaned }
  } catch (error) {
    return {
      ok: false,
      reason: "extract_failed",
      message: error instanceof Error ? error.message : "Unknown extraction error",
    }
  }
}

function reflowItems(items: TextItem[]): string {
  if (items.length === 0) return ""

  type Positioned = { str: string; x: number; y: number; width: number; height: number; hasEOL: boolean }
  const positioned: Positioned[] = items
    .filter((it) => it && typeof it.str === "string")
    .map((it) => ({
      str: it.str,
      x: it.transform?.[4] ?? 0,
      y: it.transform?.[5] ?? 0,
      width: it.width ?? 0,
      height: it.height ?? Math.abs(it.transform?.[3] ?? 10),
      hasEOL: Boolean(it.hasEOL),
    }))

  if (positioned.length === 0) return ""

  const yTolerance = Math.max(2, median(positioned.map((p) => p.height)) * 0.5)

  const lines: Positioned[][] = []
  let currentLine: Positioned[] = []
  let currentY: number | null = null

  for (const item of positioned) {
    if (currentY === null || Math.abs(item.y - currentY) <= yTolerance) {
      currentLine.push(item)
      currentY = currentY === null ? item.y : currentY
    } else {
      if (currentLine.length) lines.push(currentLine)
      currentLine = [item]
      currentY = item.y
    }
    if (item.hasEOL) {
      lines.push(currentLine)
      currentLine = []
      currentY = null
    }
  }
  if (currentLine.length) lines.push(currentLine)

  const lineStrings = lines.map((line) => {
    const sorted = [...line].sort((a, b) => a.x - b.x)
    let out = ""
    let prev: Positioned | null = null

    for (const item of sorted) {
      const raw = item.str
      if (!raw) continue

      if (prev) {
        const gap = item.x - (prev.x + prev.width)
        const spaceWidth = Math.max(prev.height, item.height) * 0.2
        const prevEndsSpace = /\s$/.test(out)
        const startsSpace = /^\s/.test(raw)

        if (!prevEndsSpace && !startsSpace && gap > spaceWidth) {
          out += " "
        }
      }

      out += raw
      prev = item
    }

    return out.replace(/[ \t]+/g, " ").trim()
  })

  return lineStrings.filter((l) => l.length > 0).join("\n")
}

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].filter((v) => v > 0).sort((a, b) => a - b)
  if (sorted.length === 0) return 0
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}
