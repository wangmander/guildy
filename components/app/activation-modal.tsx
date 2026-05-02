"use client"

import { useEffect, useState, useTransition } from "react"

import { activateJobAction } from "@/app/app/actions"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  jobId: string | null
  company: string | null
  role: string | null
}

export function ActivationModal({ open, onOpenChange, jobId, company, role }: Props) {
  const [message, setMessage] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    if (!open) {
      setMessage("")
      setError(null)
    }
  }, [open])

  function handleActivate(includeMessage: boolean) {
    if (!jobId) return
    setError(null)
    startTransition(async () => {
      const result = await activateJobAction({
        job_id: jobId,
        latest_message: includeMessage ? message.trim() : "",
      })
      if (!result.ok) {
        setError(result.error)
        return
      }
      onOpenChange(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Did the recruiter reach out?</DialogTitle>
          <DialogDescription>
            {company && role ? (
              <>
                Activating <span className="font-medium">{company}</span> — {role}
              </>
            ) : (
              "Activate this job and move it to Screen."
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="latest-message">
            Paste the latest message (recruiter email, LinkedIn DM, etc.)
          </Label>
          <Textarea
            id="latest-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Hi! Thanks for applying. We'd love to set up a 30-min chat..."
            className="min-h-[150px] resize-none"
            disabled={pending}
          />
          <p className="text-xs text-gray-500">
            Optional — but pasting helps us tailor your prep.
          </p>
        </div>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        )}

        <DialogFooter className="sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={() => handleActivate(false)}
            disabled={pending}
          >
            Skip — just activate
          </Button>
          <Button
            type="button"
            onClick={() => handleActivate(true)}
            disabled={pending}
            className="bg-[#482C4C] text-white hover:bg-[#482C4C]/90"
          >
            {pending ? "Activating..." : "Activate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
