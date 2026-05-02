"use client"

import { useRef, useState, useTransition } from "react"

import { createJobAction } from "@/app/app/actions"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type ExtractResponse = {
  ok: boolean
  reason?: "fetch_failed" | "extract_failed"
  error?: string
  fields?: { company_name: string | null; role_title: string | null; tc: string | null }
  jd_text?: string
}

const DEBOUNCE_MS = 500

export function AddJobModal({ open, onOpenChange }: Props) {
  const [tab, setTab] = useState<"manual" | "url" | "jd">("manual")
  const [company, setCompany] = useState("")
  const [role, setRole] = useState("")
  const [tc, setTc] = useState("")
  const [url, setUrl] = useState("")
  const [jdText, setJdText] = useState("")
  const [jdCollapsed, setJdCollapsed] = useState(false)
  const [extracting, setExtracting] = useState<null | "url" | "jd">(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastExtractedRef = useRef<{ url: string; jd: string }>({ url: "", jd: "" })
  const urlRef = useRef("")
  const jdRef = useRef("")
  const extractedFieldsActiveRef = useRef(false)

  function reset() {
    setTab("manual")
    setCompany("")
    setRole("")
    setTc("")
    setUrl("")
    setJdText("")
    setJdCollapsed(false)
    setExtracting(null)
    setNotice(null)
    setError(null)
    lastExtractedRef.current = { url: "", jd: "" }
    urlRef.current = ""
    jdRef.current = ""
    extractedFieldsActiveRef.current = false
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }
  }

  function clearExtractedFieldsIfStale() {
    if (!extractedFieldsActiveRef.current) return
    setCompany("")
    setRole("")
    setTc("")
    extractedFieldsActiveRef.current = false
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset()
    onOpenChange(next)
  }

  async function runExtract(kind: "url" | "jd", content: string) {
    setNotice(null)
    setError(null)
    setExtracting(kind)
    lastExtractedRef.current[kind] = content
    try {
      const body =
        kind === "url" ? { kind: "url", url: content } : { kind: "jd", jd_text: content }
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data: ExtractResponse = await res.json()
      console.log("[extract] response", data)

      if (data.ok && data.fields) {
        const populatedAny = Boolean(
          data.fields.company_name || data.fields.role_title || data.fields.tc
        )
        if (data.fields.company_name) setCompany(data.fields.company_name)
        if (data.fields.role_title) setRole(data.fields.role_title)
        if (data.fields.tc) setTc(data.fields.tc)
        if (populatedAny) extractedFieldsActiveRef.current = true
        if (data.jd_text) {
          if (kind === "url") {
            setJdText(data.jd_text)
            jdRef.current = data.jd_text
          }
          setJdCollapsed(true)
        } else if (kind === "jd") {
          setJdCollapsed(true)
        }
        return
      }

      if (kind === "url" && data.reason === "fetch_failed") {
        clearExtractedFieldsIfStale()
        setNotice("Couldn't read this URL. Fill in the fields manually below — your URL is saved.")
        return
      }

      clearExtractedFieldsIfStale()
      setNotice(
        "Couldn't extract details. Fill in the fields manually below — what you pasted is saved."
      )
      if (data.jd_text && kind === "jd") {
        setJdText(data.jd_text)
        jdRef.current = data.jd_text
      }
    } catch {
      clearExtractedFieldsIfStale()
      setNotice("Extraction failed. Fill in the fields manually below — what you entered is saved.")
    } finally {
      setExtracting(null)
    }
  }

  function scheduleExtract(kind: "url" | "jd") {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      const content = (kind === "url" ? urlRef.current : jdRef.current).trim()
      if (kind === "url") {
        if (!/^https?:\/\//i.test(content)) return
        if (content === lastExtractedRef.current.url) return
        runExtract("url", content)
      } else {
        if (content.length < 20) return
        if (content === lastExtractedRef.current.jd) return
        runExtract("jd", content)
      }
    }, DEBOUNCE_MS)
  }

  function handleRepasteJd() {
    setJdCollapsed(false)
    setJdText("")
    jdRef.current = ""
    lastExtractedRef.current.jd = ""
    setNotice(null)
    setTab("jd")
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!company.trim() || !role.trim()) {
      setError("Company and role title are required.")
      return
    }
    startTransition(async () => {
      const result = await createJobAction({
        company_name: company.trim(),
        role_title: role.trim(),
        tc: tc.trim(),
        source_url: url.trim(),
        jd_text: jdText.trim(),
      })
      if (!result.ok) {
        setError(result.error)
        return
      }
      handleOpenChange(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-2xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Add a job</DialogTitle>
          <DialogDescription>
            Paste a URL or JD to auto-fill, or fill in fields manually.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
            <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="manual">Manual</TabsTrigger>
                <TabsTrigger value="url">Paste URL</TabsTrigger>
                <TabsTrigger value="jd">Paste JD</TabsTrigger>
              </TabsList>

              <TabsContent value="url" className="space-y-1.5">
                <Label htmlFor="url">Job posting URL</Label>
                <Input
                  id="url"
                  type="url"
                  placeholder="https://jobs.example.com/listings/123"
                  value={url}
                  onChange={(e) => {
                    urlRef.current = e.target.value
                    setUrl(e.target.value)
                  }}
                  onPaste={() => scheduleExtract("url")}
                  onBlur={() => scheduleExtract("url")}
                  disabled={extracting !== null}
                />
                <p className="flex items-center gap-2 text-xs text-gray-500">
                  {extracting === "url" ? (
                    <>
                      <Spinner />
                      <span>Extracting...</span>
                    </>
                  ) : (
                    <span>
                      We'll auto-fill from the page. Some sites block this — paste the JD if it
                      doesn't work.
                    </span>
                  )}
                </p>
              </TabsContent>

              <TabsContent value="jd" className="space-y-1.5">
                {jdCollapsed ? (
                  <div className="flex items-center justify-between gap-2 rounded-md border border-black/10 bg-gray-50 px-3 py-2 text-xs text-gray-700">
                    <span>
                      JD saved ({jdText.length.toLocaleString()} chars). Fields below are
                      pre-filled.
                    </span>
                    <button
                      type="button"
                      onClick={handleRepasteJd}
                      className="shrink-0 text-[#482C4C] underline underline-offset-2 hover:opacity-80"
                    >
                      Re-paste JD
                    </button>
                  </div>
                ) : (
                  <>
                    <Label htmlFor="jd">Paste the JD text</Label>
                    <Textarea
                      id="jd"
                      rows={8}
                      placeholder="Paste the full job description here..."
                      value={jdText}
                      onChange={(e) => {
                        jdRef.current = e.target.value
                        setJdText(e.target.value)
                      }}
                      onPaste={() => scheduleExtract("jd")}
                      onBlur={() => scheduleExtract("jd")}
                      disabled={extracting !== null}
                      className="max-h-[300px] min-h-[160px] resize-none overflow-y-auto"
                    />
                    <p className="flex items-center gap-2 text-xs text-gray-500">
                      {extracting === "jd" ? (
                        <>
                          <Spinner />
                          <span>Extracting...</span>
                        </>
                      ) : (
                        <span>Auto-fills company, role, and TC. The full text is saved for prep.</span>
                      )}
                    </p>
                  </>
                )}
              </TabsContent>

              <TabsContent value="manual">
                <p className="text-xs text-gray-500">
                  Fill these in directly, or use Paste URL / Paste JD to auto-fill.
                </p>
              </TabsContent>
            </Tabs>

            <div className="space-y-3 border-t border-black/5 pt-4">
              {notice && (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  {notice}
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="company">Company *</Label>
                  <Input
                    id="company"
                    value={company}
                    onChange={(e) => {
                      setCompany(e.target.value)
                      extractedFieldsActiveRef.current = false
                    }}
                    placeholder="Acme"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="role">Role title *</Label>
                  <Input
                    id="role"
                    value={role}
                    onChange={(e) => {
                      setRole(e.target.value)
                      extractedFieldsActiveRef.current = false
                    }}
                    placeholder="Senior Product Designer"
                    required
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tc">Total comp (optional)</Label>
                <Input
                  id="tc"
                  value={tc}
                  onChange={(e) => {
                    setTc(e.target.value)
                    extractedFieldsActiveRef.current = false
                  }}
                  placeholder="$180k-$220k + equity"
                />
              </div>

              {error && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {error}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="border-t border-black/5 pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => handleOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={pending || extracting !== null}
              className="bg-[#482C4C] text-white hover:bg-[#482C4C]/90"
            >
              {pending ? "Saving..." : "Add job"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function Spinner() {
  return (
    <span
      aria-hidden
      className="inline-block size-3 animate-spin rounded-full border-2 border-gray-300 border-t-[#482C4C]"
    />
  )
}
