"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  uploadResumeAction,
  saveResumeTextAction,
  completeOnboardingAction,
} from "./actions"

const MIN_RESUME_CHARS = 200

export function OnboardingForm({ initialText }: { initialText: string }) {
  const router = useRouter()
  const [text, setText] = useState(initialText)
  const [savedText, setSavedText] = useState(initialText)
  const [message, setMessage] = useState<string | null>(null)
  const [tone, setTone] = useState<"info" | "error" | "success">("info")
  const [pending, startTransition] = useTransition()

  function announce(next: string, nextTone: typeof tone = "info") {
    setMessage(next)
    setTone(nextTone)
  }

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    const fd = new FormData()
    fd.append("resume", file)

    announce("Reading PDF...", "info")
    startTransition(async () => {
      const result = await uploadResumeAction(fd)
      if (result.extractedText) {
        setText(result.extractedText)
      }
      if (result.ok) {
        if (result.extractedText) setSavedText(result.extractedText)
        announce("Resume saved.", "success")
      } else {
        announce(result.message ?? "Upload failed.", "error")
      }
      event.target.value = ""
    })
  }

  function handleSaveText() {
    const fd = new FormData()
    fd.append("resume_text", text)
    announce("Saving...", "info")
    startTransition(async () => {
      const result = await saveResumeTextAction(fd)
      if (result.ok) {
        setSavedText(text)
        announce("Resume text saved.", "success")
      } else {
        announce(result.message ?? "Save failed.", "error")
      }
    })
  }

  function handleContinue() {
    startTransition(async () => {
      const result = await completeOnboardingAction()
      if (result && !result.ok) {
        announce(result.message, "error")
        return
      }
      router.refresh()
    })
  }

  const canContinue = savedText.trim().length >= MIN_RESUME_CHARS && !pending
  const charCount = text.trim().length

  return (
    <div className="space-y-8">
      <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-[#482C4C]">Upload PDF</h2>
          <p className="text-sm text-gray-600 mt-1">
            We extract the text and save it to your profile. Scanned image PDFs may not extract
            cleanly; paste the text below if so.
          </p>
        </div>
        <input
          type="file"
          accept="application/pdf"
          onChange={handleUpload}
          disabled={pending}
          className="block w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-medium file:bg-[#482C4C] file:text-white hover:file:bg-[#3a2440] disabled:opacity-60"
        />
      </div>

      <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-[#482C4C]">Or paste resume / background</h2>
          <p className="text-sm text-gray-600 mt-1">
            At least {MIN_RESUME_CHARS} characters. Edit anytime in settings.
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
        <div className="flex items-center justify-between text-sm">
          <span
            className={
              charCount >= MIN_RESUME_CHARS ? "text-green-700" : "text-gray-500"
            }
          >
            {charCount} / {MIN_RESUME_CHARS} characters
          </span>
          <button
            type="button"
            onClick={handleSaveText}
            disabled={pending || text === savedText || text.trim().length < MIN_RESUME_CHARS}
            className="px-5 py-2 rounded-full bg-[#482C4C] text-white font-medium text-sm hover:bg-[#3a2440] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            Save text
          </button>
        </div>
      </div>

      {message && (
        <div
          className={
            tone === "error"
              ? "text-sm text-red-700"
              : tone === "success"
              ? "text-sm text-green-700"
              : "text-sm text-gray-600"
          }
        >
          {message}
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleContinue}
          disabled={!canContinue}
          className="px-8 py-3 rounded-full bg-[#482C4C] text-white font-medium text-base hover:bg-[#3a2440] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          Continue to Guildy
        </button>
      </div>
    </div>
  )
}
