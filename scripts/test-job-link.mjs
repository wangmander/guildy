// Tests for the job-link import gate.
//
//   node --experimental-strip-types scripts/test-job-link.mjs
//
// No test runner in this repo (same situation as test-streak-schedule.mjs, and
// adding one is still a bigger decision than this change deserves).
// lib/jobLink.ts is pure and imports nothing, so it runs directly under node's
// type stripping with no framework, no aliases and no network.
//
// The cases that matter are the three empty-200 shapes from
// ~/spikes/job-link-parse/results.md, all of which return HTTP 200 with no
// posting on the page and pass both a status check and a title check:
//
//   1. Stripe's Greenhouse URL 302s to a 593-role listing page.
//   2. Ashby returns a 58-character JavaScript shell that is just the title.
//   3. Workday returns a zero-character SPA shell.

import {
  ALLOWED_HOSTS,
  countJdMarkers,
  hostOf,
  htmlToText,
  isAllowedHost,
  isPostingText,
  looksLikeUrl,
  normalizeUrl,
} from "../lib/jobLink.ts";

let failures = 0;
function check(name, actual, expected) {
  const ok = actual === expected;
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `  (got ${actual}, want ${expected})`}`);
}

console.log("\n-- host allowlist --");
check("lever job accepted", isAllowedHost("https://jobs.lever.co/acme/abc-123"), true);
check("greenhouse job-boards accepted", isAllowedHost("https://job-boards.greenhouse.io/discord/jobs/7890"), true);
check("greenhouse legacy accepted", isAllowedHost("https://boards.greenhouse.io/figma/jobs/1234"), true);
check("linkedin rejected", isAllowedHost("https://www.linkedin.com/jobs/view/4423307605/"), false);
check("indeed rejected", isAllowedHost("https://www.indeed.com/viewjob?jk=db6a5c966dee6fc2"), false);
check("glassdoor rejected", isAllowedHost("https://www.glassdoor.com/job-listing/foo.htm"), false);
check("ziprecruiter rejected", isAllowedHost("https://www.ziprecruiter.com/c/CBIZ/Job/x"), false);
check("ashby rejected (needs headless)", isAllowedHost("https://jobs.ashbyhq.com/openai/abc"), false);
check("workday rejected (needs headless)", isAllowedHost("https://nvidia.wd5.myworkdayjobs.com/en-US/NVIDIAExternalCareerSite/details/x"), false);
check("greenhouse lookalike rejected", isAllowedHost("https://greenhouse.io.evil.example/x"), false);
check("non-http rejected", isAllowedHost("javascript:alert(1)"), false);
check("allowlist size", ALLOWED_HOSTS.length, 3);

console.log("\n-- url detection --");
check("bare domain is a url", looksLikeUrl("jobs.lever.co/acme/abc"), true);
check("https is a url", looksLikeUrl("https://jobs.lever.co/acme/abc"), true);
check("posting text is not a url", looksLikeUrl("About the role\nWe are hiring a designer."), false);
check("normalize adds scheme", normalizeUrl("jobs.lever.co/x"), "https://jobs.lever.co/x");
check("www stripped from host", hostOf("https://www.linkedin.com/jobs"), "linkedin.com");

console.log("\n-- the three empty-200 shapes --");

// 1. Listing redirect: Stripe's Greenhouse URL lands on a page listing every
// open role. It is long (the spike measured 4,324 chars) and the requested
// role name does appear on it, so length alone and a title check both pass.
// What it does not have is the marker density of one posting body.
const listingPage = [
  "Stripe Jobs Search Filters Engineering Design Sales Marketing Remote",
  Array.from({ length: 180 }, (_, i) =>
    `Software Engineer ${i} Product Designer ${i} San Francisco Remote New York Seattle Dublin Singapore Tokyo`
  ).join(" "),
  "Load more results Showing 593 open roles Sign up for job alerts",
].join(" ");
check("listing page is long enough to fool a length check", listingPage.length > 800, true);
check("listing page has no JD markers at all", countJdMarkers(listingPage), 0);
check("listing page REJECTED", isPostingText(listingPage), false);

// 2. Ashby JS shell: plain fetch returns 200 and the visible text is just the
// title string, 42-58 chars in the spike. A title-presence check passes.
const ashbyShell = htmlToText(
  '<html><head><title>Technical Program Manager, Compute Infrastructure @ OpenAI</title></head>' +
  '<body><div id="root"></div><script>window.__DATA__={}</script></body></html>'
);
check("ashby shell is only the title", ashbyShell.length < 100, true);
check("ashby shell REJECTED", isPostingText(ashbyShell), false);

// 3. Workday SPA shell: 200 with zero characters of visible text.
const workdayShell = htmlToText(
  '<html><body><div id="root"></div><script src="/app.js"></script>' +
  '<noscript>You need to enable JavaScript to run this app.</noscript></body></html>'
);
check("workday shell has no visible text", workdayShell.length, 0);
check("workday shell REJECTED", isPostingText(workdayShell), false);

console.log("\n-- real postings are accepted --");

// Regression: Palantir's live Lever posting is a complete 4,764-char posting
// written in prose, with no "Responsibilities" or "Qualifications" headings.
// It trips exactly one marker. A 2-marker floor rejected it, which is why the
// floor is 1. Shape reproduced here from the live fetch.
const prosePosting = [
  "Palantir Technologies - Administrative Business Partner Administrative Business Partner",
  "London, United Kingdom Administrative / Full-time / Hybrid Apply",
  "A World-Changing Company. Palantir builds the world's leading software for data-driven",
  "decisions and operations. By bringing the right data to the people who need it, our",
  "platforms empower our partners to develop lifesaving drugs and respond to humanitarian crises.",
  "x".repeat(600),
].join(" ");
check("prose posting trips exactly one marker", countJdMarkers(prosePosting), 1);
check("prose posting ACCEPTED (regression)", isPostingText(prosePosting), true);

const realPosting = [
  "Senior Product Designer at Acme. About the role: we are looking for a designer to own our core surfaces.",
  "Responsibilities: lead end-to-end design, partner with engineering, run research.",
  "Qualifications: 6+ years of experience shipping consumer products, a portfolio of shipped work,",
  "strong systems thinking, comfort with ambiguity, excellent written communication.",
  "Benefits: health, dental, vision, equity. Acme is an equal opportunity employer.",
  "x".repeat(500),
].join(" ");
check("real posting is long enough", realPosting.length > 800, true);
check("real posting has 2+ markers", countJdMarkers(realPosting) >= 2, true);
check("real posting ACCEPTED", isPostingText(realPosting), true);

console.log("\n-- html stripping --");
check(
  "script and style contents removed",
  htmlToText('<style>.a{color:red}</style><p>Hello</p><script>var x=1</script>'),
  "Hello"
);
check("entities decoded", htmlToText("<p>R&amp;D &quot;team&quot;</p>"), 'R&D "team"');

console.log(`\n${failures === 0 ? "All checks passed." : `${failures} check(s) FAILED.`}`);
process.exit(failures === 0 ? 0 : 1);
