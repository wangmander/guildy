"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  uploadResumeAction,
  saveResumeTextAction,
  completeOnboardingAction,
} from "./actions"

const PDF_FALLBACK_COPY =
  "PDF couldn't be read. This is common for designer-exported PDFs. Paste your resume text below, or copy your LinkedIn About + Experience."

export function OnboardingForm({ initialText }: { initialText: string }) {
  const router = useRouter()
  const [text, setText] = useState(initialText)
  const [savedText, setSavedText] = useState(initialText)
  const [pdfNotice, setPdfNotice] = useState<string | null>(null)
  const [status, setStatus] = useState<{ tone: "info" | "success" | "error"; text: string } | null>(null)
  const [pending, startTransition] = useTransition()

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    const fd = new FormData()
    fd.append("resume", file)

    setPdfNotice(null)
    setStatus({ tone: "info", text: "Reading PDF..." })

    startTransition(async () => {
      const result = await uploadResumeAction(fd)

      if (result.extractedText) {
        setText(result.extractedText)
      }

      if (result.ok) {
        if (result.extractedText) setSavedText(result.extractedText)
        setStatus({ tone: "success", text: "Resume saved." })
        setPdfNotice(null)
      } else if (result.reason === "pdf_unreadable") {
        setPdfNotice(PDF_FALLBACK_COPY)
        setStatus(null)
      } else {
        setStatus({ tone: "error", text: result.message ?? "Upload failed." })
      }

      event.target.value = ""
    })
  }

  function handleContinue() {
    const trimmed = text.trim()
    if (trimmed.length === 0 && savedText.trim().length === 0) return

    startTransition(async () => {
      if (trimmed.length > 0 && text !== savedText) {
        const fd = new FormData()
        fd.append("resume_text", text)
        setStatus({ tone: "info", text: "Saving..." })
        const saveResult = await saveResumeTextAction(fd)
        if (!saveResult.ok) {
          setStatus({ tone: "error", text: saveResult.message ?? "Save failed." })
          return
        }
        setSavedText(text)
      }

      const completeResult = await completeOnboardingAction()
      if (completeResult && !completeResult.ok) {
        setStatus({ tone: "error", text: completeResult.message })
        return
      }
      router.refresh()
    })
  }

  const hasText = text.trim().length > 0
  const hasSavedText = savedText.trim().length > 0
  const canContinue = (hasText || hasSavedText) && !pending
  const showPdfNotice = pdfNotice !== null && !hasText

  return (
    <>
      <div className="space-y-8">
        <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-[#482C4C]">Upload PDF</h2>
            <p className="text-sm text-gray-600 mt-1">
              We extract the text and save it to your profile. Designer-exported and scanned PDFs
              may not extract cleanly; paste the text below if so.
            </p>
          </div>
          <input
            type="file"
            accept="application/pdf"
            onChange={handleUpload}
            disabled={pending}
            className="block w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-medium file:bg-[#482C4C] file:text-white hover:file:bg-[#3a2440] disabled:opacity-60"
          />
          {pdfNotice && (
            <div
              className={
                showPdfNotice
                  ? "text-sm bg-amber-50 border border-amber-200 text-amber-900 rounded-lg p-3"
                  : "text-xs text-gray-400"
              }
            >
              {pdfNotice}
            </div>
          )}
        </div>

        <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-[#482C4C]">Paste resume or background</h2>
            <p className="text-sm text-gray-600 mt-1">
              Paste your resume text, LinkedIn About + Experience, or a short background summary.
              You can edit this later.
            </p>
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={14}
            placeholder="Paste resume text or a structured summary of your background..."
            className="w-full p-4 rounded-xl border border-[#E5E7EB] text-sm text-gray-900 focus:outline-none focus:border-[#482C4C] focus:ring-2 focus:ring-[#482C4C]/20 font-mono"
            disabled={pending}
          />
          <p className="text-sm text-gray-500">More detail improves prep.</p>
        </div>

        {status && (
          <div
            className={
              status.tone === "error"
                ? "text-sm text-red-700"
                : status.tone === "success"
                ? "text-sm text-green-700"
                : "text-sm text-gray-600"
            }
          >
            {status.text}
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur border-t border-[#E5E7EB] px-4 py-4 z-10">
        <div className="w-full max-w-[720px] mx-auto flex justify-end">
          <button
            type="button"
            onClick={handleContinue}
            disabled={!canContinue}
            className="px-8 py-3 rounded-full bg-[#482C4C] text-white font-medium text-base hover:bg-[#3a2440] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {pending ? "Saving..." : "Continue to Guildy"}
          </button>
        </div>
      </div>
    </>
  )
}
