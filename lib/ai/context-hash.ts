import "server-only"

import { createHash } from "node:crypto"

import type { PrepSessionRole, PrepStage, PrepTier } from "./prep-types"

// Single-source builder for prep_versions.context_hash. Extracted (Prompt
// 21) from app/app/actions.ts so the unauthenticated-handoff consume path
// in app/onboarding/actions.ts hashes with the byte-identical function.
// generatePrepAction (writer), getCachedPrepAction / getPrepStatesAction
// (readers), and the handoff consumer must all produce the same hash for
// the same inputs, or cache rows fail to resolve and a stale banner fires.
//
// Prompt 16 invariant: two identical-content inputs MUST produce identical
// hashes regardless of trailing whitespace, line-ending style, or object
// key order. Pasted textarea content commonly arrives with CRLF line
// endings on Windows or trailing whitespace from copy-paste.
// normalizeHashString folds those variations away; sorting keys before
// serialize is defense-in-depth against object-shape changes that would
// otherwise rely on V8 insertion order.
//
// session_role and session_label are appended only when defined, so a
// single-prep (non-Full-Loop) call produces the pre-Phase-4d key set and
// existing prep_versions rows resolve byte-identical.

function normalizeHashString(value: string | null | undefined): string {
  if (!value) return ""
  return value.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim()
}

function stableStringify(obj: Record<string, unknown>): string {
  const keys = Object.keys(obj).sort()
  const sorted: Record<string, unknown> = {}
  for (const key of keys) sorted[key] = obj[key]
  return JSON.stringify(sorted)
}

export function buildContextHash(inputs: {
  tier: PrepTier
  stage: PrepStage
  resume_text: string | null
  jd_text: string | null
  latest_message: string | null
  interviewer_name: string | null
  interviewer_title: string | null
  interviewer_link: string | null
  note_text: string | null
  session_role?: PrepSessionRole
  session_label?: string | null
}): string {
  const obj: Record<string, unknown> = {
    tier: inputs.tier,
    stage: inputs.stage,
    resume: normalizeHashString(inputs.resume_text),
    jd: normalizeHashString(inputs.jd_text),
    msg: normalizeHashString(inputs.latest_message),
    interviewer_name: normalizeHashString(inputs.interviewer_name),
    interviewer_title: normalizeHashString(inputs.interviewer_title),
    interviewer_link: normalizeHashString(inputs.interviewer_link),
    note: normalizeHashString(inputs.note_text),
  }
  if (inputs.session_role) {
    obj.session_role = inputs.session_role
  }
  const normalizedLabel = normalizeHashString(inputs.session_label)
  if (normalizedLabel.length > 0) {
    obj.session_label = normalizedLabel
  }
  return createHash("sha256").update(stableStringify(obj)).digest("hex")
}
