# NV Immigration Portal

A full-stack multi-portal immigration platform with three distinct portals running from one codebase and one backend.

```
nv-immigration-portal/
├── backend/    Express + Prisma + PostgreSQL  (18+ modules)
└── frontend/   React (Vite) + TanStack Query + Zustand
```

---

## Portals

| URL (local) | Who | Login |
|---|---|---|
| `localhost:5173/partner/login` | Partner agents & sub-agents | `agent@example.com` |
| `localhost:5173/admin/login` | Admin & Super Admin | `admin@example.com` / `super@example.com` |
| `localhost:5173/login` | Students | Register a new account |

All passwords in the seed: `password123` (agents/admins) — students register themselves.

---

## Getting started

### 1. Database

```bash
cd backend
cp .env.example .env          # fill in DATABASE_URL and JWT secrets
npm install
npm run prisma:deploy         # applies all 12 migrations
npm run prisma:seed           # 15 countries, 24 institutions, 97+ courses, reference data
npm run dev                   # http://localhost:4000
```

The seed is **idempotent** — re-run as often as needed.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev                   # http://localhost:5173
```

Vite proxies `/api/*` to `localhost:4000`. The refresh token is an httpOnly `SameSite=Strict` cookie — keep frontend and API on the same origin in development.

---

## URL structure

### Partner portal (`/partner/*`)
| Route | Screen |
|---|---|
| `/partner/login` | Partner login |
| `/partner/dashboard` | Course finder / program browser |
| `/partner/ask-team` | Course inquiry form |
| `/partner/history` | Course inquiry history |
| `/partner/add-application` | New application |
| `/partner/app-history` | Application history |
| `/partner/moi-accepted` | MOI acceptances |
| `/partner/commission` | University commission rates |
| `/partner/entry-requirements/ug` | UG entry requirements |
| `/partner/entry-requirements/pg` | PG entry requirements |
| `/partner/updates` | Important updates |
| `/partner/documents/*` | Document bank (5 categories) |
| `/partner/report` | Report dashboard |
| `/partner/help` | Help & support |
| `/partner/settings` | Agency branding settings |
| `/partner/profile` | Profile management |

### Admin panel (`/admin/*`)
| Route | Screen |
|---|---|
| `/admin/login` | Admin login (dark theme, rejects non-admin) |
| `/admin` | Admin dashboard (stat cards + quick actions) |
| `/admin/institutions` | Institution CRUD |
| `/admin/courses` | Course CRUD with intake management |
| `/admin/commissions` | Commission rates |
| `/admin/entry-requirements` | Entry requirements |
| `/admin/moi` | MOI acceptances CRUD |
| `/admin/updates` | Important updates |
| `/admin/documents` | Document bank management |
| `/admin/announcements` | Portal banners |
| `/admin/support-contacts` | Support team |
| `/admin/users` | User management (SUPER_ADMIN only) |
| `/admin/profile` | Profile management |

### Student portal (`/*`)
| Route | Screen |
|---|---|
| `/login` | Student login + register |
| `/programs` | Program browser (public, no auth required) |
| `/programs/:id` | Program detail |
| `/apply/:courseId` | Apply form (auth required) |
| `/my-applications` | Application tracker with stage filter |
| `/my-applications/:id` | Application detail + progress tracker |
| `/profile` | Student profile |

---

## Architecture

### Backend — `src/modules/<area>/`

Each module has exactly four files:

| File | Responsibility |
|---|---|
| `*.service.js` | Database queries and business logic. No HTTP knowledge. |
| `*.controller.js` | Reads request → calls service → shapes response. No try/catch. |
| `*.schemas.js` | Zod schemas for body, query, params. |
| `*.routes.js` | URL wiring, auth guards, role guards, schema assignment. |

**Modules:** `auth`, `agency`, `announcements`, `applications`, `commissions`, `countries`, `courseInquiries`, `courses`, `documents`, `entryRequirements`, `importantUpdates`, `institutions`, `moiInstitutions`, `notifications`, `profile`, `reports`, `students`, `support`

**Shared utilities:**
- `utils/asyncHandler.js` — wraps every route handler so controllers contain no try/catch
- `utils/pagination.js` — `paginateQuery()` returns `{ items, meta: { total, page, pageSize, totalPages } }` for every list
- `utils/httpErrors.js` — typed errors (`NotFoundError`, `ConflictError`, `ForbiddenError`, `UnauthorizedError`, `BadRequestError`)
- `utils/storage.js` — S3/R2 file upload with local disk fallback
- `src/config.js` — validates all env vars at boot via Zod; missing JWT secret = startup failure

### Frontend — `src/`

**API layer** (`src/api/`): one file per backend module, all using the shared axios `client.js` with single-flight refresh-and-retry.

**State** (`src/store/`):
- `useAuth.js` — user, accessToken, agencyProfile, status (loading/authenticated/anonymous). Clears TanStack Query cache on every session boundary to prevent data bleed between users.
- `useCountryFilter.js` — selected destination synced across the partner dashboard

**Shared components** (`src/components/`):
- `ui/Page` — every screen's title/subtitle/actions header
- `ui/FilterBar` — config-driven filter fields + Apply/Clear
- `ui/DataTable` — columns config with loading, empty, error, and pagination states
- `ui/Pagination` — standalone or inside DataTable
- `ui/DocumentGrid` — the PDF tile grid (all 5 Document Bank categories)
- `ui/Modal` — focus trap, Escape key, background scroll lock
- `ui/StatTile` — Report dashboard stat tiles
- `ui/LogoCropper` — canvas-based image crop with drag + resize handles, live preview thumbnails
- `admin/AdminResourcePage` — generic CRUD page for admin modules
- `admin/ResourceForm` — config-driven form for create/edit modals

**Hooks:**
- `hooks/useUrlFilters.js` — filter state lives in the URL query string; shareable, back/forward-aware
- `hooks/useReferenceData.js` — cached `useCountries()` / `useInstitutions()` for dropdowns
- `hooks/useTheme.js` — derives full `--accent-*` CSS variable scale from a single hex color; `applyTheme()` / `resetTheme()`

---

## Data model

### Key decisions

- **`Application.stage`** is a typed enum driving the Report screen's 8 stat tiles via a single `groupBy`. `stageNote` holds the human-readable detail beside it.
- **`Application.reference`** is a sequential integer (the "POEC ID") — agents read these over the phone.
- **Soft delete** everywhere — `Course`, `Institution`, `Document`, etc. have `archivedAt`. Applications keep pointing at their course after it's withdrawn.
- **`RefreshToken`** stores a SHA-256 hash (never the token itself) and records *why* it was revoked. Only a `ROTATED` token replayed implies theft.
- **`AgencyProfile`** holds `agencyName`, `logoUrl`, `website`, and `accentColor` (hex). A sub-agent inherits their parent's profile automatically.
- **`StudentProfile`** holds student-specific fields: nationality, date of birth, passport number, address.
- **`User.isActive`** — soft-disable accounts without losing history. Deactivation immediately revokes all active sessions.
- **Currency lives on `Country`**, not on courses. Two courses at the same university are not quoted in different currencies.

### Migrations applied (12 total)
1. Initial schema
2. Refresh tokens
3. Refresh token revoke reason
4. Data model overhaul (program API shape, enums, CourseIntake table)
5. Program API overhaul (slug, programLevel enum, minLength/maxLength)
6. Add student role
7. Add country isoCode
8. Add agency profile
9. Add user isActive
10. Add user profile fields (phone, bio, avatarUrl)
11. Add agency accent color
12. Add user profile fields

---

## Authentication

- Access token: **in memory only** (never localStorage)
- Refresh token: **httpOnly cookie**, SHA-256 hashed in DB
- Session restore: `bootstrap()` calls `POST /api/auth/refresh` on app mount
- Token refresh: single-flight axios interceptor — concurrent 401s queue behind one refresh
- Replay detection: a `ROTATED` token replayed revokes all sessions for that user
- Role isolation: STUDENT is blocked from partner endpoints; AGENT is blocked from student endpoints; admin stats require ADMIN+

### Roles
| Role | Access |
|---|---|
| `SUPER_ADMIN` | Everything including user management |
| `ADMIN` | Admin panel + partner portal |
| `AGENT` | Partner portal + agency settings |
| `STUDENT` | Student portal only |

---

## Agency branding (per-agent theming)

Each top-level agent can set:
- **Agency name** — replaces "NV Immigration" in the sidebar
- **Logo** — uploaded with in-browser crop, saved to local disk or S3
- **Accent color** — picked from 12 presets, native color picker, or auto-detected from logo

The color drives the full `--accent-*` CSS variable scale globally for that agent's session. Sub-agents inherit their parent's branding. Changes take effect immediately with no page reload.

---

## Program API response shape

Courses are returned in a standard `program` resource format:

```json
{
  "data": [
    {
      "id": "uuid",
      "type": "program",
      "attributes": {
        "name": "Master of Science - Data Analytics",
        "programLevel": "masters_degree",
        "school": { "name": "...", "city": "...", "countryCode": "CA", "slug": "...", "logoThumbnailUrl": "..." },
        "programIntakes": [{ "id": 123, "startDate": "2027-01-01", "submissionDeadline": "2026-08-15", ... }],
        "tuition": 15000,
        "applicationFee": 100,
        "currency": "CAD",
        "minLength": 12,
        "maxLength": 24,
        "tags": ["top_programs", "instant_offer"],
        "commission": { "type": "percentage", "rateTo": 14, "isTierAdjusted": true }
      }
    }
  ],
  "meta": { "counts": { "total": 97 }, "page": 1, "pageSize": 12, "totalPages": 9 }
}
```

Courses and institutions `GET` endpoints are public (no auth required) so the student program browser works without login.

---

## Bulk program import

```bash
node scripts/import-programs.mjs path/to/data.json
```

Accepts the same JSON shape as the program API response. Handles 100k+ records via batched transactions (500/batch). Idempotent — safe to re-run. Preserves source intake integer IDs, advances the serial sequence after import.

---

## Scripts

| Command | Where | What |
|---|---|---|
| `npm run dev` | `backend/` | API server with `--watch` |
| `npm run prisma:deploy` | `backend/` | Apply pending migrations |
| `npm run prisma:seed` | `backend/` | Seed all reference data |
| `npm run prisma:generate` | `backend/` | Regenerate Prisma client |
| `npm run dev` | `frontend/` | Vite dev server |
| `npm run build` | `frontend/` | Production build |

---

## Environment variables

See `backend/.env.example` for the full list. Required:

```
DATABASE_URL=postgresql://...
JWT_ACCESS_SECRET=...         # min 32 chars
JWT_REFRESH_SECRET=...        # min 32 chars, different from above
COOKIE_SECRET=...
```

Optional (for S3/R2 file storage):
```
STORAGE_ENABLED=true
STORAGE_BUCKET=...
STORAGE_REGION=...
STORAGE_ACCESS_KEY_ID=...
STORAGE_SECRET_ACCESS_KEY=...
STORAGE_PUBLIC_BASE_URL=...
STORAGE_ENDPOINT=...          # for R2/MinIO
```

Without `STORAGE_ENABLED=true`, uploads go to `backend/uploads/` and are served at `/uploads/*`.

---

## Session isolation

When a user logs out and a different user logs in, the TanStack Query cache is **cleared immediately** via `queryClient.clear()`. This prevents any data from a previous user's session appearing in the new session — even briefly. The theme is also reset on logout and re-applied on login.

---

## Known limitations

- No email verification for student registration
- No password reset flow (admin must create a new account)
- Document file upload works locally; S3/R2 requires credentials in `.env`
- No automated test suite beyond manual API verification scripts
- The dynamic import warning in the Vite build (`auth.js`) is a pre-existing non-error warning — it does not affect functionality
