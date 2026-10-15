# Coverr: standards status

Written by the dev-standards kickoff skill and kept current by the audit skill.

Status values:
- **TODO:** not checked yet, or couldn't be checked this time (say why)
- **PASS:** met, with evidence
- **FAIL:** the main requirement isn't met
- **PARTIAL:** the main requirement is met, but a secondary part isn't
- **MANUAL:** only you can do or verify it
- **N/A:** doesn't apply, or the thing it governs doesn't exist yet (say which)

## Profile
Last audit: never
Countries served: Honduras

| Flag | On | Meaning | Note |
|---|---|---|---|
| web | yes | Website or web app | Cloudflare Workers, server-rendered. The door scanner is a PWA, not a store app |
| ios | no | App on the Apple App Store | Spec: "No native app anywhere" |
| android | no | App on Google Play | As above |
| external-users | yes | People outside your team use it or send it their data (customers, visitors, leads) | Ticket buyers submit name, email, phone and a bank confirmation screenshot |
| accounts | yes | Anyone logs in, including staff-only admin logins | Band admins, by emailed magic link. Door staff use a per-event URL token, not an account |
| public-signup | yes | Anyone outside your team can create an account | `/registro` is public and unauthenticated |
| database | yes | Stores data in a database | Cloudflare D1 via Drizzle |
| uploads | yes | Users upload files | Payment proofs to R2, 10 MB cap, images and PDF |
| payments | no | Takes money, including in-app purchases | Judgment call. Buyers transfer bank-to-bank directly to the band; the platform never touches money, which is what keeps it out of money-transmitter territory. The per-gig unlock fee is collected by bank transfer off-platform and `BILLING_ENABLED` is false |
| subscriptions | no | Recurring billing or auto-renewal | Spec: per gig, "no subscription, no seat pricing, no expiry" |
| ai | yes | Calls an AI model API | Anthropic vision extracts fields from payment proofs |
| ai-chat | no | Users send free-form messages to an AI | No user-facing model input anywhere |
| ai-companion | no | The AI acts as a friend, partner or character | Extraction only |
| ai-media | no | Generates images, audio or video | QR codes are generated deterministically, not by a model |
| email | yes | Sends email, including sign-up and password-reset emails | Resend: tickets, magic links, refund alerts |
| messaging | no | Sends SMS or WhatsApp messages | Spec explicitly rules out WhatsApp delivery |
| scraping | no | Collects data from other websites or looks up contact details | No |
| health | no | Stores or processes health information | No |
| public-pages | yes | Public pages meant to rank in search | Landing page only. Event pages travel by flyer and repost, and the spec rules out discovery or a directory |
| eu | no | Users in the EU or UK | Honduras. Revisit if a band ever sells to an EU buyer |
| minors | no | Users under 18 are allowed | 18+ venues. **Not yet enforced or stated anywhere in the product** — see LEG items |

## Data inventory
Every service that receives user data, including hosting, database and auth providers. It must match the privacy policy (LEG-02).

| Service | Used for | Data it receives | In privacy policy |
|---|---|---|---|
| Cloudflare Workers | Hosting and request handling | All request data, including IPs used as rate-limit keys | no — no policy exists yet |
| Cloudflare D1 | Application database | Buyer name, email, phone; attendee names and notes; order and check-in records; band and member details | no |
| Cloudflare R2 | Payment proof storage | Bank confirmation screenshots. These contain a **third party's** full account number, name and sometimes email — the payer is often not the attendee | no |
| Anthropic | Extracting fields from payment proofs | The proof image itself, and therefore the banking details in it | no |
| Resend | Transactional email | Buyer email addresses, ticket contents, band contact address | no |

## Status

| ID | Sev | Item | Status | Evidence / fix | Checked |
|---|---|---|---|---|---|
| SEC-01 | critical | No secrets in client code or the repo. | TODO | | |
| SEC-02 | critical | Every table or collection has access rules. | TODO | | |
| SEC-03 | critical | User files live in private storage. | TODO | | |
| SEC-04 | critical | Authorization is checked on the server for every request that touches user data. | TODO | | |
| SEC-05 | high | Auth endpoints are protected against abuse. | TODO | | |
| SEC-06 | high | Anything that costs money per call is protected. | TODO | | |
| SEC-08 | high | Input is validated on the server and queries are parameterized. | TODO | | |
| SEC-09 | medium | No known high or critical vulnerabilities in dependencies. | TODO | | |
| SEC-10 | medium | Security headers and cookies are set. | TODO | | |
| SEC-11 | medium | Errors and logs don't leak. | TODO | | |
| SEC-12 | medium | Sessions end properly. | TODO | | |
| SEC-13 | low | CORS allows only your own origins. | TODO | | |
| SEC-14 | high | Environments are separated. | TODO | | |
| AI-01 | high | Users know when they're dealing with AI. | TODO | | |
| AI-02 | high | AI providers are disclosed and set up for privacy. | TODO | | |
| AI-07 | high | Every AI call has limits. | TODO | | |
| AI-08 | high | User input can't override the AI's instructions or permissions. | TODO | | |
| AI-09 | medium | AI failures degrade gracefully. | TODO | | |
| AI-11 | medium | Prompt and response logs are minimal and protected. | TODO | | |
| LEG-01 | critical | A privacy policy is published and linked wherever users need it. | TODO | | |
| LEG-02 | critical | The privacy policy matches the code. | TODO | | |
| LEG-03 | high | Terms of service are published and accepted. | TODO | | |
| LEG-04 | critical | Users can delete their account, and deletion really deletes. | TODO | | |
| LEG-07 | critical | No fake reviews, testimonials or social proof. | TODO | | |
| LEG-11 | high | The minimum age is decided and enforced. | TODO | | |
| LEG-13 | high | Marketing messages follow the rules. | TODO | | |
| LEG-14 | medium | Everything you ship is licensed for commercial use. | TODO | | |
| PERF-01 | high | Performance is measured, not assumed. | TODO | | |
| PERF-02 | high | No N+1 queries. | TODO | | |
| PERF-03 | high | Lists that can grow are paginated on the server. | TODO | | |
| PERF-04 | medium | Columns you filter, join or sort on are indexed. | TODO | | |
| PERF-05 | medium | Serverless apps use pooled database connections. | TODO | | |
| PERF-06 | medium | Images are optimized. | TODO | | |
| PERF-07 | medium | Inputs that trigger requests are debounced. | TODO | | |
| PERF-08 | medium | Heavy or non-critical code loads later. | TODO | | |
| PERF-09 | medium | Initial JavaScript stays small. | TODO | | |
| PERF-10 | low | No unused dependencies and no duplicate libraries. | TODO | | |
| PERF-11 | medium | Caching is deliberate. | TODO | | |
| PERF-12 | medium | Loading doesn't shift the layout. | TODO | | |
| PERF-13 | low | React re-renders are handled by tooling, not guesswork. | TODO | | |
| CQ-01 | high | A formatter runs automatically and the code is formatted. | TODO | | |
| CQ-02 | high | A strict linter passes with zero warnings. | TODO | | |
| CQ-03 | high | Types are strict. | TODO | | |
| CQ-04 | medium | There's no dead code. | TODO | | |
| CQ-05 | medium | Files and functions stay small and focused. | TODO | | |
| CQ-06 | medium | The folder structure is consistent and predictable. | TODO | | |
| CQ-07 | medium | Names say what things are. | TODO | | |
| CQ-08 | medium | Errors are handled one consistent way. | TODO | | |
| CQ-09 | medium | Configuration is checked at startup. | TODO | | |
| CQ-10 | high | Core logic has tests, and they run in CI. | TODO | | |
| CQ-11 | high | Checks block bad merges and deploys. | TODO | | |
| CQ-12 | low | Dependencies are current and there's one way to install them. | TODO | | |
| CQ-13 | low | Comments explain why, not what. | TODO | | |
| CQ-14 | medium | A new developer can get it running from the README. | TODO | | |
| FE-01 | high | DESIGN.md exists and the UI follows it. | TODO | | |
| FE-02 | high | One animation library per codebase, used politely. | TODO | | |
| FE-03 | critical | Text is readable. | TODO | | |
| FE-04 | high | Every data screen has loading, empty and error states. | TODO | | |
| FE-05 | high | Keyboard and screen-reader basics work. | TODO | | |
| FE-06 | high | It works on a phone. | TODO | | |
| FE-07 | medium | No dead ends or leftovers. | TODO | | |
| FE-08 | medium | Fonts load fast and stay few. | TODO | | |
| FE-09 | medium | Brand basics are in place. | TODO | | |
| FE-10 | low | Dark mode is either finished or not offered. | TODO | | |
| MKT-01 | high | Each public page has a unique title and description. | TODO | | |
| MKT-02 | high | Links look good when shared. | TODO | | |
| MKT-03 | high | Search engines crawl the right things. | TODO | | |
| MKT-04 | medium | Each page has one canonical address. | TODO | | |
| MKT-05 | medium | Structured data where it fits. | TODO | | |
| MKT-06 | high | Analytics track what matters. | TODO | | |
| MKT-07 | medium | The landing page answers the basics above the fold. | TODO | | |
| MKT-08 | medium | Product marketing context exists. | TODO | | |
| MKT-10 | low | Launch assets are ready. | TODO | | |
| MKT-11 | low | Google Preferred Sources only if you publish regularly. | TODO | | |
| LCH-02 | critical | Backups exist and a restore has been tested. | TODO | | |
| LCH-03 | critical | Spending is capped or alarmed on every paid service. | TODO | | |
| LCH-04 | high | A kill switch exists. | TODO | | |
| LCH-05 | high | Crashes and errors reach you. | TODO | | |
| LCH-06 | high | Uptime is monitored. | TODO | | |
| LCH-07 | high | Email is authenticated and comes from your domain. | TODO | | |
| LCH-08 | high | Signup works for a stranger. | TODO | | |
| LCH-09 | high | Key flows pass an end-to-end run. | TODO | | |
| LCH-10 | medium | Real people have tried it. | TODO | | |
| LCH-11 | medium | You can roll back in minutes. | TODO | | |
| LCH-12 | medium | Domain and HTTPS are solid. | TODO | | |
| LCH-13 | medium | Legal and support links are live. | TODO | | |
