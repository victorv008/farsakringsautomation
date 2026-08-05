---
name: fact-check
description: Fact-check a content page against data/insurance.json and produce an HTML verdict report. Use before publishing or editing any page that makes claims about insurance companies, coverage, prices or market conditions. Read-only publication safety gate — reports findings, never edits files.
---

# Fact-check — livforsakringar.se

Verify that every factual claim on a content page is supported by `livsforsakringar-mvp/data/insurance.json`.
Read-only. Report findings. Never edit anything.

This skill is a **safety gate**. Be conservative. Never let an unverified claim pass as acceptable.

## Core principle

**Absence of contradiction is not verification.**

A claim is VERIFIED only if a specific field in `insurance.json` directly supports it.
Everything else is UNVERIFIED, regardless of how plausible it sounds.

Never infer. Never fill gaps. Never assume a claim is fine because it seems reasonable.
Never mark something VERIFIED to be helpful — when in doubt, mark it UNVERIFIABLE.

## Before you start

Read `livsforsakringar-mvp/data/insurance.json` **fresh on every run**. Never use remembered or
cached values from earlier in the conversation or from a previous report. The data changes.

## The actual data schema

The file has two top-level keys: `_meta` and `bolag` (an array of company objects).

`_meta` contains: `källa`, `senast_uppdaterad` (a single global date), `antal_bolag`,
`pris_struktur`, `notering`.

Per-company fields that exist and can support a claim:

| Field | Type | Supports claims about |
|---|---|---|
| `bolag` | string | company name |
| `teckningsalder` / `teckningsalder_min` / `teckningsalder_max` | string / number | entry age |
| `slutalder` | number | age the policy runs until |
| `nedtrappning` / `nedtrappning_alder` | boolean / number\|null | whether and when the amount steps down |
| `halso_deklaration` | boolean | whether a health declaration is required |
| `krav_sverige` / `krav_sverige_detalj` | boolean / string | residency requirement |
| `krav_arbetsfor` | boolean | fitness-for-work requirement |
| `belopp_min` / `belopp_max` | number / number\|null | coverage amount limits |
| `undantag_sport` | array | sport exclusions |
| `kommentar` | string\|null | free-text note |
| `webbsida` | string | company homepage (NOT a terms page) |
| `pris_verifierad` | boolean | whether the price was taken from the company's own calculator |
| `pris_tabell_mkr`, `pris_tabell_1mkr`, `pris_tabell`, `pris_tabell_pbb`, `pris_pbb`, `pris_per_miljon`, `pris_estimerad`, `belopp_tabell_referens` | various | price data used **only** for rendering in the comparison tool |

**Any attribute not in this table cannot be verified.** If a claim depends on a field that is not
present, say so explicitly rather than working around it.

Verify this table against the file on each run — if the schema has changed, report that as a
structural finding and use what is actually there.

## Classify every claim

Extract every factual claim from the page. Classify each as exactly one of:

**VERIFIED** — names a specific company, a specific attribute, and a matching field in
`insurance.json`. Quote the sentence from the page and the field value side by side.

**CONTRADICTED** — the claim conflicts with the data. Quote both the sentence and the actual
field value. Treat as **CRITICAL**.

**UNVERIFIABLE** — the claim concerns a company not in the data, an attribute not in the schema,
or cannot be tied to a specific field. Treat as **CRITICAL**, not a warning.

## Critical failures

These are always errors, never warnings. Each one blocks publication on its own.

1. **Any price, premium, monthly cost or monetary figure stated as fact in the page text.**
   `insurance.json` is not a pricing source for copy. Prices belong only in the comparison tool,
   where they render from data at runtime. Flag every occurrence in prose.
   Note: price fields do exist in the data, but 6 of 16 companies carry `pris_verifierad: false`
   and per `_meta.notering` those prices are deliberately not shown on the site. The existence of
   price data never justifies a price in page copy.

2. **Any absolute or unqualified coverage claim** — "helt utan hälsodeklaration", "gäller alltid",
   "inga undantag", "täcker allt". A boolean field cannot support an absolute, because real policy
   terms carry limits on amount, age, waiting periods and exclusions. Absolute phrasing is a
   critical failure **even when the underlying boolean matches**.

3. **Any generalising market claim** — "de flesta bolag", "branschstandard", "vanligtvis",
   "alla större bolag" — that has no basis in the data. 16 companies is not the market.

4. **Any company claim lacking a source reference to that company's own terms page.**
   `webbsida` is a homepage, not a terms page, and does not satisfy this on its own.

5. **Any company claim where the data carries no verification date, or where that date is older
   than 6 months.** There is currently **no per-company date field** — only the global
   `_meta.senast_uppdaterad`. Report this as a structural finding on every run: the data cannot be
   age-verified per company, so every company claim built on it is time-unbounded. Also check the
   global date against today and flag it if older than 6 months.

6. **Any comparative or superlative claim** — "billigast", "bäst", "flest", "marknadens enda" —
   unless it can be derived directly and completely from the data.

## Required phrasing check

Company claims should be attributed and time-bounded, e.g.
*"enligt bolagets villkor per [datum]"* rather than stated as timeless fact.
Flag every claim stated as bare fact.

## Output

Write to `fact-reports/fact-check-YYYY-MM-DD-[pagename].html`. Create the folder if needed.
Overwrite if a report for that page and date already exists.

Single self-contained HTML file — inline CSS, no external dependencies — dark theme, in Swedish.

Open with a **verdict line**:

- `GODKÄND FÖR PUBLICERING` — only if there are **zero** critical failures and **zero**
  unverifiable claims.
- `EJ GODKÄND` — otherwise, with the count of blocking issues.

**Never soften this verdict.** Do not hedge it, do not add encouraging qualifiers, do not
downgrade a critical failure to make the verdict pass.

Then, in order:
- Summary counts (verified / contradicted / unverifiable / critical failures)
- A section per category. For **every** claim, quote the exact sentence from the page.
  - Verified → show the supporting field and its value
  - Contradicted → show both the claim and the actual value
  - Critical → state plainly why it blocks publication
- **"Vad som måste åtgärdas"** — a plain-Swedish list of required fixes in priority order

Colour-code: red for critical and contradicted, amber for warnings, green for verified.

After writing the file, open it in the default browser (`start "" "<path>"` on Windows).

Then print a terminal summary: verdict, blocking issue count, report path.

## Hard rules

- Never edit page files or `insurance.json`.
- Never mark something VERIFIED to be helpful. When in doubt → UNVERIFIABLE.
- If a required field is missing from `insurance.json`, say so explicitly rather than working
  around it.
- Report every finding. Never summarise away or omit findings to keep the report short.
- Report facts, not a quality score.
