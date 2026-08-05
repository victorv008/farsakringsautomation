---
name: seo-check
description: Run a technical SEO audit on livforsakringar.se and generate an HTML report. Use when the user asks to check SEO, run an SEO audit, verify meta tags, or after adding or editing any page. Read-only — reports issues, never edits site files.
---

# SEO-check — livforsakringar.se

Audit the site against the standard below. Never modify site files. Output a report file.

## Site standard

Canonical URL format: https://www.livforsakringar.se + clean URL (no .html). Root is https://www.livforsakringar.se/

Public pages and their clean URLs:
- index.html → /
- livssituation.html → /livssituation
- resultat.html → /resultat
- faq.html → /faq
- sa-fungerar-det.html → /sa-fungerar-det
- om-oss.html → /om-oss
- privacy-policy.html → /integritetspolicy
- terms.html → /anvandarvillkor

## Checks to run

For each public page:
1. <title> exists, is unique across pages, length 30–60 characters
2. meta description exists, is unique, length 120–160 characters
3. canonical tag exists and exactly matches the page's clean URL above
4. No <meta name="robots" content="noindex"> present
5. Exactly one <h1> on the page
6. No <meta name="keywords"> (obsolete)
7. All internal href values use clean root-relative URLs (/faq, not faq.html or full domain). Anchor links (#) and mailto: are fine, except flag any href="#" that is a nav or footer link, since that is a dead link
8. Note whether JSON-LD (application/ld+json) is present, and of which @type
9. Note whether Open Graph tags (og:title, og:description, og:url) are present

Site-wide:
10. robots.txt exists, and its Sitemap line points to https://www.livforsakringar.se/sitemap.xml
11. sitemap.xml exists, uses the www + clean URL format, and lists exactly the public pages above — flag any page missing from it and any URL in it that does not exist
12. Every public page is reachable from at least one internal link on another page (flag orphan pages)

## Output

Write the report to seo-reports/seo-audit-YYYY-MM-DD.html (create the folder if needed). Overwrite if a report for today already exists.

The HTML report must be a single self-contained file (inline CSS, no external dependencies), in Swedish, with a dark theme, and contain:
- A header: "SEO-rapport — Livförsäkringar.se", the date, and the number of pages checked
- A summary row of counters showing actual counts, not invented scores. For example: pages with valid title (n/total), pages with valid meta description (n/total), pages with correct canonical (n/total), dead links found, pages with JSON-LD (n/total)
- A section "Kritiska fel" listing anything broken: missing/duplicate titles or descriptions, wrong or missing canonical, noindex found, dead href="#" links, sitemap mismatches. If there are none, say so clearly.
- A section "Varningar" for softer issues: title/description outside recommended length, missing JSON-LD, missing Open Graph tags, orphan pages
- A per-page table with one row per page showing: page, title length, description length, canonical OK (yes/no), h1 count, JSON-LD present (yes/no)
- A section "Föreslagna åtgärder" — a prioritized list of what to fix first, written in plain Swedish

Colour-code: red for critical errors, amber for warnings, green for passing.

After writing the file, print a short summary in the terminal: number of critical errors, number of warnings, and the path to the report.

## Rules

- Never edit any site file. This skill only reads and writes its own report.
- Report facts, not invented quality scores.
- If a check cannot be performed, say so explicitly in the report rather than guessing.
