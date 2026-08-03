# NV Immigration Partner Portal — Audit, Refactor & Implementation Plan

Date: 2026-08-03
Scope reviewed: all 69 source files (`backend/` 30, `frontend/` 39), Prisma schema +
migration, seed, CSS, and the 20 reference screenshots of `instantapply.net/partner`.

---

# Progress

**Phase 0 (safety net) and Phase 1 (auth correctness) are done**, on branch
`refactor/foundation`, six commits off the `main` baseline. Closed: F-01, F-02,
F-03, F-04 (mechanism), F-05, F-06 (partly), F-25, F-26. `npm run verify` runs
lint + 8 tests + build, all green.

**One thing is blocked.** Postgres 18 runs on the Windows host and listens on
`0.0.0.0:5432`, but TCP from the WSL subnet is refused — Windows Firewall. No
Docker and no sudo in this shell, so there is no substitute (PGlite over a socket
was tried; Prisma's connection pattern closes it, P1017). Consequences:

- The `RefreshToken` migration is **written but not applied**. Run
  `npm run prisma:migrate` from Windows, or open the firewall — the command is in
  `backend/.env.example`.
- Rotation and replay-revocation logic is **unverified against a real database**.
  Everything ahead of the DB call is verified against a running server: the
  escalation payload is rejected 400, `/auth/users` is 401/403/past-RBAC by role,
  expired vs invalid vs missing tokens are distinguishable, logout is idempotent.
- Phase 2 onward needs the DB, so that is the gate on continuing.

---

# Part 0 — Where the project actually stands

The scaffold is well organised: one folder per business area on both sides,
a single Prisma client, a config-driven sidebar, and 517 lines of finished CSS
covering ~220 selectors. That structure is worth keeping — this plan builds on it
rather than replacing it.

But the README's status table is materially wrong. Counting only what a logged-in
user can actually *do*:

| README claim | Reality |
|---|---|
| Courses ✅ fully wired | Search + tag + country work; 3 of 4 filter dropdowns are dead markup |
| Applications ✅ fully implemented | **Cannot create one.** The course `<select>` has no options |
| MOI Accepted ✅ fully implemented | Renders, but both filters are empty dropdowns |
| Admin institutions ✅ CRUD done | Requires hand-typing a country UUID from Prisma Studio |
| Role guards ✅ fully implemented | **Bypassed after any page refresh** (see F-02) |
| Commission / Entry Req / Doc Bank / Report ⬜ | Correct — not started. 11 screens in the images |

Root cause of most of the dead UI is one missing thing: **there is no
`/api/countries` endpoint** (`backend/src/app.js` wires 7 routers, none for
countries). Every country dropdown in the app is therefore an empty `<select>`,
and the country strip in the header is 15 hardcoded chips against 4 seeded
`Country` rows.

---

# Part 1 — Findings (bugs, errors, structural defects)

Severity: **S1** exploitable / data-integrity, **S2** feature broken for users,
**S3** structural debt that will slow every screen below, **S4** polish.

## S1 — Security & correctness

**F-01 · Public privilege escalation via register**
`backend/src/modules/auth/auth.routes.js:7` mounts `POST /api/auth/register`
with no `requireAuth`. `auth.controller.js:15` forwards the whole body, and
`auth.service.js:30` destructures `role = 'AGENT'` — a default, not a constraint.
So an unauthenticated request with `{"role":"SUPER_ADMIN"}` mints a super admin.
→ Fix: strip `role` from the public path entirely; agents self-register as
`AGENT` only. Admin-created users go through a separate
`POST /api/users` behind `requireRole('SUPER_ADMIN')`.

**F-02 · Role guard silently disabled on refresh**
`useAuth.js:15-17` persists only the token; `user` resets to `null` on reload
while `isAuthenticated` stays `true`. `ProtectedRoute.jsx:15` reads
`allowedRoles && user && !allowedRoles.includes(user.role)` — with `user === null`
the condition short-circuits and the guard **passes**. Any logged-in agent who
refreshes on `/admin/courses` gets the admin UI. The API still returns 403, so
data isn't leaked, but the entire admin surface becomes visible.
→ Fix: persist the user (or re-hydrate from `GET /api/auth/me`), and invert the
guard to fail closed: `if (allowedRoles && !allowedRoles.includes(user?.role)) redirect`.

**F-03 · Refresh token is minted and thrown away**
`auth.service.js:17` signs a 7-day refresh token, returns it in the JSON body —
and no `/api/auth/refresh` route exists (grep: zero hits outside that file).
The access token expires in 15 minutes, so every user is hard-redirected to
`/login` mid-session, losing form state, via `client.js`'s
`window.location.href` on 401.
→ Fix: implement rotation with the refresh token in an httpOnly cookie, plus a
queued retry in the axios interceptor. This is the fix the note at the top of
`useAuth.js` already anticipates.

**F-04 · No input validation anywhere**
`zod` is a declared dependency and is imported zero times. Every controller
passes `req.body` / `req.query` straight to Prisma. `Number(page)` on a
non-numeric query yields `NaN`, and `skip: NaN` throws a Prisma 500.
→ Fix: one `validate(schema)` middleware, a schema per route.

**F-05 · Missing baseline HTTP hardening**
`app.js:14` — if `CORS_ORIGIN` is unset, `origin: undefined` makes `cors`
reflect **any** origin while `credentials: true`. `app.js:15` — `express.json()`
with no `limit`. No `helmet`, no rate limit on `/auth/login` (unlimited
credential stuffing), no request logging, no fail-fast check that
`JWT_ACCESS_SECRET` exists (a missing secret becomes a runtime 500, not a boot
error). No 404 handler, so unknown `/api/*` paths return Express's HTML page to
a JSON client.

**F-06 · Secrets and version control**
`backend/.env` holds live Postgres credentials and JWT secrets on disk, and
**the project is not a git repository at all** — no history, no branch, no way
to review or revert the refactor below. This is the single highest-risk item
before touching code.

## S2 — Broken user-facing features

**F-07 · The application flow is a dead end**
`NewApplication.jsx:63-64` — the course `<select>` contains one disabled
placeholder and a `TODO`. `courseId` can never be set, so
`POST /api/applications` can never be satisfied from the UI. The
"Create application" button on `CourseCard.jsx` (card actions) has no `onClick`,
so the intended entry point is also inert.

**F-08 · Seven sidebar links lead nowhere**
`navConfig.js` declares `/commission`, `/entry-requirements`, `/updates`,
`/documents`, `/report`, `/help`, and `App.jsx` (routes at lines 38-52) defines
none of them. React Router matches nothing, `<main>` renders empty — no 404, no
message. These are exactly the screens in the images.

**F-09 · Every country / institution dropdown is empty**
`CourseFinder.jsx:47-49` (three `<select>` with a single static `<option>`),
`ApplicationHistory.jsx:31`, `MoiAccepted.jsx:28` and `:34`,
`AdminInstitutions.jsx:63` (asks the operator for a raw UUID). Blocked on the
missing `/api/countries`.

**F-10 · Country strip renders codes, not flags**
`CountryStrip.jsx:49` — "omitted in scaffold for brevity". The screenshots show
15 flag chips; the app shows 15 text labels. Also: the strip offers UK, GR, NZ,
FR, SP, UAE, MT, IR, AT, HU, CA, AU, US, NE, IL while `seed.js` creates only
UK, CA, AU, NE — selecting any of the other 11 returns an empty grid with no
explanation.

**F-11 · Application history can't reach page 2**
`ApplicationHistory.jsx` keeps `page` in filter state and the service returns
`totalPages`, but no `<Pagination>` is rendered and nothing ever increments it.
Same for `CourseInquiryHistory.jsx`, which additionally exposes none of the
`countryId` / `intake` filters the backend already supports.

**F-12 · Stale page index on country change**
`CourseFinder.jsx` resets `page` on search and tag change but not on
`selectedCountry` — the country lives in a separate Zustand store. Switch
country while on page 4 and you get an empty grid.

**F-13 · Deleting a course 500s**
`courses.service.js:47` is a hard `prisma.course.delete`. Any course with an
`Application` row hits the FK constraint; the raw Prisma error goes through
`errorHandler` as a 500. The admin UI's Delete button is a landmine.
→ Fix: soft delete (`archivedAt`) — the right call anyway, since applications
must keep pointing at the course they were made against.

**F-14 · Mobile navigation is unreachable**
`Header.jsx:25` — the `menu-toggle` button has no `onClick`. `index.css` has
`.sidebar-overlay` and `body.sidebar-open .sidebar { transform: translateX(0) }`
(lines 466-467) behind a `max-width: 900px` query, but no JSX ever renders the
overlay or sets the class. Below 900px the sidebar is off-canvas with no way to
open it.

**F-15 · Header search is decorative**
`Header.jsx:34-49` — local `useState` wired to nothing, including the `/` kbd
hint. Either wire it to a global search or remove it; shipping a search box that
silently discards input is worse than having none.

**F-16 · Hardcoded currency and copy**
`CourseCard.jsx:43,47` print `${fee} CAD` for every course regardless of
country — the screenshots show GBP figures for UK institutions.
`CourseFinder.jsx:29` greets "Welcome back, agent name" instead of `user.name`.
Both header CTAs on that page have no handler.

## S3 — Structural debt

**F-17 · No `Notification` model** — `notifications.service.js` synthesises one
item from a blacklist count. The header shows a badge count, the images show a
messages badge *and* a "Recent Application Notifications" feed with per-item
read state. Not extensible as written.

**F-18 · Two dangling schema fields**
`schema.prisma:22` `User.parentAgentId` has no self-relation (the images show an
"invite sub-agent" action in the header). `schema.prisma:70`
`CourseInquiry.countryId` has no `@relation` to `Country` — no referential
integrity, and the history table can't display a country name.

**F-19 · Zero indexes**
The migration contains 6 `FOREIGN KEY` constraints and **0 `CREATE INDEX`**.
Postgres does not auto-index FK columns. Every `where: { agentId }`,
`institution: { country: { code } }` and `orderBy: createdAt` is a sequential
scan. Cheap to fix now, painful later.

**F-20 · Controller boilerplate ×30**
Every handler is the identical `try { … } catch (err) { next(err) }`. Pagination
maths (`skip`, `take`, `totalPages`) is copy-pasted across 5 services with two
different default page sizes (12 for courses, 20 elsewhere).

**F-21 · No shared frontend primitives**
The filter card + `Apply Filter` / `Clear Filter` pair appears on **10 of the 11
screens in the images**; the table card + empty state on 6; the PDF-tile grid on
5. Today each page hand-rolls its own markup. Building these three components
first is the difference between ~11 similar files and ~11 config objects.

**F-22 · `.view active` is dead weight from the mockup**
`index.css:267-268` sets `.view { display: none }` and `.view.active { display: block }`
— a tab-switching mechanism from the original single-page HTML. Every feature
component now hardcodes `className="view active"`; omit `active` by accident and
the page renders invisible with no error. Routing already does this job.

**F-23 · `app-shell` class has no styles** — used in `App.jsx`, absent from the
CSS (verified by diffing all JSX class names against all CSS selectors: it is
the only orphan). Harmless, but it's the seam where the mockup was cut.

**F-24 · `multer` is a dependency with zero imports** — presumably reserved for
the Document Bank uploads, which don't exist yet.

**F-25 · No tooling** — no ESLint, no Prettier, no tests, no CI, no
`.nvmrc`/engines. About to matter a lot more with 11 new screens landing.

**F-26 · `node_modules` are Windows binaries in a WSL checkout**
`backend/node_modules/.prisma/client/query_engine-windows.dll.node`, and
`npx vite build` fails outright: `Cannot find module '@rollup/rollup-linux-x64-gnu'`.
The frontend cannot currently be built from this shell. Reinstall per-platform
before anything else.

**F-27 · README is out of sync** — the status table overstates six rows (see
Part 0), and "Next steps" items 3 and 4 are the same sentence duplicated.

---

# Part 2 — Refactor plan

Ordered so that nothing later has to be redone. Each phase ends in a working app.

## Phase 0 — Safety net (½ day)

1. `git init`, `.gitignore` already correct, first commit as the "before" baseline.
   Branch `refactor/foundation`.
2. Rotate the credentials in `backend/.env`, confirm it is untracked, keep
   `.env.example` as the contract. Add a `config.js` that reads and **validates**
   env at boot with zod and throws on a missing secret.
3. `rm -rf node_modules && npm install` in both packages from this shell (F-26),
   add `engines.node` and `.nvmrc`.
4. ESLint + Prettier at the root, one shared config, `npm run lint` in both.
5. `app.js`: helmet, `express.json({ limit: '1mb' })`, morgan, an origin
   allow-list, `express-rate-limit` on `/api/auth/*`, a JSON 404 handler, and
   `/api/health` upgraded to probe the DB with `SELECT 1` (F-05).

## Phase 1 — Auth correctness (1 day)

6. Split registration: public `POST /auth/register` hard-codes `role: 'AGENT'`
   and ignores any role in the body; new `POST /users` behind
   `requireRole('SUPER_ADMIN')` for staff creation (F-01).
7. Add `GET /auth/me`, `POST /auth/refresh`, `POST /auth/logout`. Refresh token
   moves to an httpOnly, `sameSite=strict` cookie; add a `RefreshToken` table so
   logout can actually revoke (F-03).
8. `useAuth`: access token in memory, user hydrated from `/auth/me` on boot with
   a `loading` state so `ProtectedRoute` can wait instead of guessing. Invert the
   role check to fail closed (F-02).
9. `client.js`: replace the `window.location.href` bailout with a single-flight
   refresh-and-retry queue; only redirect once refresh itself fails.

## Phase 2 — Data model (1–2 days)

10. One migration covering: indexes on every FK and `createdAt` used for
    ordering (F-19); `parentAgentId` self-relation and `CourseInquiry.countryId`
    relation (F-18); `createdAt`/`updatedAt`/`archivedAt` on every model;
    `Course.archivedAt` for soft delete (F-13); `Country.flagEmoji` +
    `sortOrder` + `currencyCode`; `Institution.logoUrl` + `isTrending`;
    `Course.currencyCode` so fees stop being CAD-by-assumption (F-16).
11. Rename `Course.status` → `Course.badges` (it holds pill labels like
    "Instant Offer", and reads as a lifecycle field next to
    `Application.primaryStatus`).
12. Rewrite `seed.js`: all 15 countries from the strip with flags and
    currencies (F-10), realistic institutions per country with logos, and at
    least one row for every new reference table in Phase 3 so no screen ships
    with an untestable empty state.

## Phase 3 — Backend structure (2 days)

13. `asyncHandler` wrapper and a `paginate({ page, pageSize })` util with one
    default; delete ~30 try/catch blocks and 5 copies of the skip/take maths (F-20).
14. `validate(schema, 'body'|'query'|'params')` middleware + a zod schema file
    per module (F-04).
15. New `countries` module — `GET /api/countries` — the unblock for F-09.
16. Normalise every list response to `{ items, meta: { total, page, pageSize, totalPages } }`.
17. `NotFoundError` / `ConflictError` / `ValidationError` classes so
    `errorHandler` maps Prisma codes (P2002 → 409, P2003 → 409, P2025 → 404)
    instead of blanket 500s (F-13).

## Phase 4 — Frontend primitives (2 days)

These three components carry the 11 new screens. Build them before the screens.

18. **`<FilterBar />`** — driven by a config array of field descriptors
    (`select` | `text` | `date`), renders the exact `filter-card` / `filter-grid`
    markup already in the CSS, plus the `Apply Filter` / `Clear Filter` pair from
    every screenshot. Pairs with a `useUrlFilters()` hook that syncs state to the
    query string, matching the reference portal's
    `?country_id=…&university_id=…` behaviour so filtered views are linkable.
19. **`<DataTable />`** — columns config, loading row, empty row, and a built-in
    `<Pagination>` (fixes F-11 for every table at once).
20. **`<DocumentGrid />`** — the PDF-tile grid from the five Document Bank
    screens, with a shared `<DocumentTile>`.
21. `<CountrySelect />` and `<InstitutionSelect />` on top of `/api/countries`
    and `/api/institutions`, with a shared `useReferenceData` cache. Retire the
    UUID text input (F-09).
22. Delete `.view` / `.view.active` from the CSS and the `className="view active"`
    from all 9 feature components; introduce a `<Page title subtitle actions>`
    wrapper that owns `page-head` instead (F-22, F-23).
23. Split `index.css` into `styles/tokens.css`, `shell.css`, `components.css`,
    `pages.css`. Same rules, same order — a mechanical move, verified by
    screenshot diff.

## Phase 5 — Repair the existing screens (1–2 days)

24. Application flow (F-07): add a course picker — `CourseCard`'s
    "Create application" navigates to `/add-application?courseId=…`, and the form
    reads it, shows the resolved course, and also offers a searchable
    `<CourseSelect>` for direct entry.
25. Wire the three dead `CourseFinder` selects to real destination /
    institution / degree-level filters, and extend
    `courses.service.searchCourses` to match institution name as well as course
    title. Reset `page` on country change (F-12).
26. Give `ApplicationHistory` and `CourseInquiryHistory` the full filter set
    their services already accept, plus pagination.
27. Fix the copy and currency issues in F-16, wire both header CTAs, wire or
    remove the header search (F-15), and wire `menu-toggle` + render
    `<SidebarOverlay>` so mobile nav works (F-14).
28. Rewrite the README status table honestly, drop the duplicated next-step
    (F-27).

---

# Part 3 — Implementation plan for the screens in the images

The 20 screenshots are `instantapply.net/partner` — the target feature set.
Eleven distinct screens, all sharing one shell.

## 3.0 Shell work every screen depends on

Visible in every screenshot, currently missing:

- **Two global announcement banners** above the page content: a red one
  ("this list of universities are blacklisted…") with a `Click for list` button
  opening a blacklisted-institutions modal, and a blue one ("Declaration form is
  a Mandatory Document for Application") with `Download Declaration Form`.
  → `Announcement` model (`variant`, `message`, `ctaLabel`, `ctaUrl`,
  `isActive`, `sortOrder`), `GET /api/announcements`, `<AnnouncementBar>` in the
  shell. Admin-editable, not hardcoded.
- **Flag chips** in the country strip (F-10), sourced from `/api/countries`
  rather than the hardcoded array.
- **Header actions**: invite-sub-agent (person+), notifications bell with count,
  messages bubble with count, avatar menu. Three of the four are new.
- **Expandable sidebar sections** — images 3 and 6 show `Entry Requirements`
  and `Document Bank` expanding into sub-items. `navConfig.js` needs a
  `children` array and `Sidebar.jsx` a disclosure state that auto-opens on the
  active child route.

## 3.1 Data model additions

```prisma
model UniversityCommission {          // images 1–2
  id            String  @id @default(uuid())
  institutionId String
  tiers         Json    // [{ label: "1-5 Students", rate: "15%" }, …] — the
                        // screenshots show 1–2 free-form tiers per row
  notes         String?
  institution   Institution @relation(...)
  @@unique([institutionId])
}

enum StudyLevel { UG PG }

model EntryRequirement {              // images 3–4
  id                   String     @id @default(uuid())
  institutionId        String
  level                StudyLevel
  englishRequirement   String     // "IELTS 6.5 overall no less than 6.0, …"
  academicRequirement  String
  offerTimeline        String     // "48 to 72 hours", "1 Week"
  credibilityInterview Boolean
  financialInformation String
  institution          Institution @relation(...)
  @@unique([institutionId, level])
}

model ImportantUpdate {               // images 5–6
  id            String   @id @default(uuid())
  title         String
  body          String
  publishDate   DateTime
  countryId     String?
  institutionId String?
  attachmentUrl String?              // drives the download icon
}

enum DocumentCategory { VISA_DOCUMENT REFUND_FORM INSTITUTE_BROCHURE SOP LOR }

model Document {                      // images 7–18, all five categories
  id            String @id @default(uuid())
  category      DocumentCategory
  title         String
  fileUrl       String
  countryId     String?
  institutionId String?
  sortOrder     Int    @default(0)
  @@index([category, countryId, institutionId])
}

model SupportContact {                // image 21
  id        String  @id @default(uuid())
  name      String
  phone     String
  avatarUrl String?
  sortOrder Int     @default(0)
}

model Notification {                  // replaces the derived stub (F-17)
  id            String   @id @default(uuid())
  userId        String
  applicationId String?
  kind          String   // "NEW_APPLICATION" | "INFO_QUERY" | "DOCUMENT_QUERY"
  title         String
  body          String
  readAt        DateTime?
  createdAt     DateTime @default(now())
  @@index([userId, readAt])
}

model UsefulInformation {             // image 19 panel
  id String @id @default(uuid()) …
}
```

Plus, on `Application`:

```prisma
reference   Int      @default(autoincrement()) @unique  // the "POEC ID: 4367"
intakeLabel String                                      // "March 2027"
stage       ApplicationStage                            // the 8 Report tiles
deadlineAt  DateTime?                                   // "Upcoming Deadlines"

enum ApplicationStage {
  PROFILE_ASSESSMENT APPLICATION CONDITIONAL_OFFER UNCONDITIONAL_OFFER
  FEES_PAYMENT CAS_LETTER VISA_APPLICATION VISA_APPROVAL
}
enum CourseInquiryStage { INQUIRY PENDING OFFERED APPLIED }
```

`stage` as an enum is what makes the Report screen a single `groupBy` instead of
eight hand-counted queries — and it replaces today's free-text
`primaryStatus` / `secondaryStatus` pair, which no code can reason about.

## 3.2 API surface

| Endpoint | Serves |
|---|---|
| `GET /api/countries` | every dropdown + the flag strip |
| `GET /api/announcements` | the two global banners |
| `GET /api/institutions?country=&search=&blacklisted=` | dropdowns + `Click for list` modal |
| `GET /api/commissions?country=&search=` | Universities Commission |
| `GET /api/entry-requirements?level=UG|PG&country=&institutionId=&english=&credibilityInterview=` | UG + PG Requirements |
| `GET /api/important-updates?from=&to=&countryId=&institutionId=` | Important Updates |
| `GET /api/important-updates/:id` | the eye/Details action |
| `GET /api/documents?category=&countryId=&institutionId=&search=` | all five Document Bank screens |
| `GET /api/support-contacts` | Help & Support |
| `GET /api/reports/summary` | the 12 Report tiles, one `groupBy` per enum |
| `GET /api/institutions/trending` | Trending Universities carousel |
| `GET /api/applications/deadlines?upcoming=true` | Upcoming Deadlines panel |
| `GET /api/notifications?unread=`, `PATCH /:id/read` | bell + Recent Notifications feed |
| `GET/POST /api/messages` | the messages badge + Help & Support "Message" links |
| `POST /api/sub-agents` | the invite-sub-agent header action |
| `POST /api/documents` (multipart, admin) | finally uses `multer` (F-24) |

Everything except reports and messages is a plain filtered list — which is why
Phase 4's `FilterBar` + `DataTable` pays for itself immediately.

## 3.3 Screen-by-screen build

Each is `<Page>` + `<FilterBar config>` + `<DataTable columns>` or
`<DocumentGrid>`. Route names align with `navConfig.js` so F-08 closes.

| # | Route | Screen | Shape | Notes from the images |
|---|---|---|---|---|
| 1 | `/commission` | Universities Commission | filters: Country, Search by Name → table: Country, University Name, Commission | commission cell renders multi-line tiers ("1-5 Students: 15%" / "6+ Students: 17%") |
| 2 | `/entry-requirements/ug` | UG Entry Requirements | filters: Country, Institution, English Requirement, Credibility Interview → 6-col table | long free-text cells; table needs `overflow-x: auto` |
| 3 | `/entry-requirements/pg` | PG Entry Requirements | same component, `level=PG` | subtitle "Post Graduate Programs" |
| 4 | `/updates` | Important Updates | filters: Publish Date From/To, Country Preferences, University → table w/ Details column | two row actions: eye (detail modal) and download (only when `attachmentUrl` exists — image 5 shows one row with both, one with only the eye) |
| 5 | `/documents/visa` | Visa Documents | filters: Country, Institution, Search → `DocumentGrid` | 18 tiles incl. per-country "List of documents for …" |
| 6 | `/documents/refund-forms` | Refund Forms | same | 5 tiles |
| 7 | `/documents/brochures` | Institute Brochures | same | image 11 is the **empty state** — "No Data Found" with filters applied. Build that state deliberately |
| 8 | `/documents/sop` | SOP Documents | same | ~50 tiles → needs pagination or virtualisation, unlike the other four |
| 9 | `/documents/lor` | LOR Documents | same | 6 tiles |
| 10 | `/report` | Report | stat tiles + carousel + feed + 2 panels | detailed below |
| 11 | `/help` | Help & Support | contact card grid | name, phone, `Message` link → opens the message thread |

Screens 5–9 are **one** `<DocumentBankPage category>` component behind five
routes, not five files.

**Report (`/report`, images 19–20)** is the only composite screen:

- Row 1 — 8 stat tiles: Profile Assessment, Applications, Condition Offers,
  UnConditional Offers, Fees Payment, CAS Letters, Visa Application,
  Visa Approval. One `groupBy: ['stage']` over the agent's applications.
- Row 2 — "Course Inquiry": Course Inquiry, Pending Course, Offered Course,
  Applied Course. One `groupBy` over `CourseInquiryStage`.
- "Trending Universities" logo carousel. Note: three logos in image 20 render as
  broken-image alt text in the reference portal — our `<InstitutionLogo>` must
  fall back to the initials chip `CourseCard` already uses.
- "Recent Application Notifications" — avatar, `POEC ID: 4367 - RMIT University -
  March 2027`, message excerpt, timestamp, eye action, `View All`.
- "Useful Informations" and "Upcoming Application Deadlines" — both empty in the
  screenshots; ship the designed empty state (icon + message), not a blank box.

All counts are agent-scoped, reusing the `req.user.role === 'AGENT'` scoping
already correct in `applications.controller.js`.

---

# Part 4 — Sequence & estimates

| Phase | Work | Est. | Exit criteria |
|---|---|---|---|
| 0 | Safety net | 0.5d | git history exists; both packages build in WSL; lint passes; `/api/health` probes the DB |
| 1 | Auth correctness | 1d | F-01…F-03 closed; refresh across a 15-min boundary keeps the session; agent hitting `/admin/*` after refresh is redirected |
| 2 | Data model | 1.5d | one migration; 15 countries + every new table seeded; no screen has an untestable empty state |
| 3 | Backend structure | 2d | zod on every route; `/api/countries` live; uniform `{ items, meta }`; Prisma error codes mapped |
| 4 | Frontend primitives | 2d | `FilterBar` / `DataTable` / `DocumentGrid` used by ≥1 existing screen; `.view` gone; CSS split with no visual diff |
| 5 | Repair existing screens | 1.5d | an application can be created end-to-end; every dropdown populated; every table paginated |
| 6 | Reference-data modules | 2d | all endpoints in §3.2 live with seeded data |
| 7 | The 11 screens | 3.5d | every `navConfig` path resolves; F-08 closed |
| 8 | Shell completion | 1.5d | banners, flags, expandable sidebar, notifications, messages, sub-agent invite |
| 9 | Hardening | 2d | Vitest on services + guards, Playwright on login→apply→report, a11y pass on tables/dropdowns, README rewritten |

**≈17.5 working days.** Phases 0–2 are prerequisites for everything; 3+4 can run
in parallel across two people; 6 and 7 parallelise per screen once 4 lands.

## Things to decide before Phase 2

1. **Is `instantapply.net` the design target or a competitor to differentiate
   from?** It changes whether §3.3 is a spec or a starting point.
2. **Who maintains the reference data** (commissions, requirements, documents)?
   The plan assumes admin CRUD screens are needed — that's ~5 more screens not
   costed above. If it's a CSV/ops import instead, say so now: the existing
   `POST /api/courses/bulk-import` becomes the pattern.
3. **File storage for the Document Bank** — S3/R2 presigned URLs, or local disk?
   Affects the `multer` wiring in Phase 6.
4. **`primaryStatus`/`secondaryStatus`** — the enum in §3.1 replaces them. If
   real data already exists in those columns, we need the mapping table.
