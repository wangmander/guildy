"use client"

import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import { signIn, useSession } from "next-auth/react"

function s(v: any, fallback = ""): string {
  if (typeof v === "string") return v
  if (v == null) return fallback
  try {
    return String(v)
  } catch {
    return fallback
  }
}

function arr(v: any, max = 10): string[] {
  if (!Array.isArray(v)) return []
  return v.map((x) => s(x, "").trim()).filter(Boolean).slice(0, max)
}

function oneLine(v: any, fallback = ""): string {
  const t = s(v, fallback).replace(/\s+/g, " ").trim()
  if (!t) return fallback
  return t.length > 260 ? t.slice(0, 260).trim() + "…" : t
}

function prettyJson(v: any) {
  try {
    return JSON.stringify(v ?? null, null, 2)
  } catch {
    return "null"
  }
}

function MarketingConnect() {
  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center px-6">
      <div className="max-w-xl w-full">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-black text-white flex items-center justify-center font-semibold">
            g
          </div>
          <div className="text-lg font-semibold">guildy</div>
        </div>

        <h1 className="mt-6 text-3xl font-semibold tracking-tight">
          Track every pipeline. Prep every round. Close the offer.
        </h1>
        <p className="mt-3 text-gray-600">
          Connect Gmail to auto-build pipelines, infer stage conservatively, and generate stage-specific prep matched to
          the exact company + role. If Guildy can’t infer intel, it will say so.
        </p>

        <ul className="mt-6 space-y-2 text-sm text-gray-700">
          <li>• First reach-out → recruiter screen (not full loop).</li>
          <li>• Bespoke prep per stage (no generic boilerplate).</li>
          <li>• No fake company intel: Unknown stays Unknown.</li>
        </ul>

        <button
          onClick={() => signIn("google", { callbackUrl: "/pipelines" })}
          className="mt-8 w-full px-4 py-3 rounded bg-black text-white font-medium"
        >
          Connect Gmail
        </button>
      </div>
    </div>
  )
}

export default function PipelinesPage() {
  const { data: session, status } = useSession()

  const [rows, setRows] = useState<any[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState("")

  const selected = useMemo(() => {
    if (!selectedId) return rows[0] ?? null
    return rows.find((r) => r?.id === selectedId) ?? rows[0] ?? null
  }, [rows, selectedId])

  async function loadPipelines() {
    const userEmail = session?.user?.email
    if (!userEmail) return
    setErr("")
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from("pipelines")
        .select("*")
        .eq("user_email", userEmail)
        .order("last_email_at", { ascending: false })

      if (error) {
        console.error(error)
        setErr("Failed to load pipelines.")
        setRows([])
        setSelectedId(null)
        return
      }

      const list = Array.isArray(data) ? data : []
      setRows(list)
      setSelectedId(list?.[0]?.id ?? null)
    } catch (e: any) {
      console.error(e)
      setErr("Failed to load pipelines (exception).")
      setRows([])
      setSelectedId(null)
    } finally {
      setLoading(false)
    }
  }

  async function syncGmail() {
    if (status !== "authenticated") return
    setErr("")
    setSyncing(true)
    try {
      const res = await fetch("/api/gmail/sync", { method: "POST" })
      await res.json().catch(() => null)
    } catch (e) {
      console.error(e)
      setErr("Sync failed.")
    } finally {
      await loadPipelines()
      setSyncing(false)
    }
  }

  useEffect(() => {
    if (status === "authenticated") loadPipelines()
  }, [status])

  if (status === "loading") {
    return (
      <div className="mx-auto max-w-7xl h-[calc(100vh-64px)] flex items-center justify-center text-sm text-gray-500">
        Loading…
      </div>
    )
  }

  if (status !== "authenticated") return <MarketingConnect />

  const prep = selected?.prep_json ?? null
  const insights = selected?.insights_json ?? null

  const companyType = s(prep?.company_type, "unknown")
  const companySize = s(prep?.company_size_bucket, "unknown")
  const truthNote =
    companyType === "unknown" || companySize === "unknown"
      ? "Guildy couldn’t confidently infer company details from email alone."
      : ""

  return (
    <div className="mx-auto max-w-7xl h-[calc(100vh-64px)] flex flex-col overflow-hidden">
      <div className="p-4 border-b bg-white flex items-center gap-3">
        <button
          onClick={syncGmail}
          disabled={syncing}
          className="px-4 py-2 bg-black text-white rounded disabled:opacity-50"
        >
          {syncing ? "Syncing Gmail…" : "Sync Gmail"}
        </button>
        <span className="text-sm text-gray-600">Imports recruiting emails into pipelines</span>
        {loading ? <span className="text-sm text-gray-400 ml-auto">Loading…</span> : null}
      </div>

      {err ? (
        <div className="px-4 py-3 border-b bg-yellow-50 text-sm text-yellow-900">{err}</div>
      ) : null}

      <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
        {/* LEFT: list */}
        <div className="w-full lg:w-1/2 overflow-y-auto border-r bg-white">
          {rows.length === 0 ? (
            <div className="p-6 text-sm text-gray-600">
              No pipelines yet. Hit <b>Sync Gmail</b>.
            </div>
          ) : (
            <div className="divide-y">
              {rows.map((r) => {
                const isSel = (r?.id ?? null) === (selected?.id ?? null)
                return (
                  <button
                    key={r.id}
                    onClick={() => setSelectedId(r.id)}
                    className={`w-full text-left p-4 hover:bg-gray-50 ${
                      isSel ? "bg-gray-50" : "bg-white"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium">
                          {s(r.company, "Unknown")} — {s(r.role, "Interview")}
                        </div>
                        <div className="text-xs text-gray-600 mt-1">
                          Stage: <b>{s(r.stage, "")}</b>
                          {r.stage_detail ? (
                            <>
                              {" "}
                              · <span className="text-gray-500">{s(r.stage_detail, "")}</span>
                            </>
                          ) : null}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {s(r.last_email_subject, "")}
                        </div>
                      </div>
                      <div className="text-xs text-gray-500 whitespace-nowrap">
                        {r.last_email_at ? new Date(r.last_email_at).toLocaleString() : ""}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* RIGHT: details */}
        <div className="w-full lg:w-1/2 overflow-y-auto bg-white">
          {!selected ? (
            <div className="p-6 text-sm text-gray-600">Select a pipeline.</div>
          ) : (
            <div className="p-6 space-y-6">
              <div>
                <div className="text-xl font-semibold">
                  {s(selected.company, "Unknown")} — {s(selected.role, "Interview")}
                </div>
                <div className="text-sm text-gray-600 mt-1">
                  Stage: <b>{s(selected.stage, "")}</b>
                  {selected.stage_detail ? (
                    <>
                      {" "}
                      · <span className="text-gray-500">{s(selected.stage_detail, "")}</span>
                    </>
                  ) : null}
                </div>
              </div>

              {/* Next action (insights_json) */}
              <div className="border rounded p-4">
                <div className="text-sm font-semibold">Next Action (LLM)</div>
                <div className="mt-2 text-sm">{oneLine(insights?.next_action, "Not available yet.")}</div>
                {insights?.why ? <div className="mt-2 text-xs text-gray-600">{oneLine(insights?.why, "")}</div> : null}
                <div className="mt-3 text-xs text-gray-500 flex flex-wrap gap-3">
                  {insights?.tone ? <span>Tone: {s(insights.tone)}</span> : null}
                  {insights?.response_likelihood ? (
                    <span>Likelihood: {s(insights.response_likelihood)}</span>
                  ) : null}
                  {insights?.urgency ? <span>Urgency: {s(insights.urgency)}</span> : null}
                </div>
              </div>

              {/* Company intel */}
              <div className="border rounded p-4">
                <div className="text-sm font-semibold">Company Intel (truthful)</div>
                <div className="mt-2 text-sm text-gray-700">
                  Type: <b>{companyType !== "unknown" ? companyType : "Unknown"}</b> · Size:{" "}
                  <b>{companySize !== "unknown" ? companySize : "Unknown"}</b>
                </div>
                {truthNote ? <div className="mt-2 text-xs text-gray-600">{truthNote}</div> : null}
                {arr(prep?.assumptions, 6).length ? (
                  <div className="mt-3">
                    <div className="text-xs font-semibold text-gray-700">Assumptions</div>
                    <ul className="mt-2 text-xs text-gray-600 list-disc pl-5 space-y-1">
                      {arr(prep?.assumptions, 6).map((x, i) => (
                        <li key={i}>{x}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>

              {/* Stage-specific prep */}
              <div className="border rounded p-4">
                <div className="text-sm font-semibold">Stage Prep (LLM)</div>
                <div className="mt-2 text-sm text-gray-700">
                  {oneLine(prep?.stage_focus, "Not available yet. Re-sync after more recruiting emails exist.")}
                </div>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs font-semibold text-gray-700">They might ask</div>
                    <ul className="mt-2 text-xs text-gray-600 list-disc pl-5 space-y-1">
                      {arr(prep?.questions_they_might_ask, 6).length ? (
                        arr(prep?.questions_they_might_ask, 6).map((x, i) => <li key={i}>{x}</li>)
                      ) : (
                        <li>Not available yet.</li>
                      )}
                    </ul>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-gray-700">You should ask</div>
                    <ul className="mt-2 text-xs text-gray-600 list-disc pl-5 space-y-1">
                      {arr(prep?.questions_you_should_ask, 6).length ? (
                        arr(prep?.questions_you_should_ask, 6).map((x, i) => <li key={i}>{x}</li>)
                      ) : (
                        <li>Not available yet.</li>
                      )}
                    </ul>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs font-semibold text-gray-700">Stories to prepare</div>
                    <ul className="mt-2 text-xs text-gray-600 list-disc pl-5 space-y-1">
                      {arr(prep?.stories_to_prepare, 6).length ? (
                        arr(prep?.stories_to_prepare, 6).map((x, i) => <li key={i}>{x}</li>)
                      ) : (
                        <li>Not available yet.</li>
                      )}
                    </ul>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-gray-700">Next 24h homework</div>
                    <ul className="mt-2 text-xs text-gray-600 list-disc pl-5 space-y-1">
                      {arr(prep?.homework_next_24h, 6).length ? (
                        arr(prep?.homework_next_24h, 6).map((x, i) => <li key={i}>{x}</li>)
                      ) : (
                        <li>Not available yet.</li>
                      )}
                    </ul>
                  </div>
                </div>
              </div>

              {/* Last email */}
              <div className="border rounded p-4">
                <div className="text-sm font-semibold">Last Email</div>
                <div className="mt-2 text-xs text-gray-500">
                  From: {s(selected.last_email_from, "")}
                </div>
                <div className="mt-1 text-sm">{s(selected.last_email_subject, "")}</div>
                {selected.last_email_snippet ? (
                  <div className="mt-2 text-xs text-gray-600">{s(selected.last_email_snippet, "")}</div>
                ) : null}
              </div>

              {/* Raw JSON (debug) */}
              <details className="border rounded p-4">
                <summary className="text-sm font-semibold cursor-pointer">Raw LLM JSON (debug)</summary>
                <div className="mt-3">
                  <div className="text-xs font-semibold text-gray-700">prep_json</div>
                  <pre className="mt-2 text-xs bg-gray-50 p-3 rounded overflow-auto">{prettyJson(prep)}</pre>
                </div>
                <div className="mt-4">
                  <div className="text-xs font-semibold text-gray-700">insights_json</div>
                  <pre className="mt-2 text-xs bg-gray-50 p-3 rounded overflow-auto">{prettyJson(insights)}</pre>
                </div>
              </details>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
