# NV Immigration — Partner Portal

Agent-facing portal for a study-visa consultancy. Agents search a course
catalogue, submit applications for their students, track them through a visa
pipeline, and read the reference data they need to advise (commission rates,
entry requirements, document templates, policy updates).

```
nv-immigration-portal/
├── backend/     Express + Prisma + PostgreSQL API   (15 modules)
└── frontend/    React (Vite) + React Query + Zustand
```

---

## Getting started

### 1. Database

```bash
cd backend
cp .env.example .env          # then fill it in — see the notes in that file
npm install
npm run prisma:migrate        # applies 4 migrations
npm run prisma:seed           # 15 countries, 24 institutions, 72 courses, + reference data
npm run dev                   # http://localhost:4000
```

The seed is **idempotent** — re-run it as often as you like. It prints the four
logins it creates, all with password `password123`:

| Email | Role | What it shows |
|---|---|---|
| `agent@example.com` | AGENT | the main partner-facing experience (8 applications) |
| `subagent@example.com` | AGENT | a sub-agent under the above (3 applications) |
| `admin@example.com` | ADMIN | adds the Admin sidebar section; sees all 11 applications |
| `super@example.com` | SUPER_ADMIN | can additionally `POST /api/auth/users` |

### 2. Frontend

```bash
cd frontend
npm install
npm run dev                   # http://localhost:5173
```

Vite proxies `/api/*` to `http://localhost:4000`, which keeps the frontend and
API on one origin in development. That matters: the refresh token is an httpOnly
`SameSite=Strict` cookie, and a cross-origin setup would drop it.

### Verifying a change

```bash
npm run verify                         # from the repo root: lint + 58 tests + build
npm --prefix backend run verify:auth   # 30 auth integration checks (needs a live DB)
```

---

## ⚠️ Environment notes (Windows + WSL)

If you work on this from WSL while the repo lives on a Windows drive, two things
will bite you. Both have cost real time.

**1. Postgres on the Windows host is not reachable from inside WSL.**
`localhost` resolves inside the WSL VM, not on Windows. The simplest workaround is
to run DB-touching commands with the Windows node, which resolves it correctly and
needs no config change:

```bash
node.exe prisma/seed.js
node.exe node_modules/prisma/build/index.js migrate deploy
node.exe server.js
```

`node.exe` is on the PATH inside WSL via `/mnt/c/Program Files/nodejs`. The
alternative — opening the Windows firewall to the WSL subnet — is documented in
`backend/.env.example`.

**2. Windows and WSL share `node_modules`, but native modules are per-platform.**
Whichever side ran `npm install` last wins, and the other then fails with
`Cannot find native binding` (rollup) or `could not locate the Query Engine`
(Prisma). Re-run `npm install` on the side you're working from. Prisma is exempt
because `schema.prisma` declares `binaryTargets` for both.

---

## How it's organised

### Backend — one folder per business area

`backend/src/modules/<area>/` contains four files, and nothing else needs touching
to add a feature:

| File | Responsibility |
|---|---|
| `*.service.js` | database access and business rules. Knows nothing about HTTP. |
| `*.controller.js` | reads the request, calls the service, shapes the response. No try/catch — see below. |
| `*.schemas.js` | zod schemas. Every route validates its body, query and params. |
| `*.routes.js` | URL wiring, auth and role guards, and which schema applies where. |

`courses/` is the fullest example — copy its four-file shape.

Three shared pieces are load-bearing:

- **`utils/asyncHandler.js`** — Express 4 does not catch rejections from async
  handlers; an uncaught one hangs the request forever. Every route is wrapped, so
  controllers contain no try/catch.
- **`utils/pagination.js`** — `paginateQuery` plus one uniform list shape.
  **Every list endpoint returns `{ items, meta: { total, page, pageSize, totalPages } }`.**
- **`utils/httpErrors.js`** — typed errors (`NotFoundError`, `ConflictError`, …) so
  services express intent without knowing about status codes.
  `middleware/errorHandler.js` also maps Prisma's `P2002`/`P2003`/`P2025` onto
  409/404 rather than letting a constraint violation surface as a 500.

`src/config.js` reads and **validates** the entire environment at boot. A missing
or placeholder JWT secret is a startup failure with a readable message, not a 500
on the first login.

### Frontend — features on top of shared primitives

`frontend/src/components/ui/` is where the leverage is. The reference design has
the same filter card on 10 of its 11 screens, the same table card on 6, and the
same document-tile grid on 5, so these are built once:

| Primitive | Used by |
|---|---|
| `Page` | every screen (title, subtitle, header actions) |
| `FilterBar` | config-driven filter fields + Apply/Clear |
| `DataTable` | columns config with loading, empty, **error** and pagination states |
| `Pagination` | inside DataTable, or standalone for the card grid |
| `DocumentGrid` | all five Document Bank categories |
| `Modal` | Escape, focus trap, restores focus, locks background scroll |
| `StatTile` | the Report dashboard |

Plus two hooks:

- **`hooks/useUrlFilters.js`** — filter state lives in the query string, so
  filtered views are linkable and back/forward behave. It also enforces "any filter
  change resets to page 1" in one place. **Pass `defaults` as a module-level
  constant**, not an inline object; it must be a stable reference.
- **`hooks/useReferenceData.js`** — cached `useCountries()` / `useInstitutions()`
  for the dropdowns.

`components/layout/navConfig.js` is the single source of truth for the sidebar. Add
a page there once and the link, icon and (for entries with `children`) the
expandable group all appear. You never edit `Sidebar.jsx` to add a menu item.

### Consolidations worth knowing before you add a file

- **Entry Requirements** is *one* component rendered at two routes with a `level`
  prop. UG and PG are the same table over the same data.
- **Document Bank** is *one* component behind five routes with a `category` prop.
- The **Report** screen is one composite `GET /api/reports/summary`, not six
  requests. It's a dashboard; every panel is needed at once.

---

## Data model

`backend/prisma/schema.prisma` is commented throughout. The parts that surprise
people:

- **`Application.stage`** is an enum of the 8 pipeline steps the Report screen
  counts, with a free-text `stageNote` beside it for the human detail. The enum is
  what makes that screen a single `groupBy`.
- **`Application.reference`** is a sequential integer (the "POEC ID"), because
  agents read these out on the phone. A uuid is not dictatable.
- **`Course.badges`** holds display pills ("Instant Offer"). It is decoration, not a
  lifecycle field.
- **Soft delete.** `Course` and the reference tables have `archivedAt`. Withdrawing
  a course from the catalogue must not erase the applications submitted against it
  — and a hard delete would fail on the foreign key anyway.
- **`UniversityCommission.tiers` is `Json`** on purpose. Real commission data is
  irregular: one flat rate, or bands by student volume, or per-programme rates.
- **`RefreshToken`** stores a SHA-256 hash, never the token, and records *why* it
  was revoked. Only a `ROTATED` token being replayed implies theft; a `LOGOUT` one
  is a stale tab and must not sign you out on your other devices.
- **Currency lives on `Country`.** Tuition in one country is not quoted in two
  currencies, and hardcoding one is how every UK course came to be priced in CAD.

Every foreign key and ordering column is indexed. Postgres does not do this for
you, and the first migration shipped 6 foreign keys with 0 indexes.

---

## Status

| Area | State |
|---|---|
| Auth (login, refresh rotation, replay detection, revoking logout, RBAC) | ✅ verified against a live DB |
| Courses (search, filters, soft delete, bulk-import endpoint) | ✅ |
| Applications (create, filtered history, stage pipeline, detail) | ✅ end-to-end |
| Course inquiries | ✅ |
| MOI accepted · Commission · Entry Requirements (UG/PG) | ✅ |
| Important Updates (+ detail modal) | ✅ |
| Document Bank — all five categories | ✅ read-only |
| Report dashboard | ✅ |
| Help & Support | ✅ `tel:` and WhatsApp links |
| Notifications (unread count, mark read/all) | ✅ |
| Global announcement banners | ✅ admin-editable via API |
| Admin UI | 🟡 institutions + courses only. Reference data is editable via the API but has no screens yet. |
| Document upload | ⬜ endpoints register by URL. S3/R2 presigned upload not built. |
| Sub-agent invite | ⬜ schema and scoping work; no UI on the header action yet. |
| Backend tests | 🟡 `scripts/verify-auth.mjs` covers auth. No Vitest suite yet. |
| E2E tests | ⬜ |

**Not verified:** nobody has loaded the assembled app in a browser. The screens are
covered by render tests against fixtures copied from live API responses, and every
endpoint has been exercised against the real database, but CSS layout and visual
fidelity are unconfirmed. Expect the newer screens to need visual tuning.

`IMPLEMENTATION_PLAN.md` holds the original audit — 27 findings, what each was, and
how it was closed — plus the remaining phases.

---

## Conventions

- **No control that does nothing.** A button with no handler, a `<select>` with no
  options, a download icon with no file — all were removed or wired. Most of this
  project's bug list was that one pattern.
- **Fail closed.** Guards reject unless explicitly permitted. `ProtectedRoute` has
  three states, not two, because "we don't know yet" must not be treated as
  authenticated.
- **Distinguish empty from broken.** A failed request must never render as "no
  data". `DataTable` has separate error and empty states for exactly this.
- **Required means required.** `level` on entry requirements and `category` on
  documents have no default. Quietly defaulting would make the other screens look
  empty.
- Access token in memory only; refresh token in an httpOnly cookie. Nothing
  auth-related goes in `localStorage`.

## Scripts

| Command | Where | Does |
|---|---|---|
| `npm run verify` | root | lint + tests + build |
| `npm run lint` / `lint:fix` | root | ESLint over both packages |
| `npm run format` | root | Prettier (skips `index.css` and migrations) |
| `npm test` | root | Vitest, 58 tests |
| `npm run dev` | backend | API with `--watch` |
| `npm run prisma:migrate` / `:seed` / `:studio` | backend | schema and data |
| `npm run verify:auth` | backend | 30 auth integration checks against a live DB |
| `npm run dev` / `build` | frontend | Vite |
