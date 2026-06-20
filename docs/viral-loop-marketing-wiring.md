# Viral loop - marketing wiring (follow-up, guildy-marketing repo)

The app half of the shareable-prep loop shipped on `v2-pivot`. The pieces below
live in the marketing repo (guildy.ai hero funnel) and are OUT OF SCOPE for the
app repo. This documents the exact contracts the marketing side must honor.

## 1. Share button on the unauth prep result

After a visitor generates an unauth Quick Prep, add a "Share" affordance to the
result UI. On click, call the app's create endpoint server-side (proxy, same
pattern as the existing unauth-handoff proxy - do NOT call from the browser; the
endpoint has no CORS and is server-to-server).

Request:

```
POST https://app.guildy.ai/api/share/create
Content-Type: application/json

{ "jd": "<the public job description text>" }
```

Notes:
- Send ONLY the JD. Do not send the resume or the generated prep. The endpoint
  regenerates a JD-only teaser server-side for privacy (the live prep is
  resume-tainted and must never be stored or teased).
- The call runs a single Haiku pass (~20s). Show a spinner on the Share button.

Response:

```
{ "id": "ab12cd34ef", "url": "https://app.guildy.ai/p/ab12cd34ef" }
```

Copy `url` to the clipboard and/or open it. That is the public share page.

## 2. Pre-fill from a shared link (?ref)

The share page CTA links to `https://www.guildy.ai/?ref=<shareId>`. On the hero,
read `?ref`, fetch the JD by id, and pre-fill the prep form:

```
GET https://app.guildy.ai/api/share/<shareId>
```

This endpoint HAS CORS (allows the marketing origin) so it can be fetched from
the hero's browser. Response (teaser-safe only):

```
{ "id", "role_title", "company_name", "jd_text", "teaser": { purpose, sample_questions } }
```

Use `jd_text` to pre-fill the JD field. The `?ref` value is both the pre-fill
key and the attribution token - carry it through (see 3 and 4).

## 3. Client-side generated event

When a `?ref` viewer generates their prep, the app's
`/api/generate-quick-prep-unauth` already records the `generated` referral row
when you pass `ref` in the POST body:

```
POST https://app.guildy.ai/api/generate-quick-prep-unauth
{ "jd": "...", "resumeText": "...", "ref": "<shareId>" }
```

Fire the PostHog event CLIENT-SIDE from the hero (it holds the viewer's
anonymous distinct_id, which the server does not):

```
posthog.capture("prep_referral_converted", { share_id: shareId })
```

Do NOT fire this server-side; the app intentionally only writes the DB row for
the generated leg to avoid a double-fire and to keep the viewer's person context.

## 4. Carry ref into the signup link

When a `?ref` viewer signs up, append `ref` to the signup link so the app can
record the `signup` referral and fire `prep_referral_converted` with the real
user id:

```
https://app.guildy.ai/signup?handoff=<uuid>&ref=<shareId>
```

The app stashes `ref` in localStorage at `/signup` and records the signup
referral at onboarding completion. Same-browser only (lightweight).

## Env

App repo expects `NEXT_PUBLIC_MARKETING_URL` (defaults to
`https://www.guildy.ai`) for the share-page CTA base and the GET CORS origin.
Set it in the app's Vercel project if the marketing host differs.
