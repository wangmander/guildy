"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { saveResumeTextAction, completeOnboardingAction } from "./actions"

export function OnboardingForm({ initialText }: { initialText: string }) {
  const router = useRouter()
  const [text, setText] = useState(initialText)
  const [savedText, setSavedText] = useState(initialText)
  const [status, setStatus] = useState<{ tone: "info" | "success" | "error"; text: string } | null>(null)
  const [pending, startTransition] = useTransition()

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

      // Prompt 21: the unauth Quick Prep funnel stashes a handoff uuid in
      // localStorage at /signup (it has to survive the magic-link email
      // round trip). Read it here and hand it to completion; clear it so
      // a later re-onboard does not replay a consumed handoff.
      let handoffId: string | undefined
      if (typeof window !== "undefined") {
        handoffId = window.localStorage.getItem("guildy_handoff") ?? undefined
        if (handoffId) window.localStorage.removeItem("guildy_handoff")
      }

      const completeResult = await completeOnboardingAction(handoffId)
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

  return (
    <div className="space-y-8">
      <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-[#482C4C]">Paste resume or intro</h2>
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={14}
          placeholder="Paste resume text or a short intro/cover-letter-style summary..."
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

      <div className="flex justify-end">
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
  )
}
