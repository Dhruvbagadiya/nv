# NV Immigration Portal — Implementation Log

This document records every major change made to the project, in the order it was done.

---

## Phase 1 — Schema overhaul for program API

**Goal:** Return courses in the standard `{data:[{id,type,attributes}],meta}` shape matching the ApplyBoard-style API.

### Database changes
- Replaced `Course.degreeLevel` (String) → `programLevel` (`ProgramLevel` enum)
- Replaced `Course.durationText` → `minLength` + `maxLength` (integers, months)
- Removed `Course.city`, `Course.intakes[]`
- Added `Course.slug` (unique), `shortName`, `languageOfInstruction`, `abAppCreationEnabled`, `commissionAmount`, `successScoreIntent`, `successScoreLabel`
- Added `Institution.slug` (unique), `city`, `province`
- Added `CourseIntake` table replacing the `String[]` array: `id` (serial, source integer), `startDate`, `openDate`, `submissionDeadline`, `overallScore`, `scoreDetails` (JSON)
- Added typed commission fields to `UniversityCommission`: `commissionType`, `rateFrom`, `rateTo`, `amountFrom`, `amountTo`, `isTierAdjusted`, `maxNumberOfInstallments`, `tuitionBasis`

### API changes
- `GET /api/courses` returns `{data:[...],meta:{counts:{total},page,pageSize,totalPages}}`
- Each program item: `{id, type:"program", attributes:{name, programLevel, school, programIntakes, tuition, currency, commission, ...}}`
- `GET /api/courses` and `GET /api/courses/:id` made **public** (no auth required) so students can browse without logging in
- `GET /api/institutions` and `GET /api/countries` also made public

---

## Phase 2 — Bulk import script

`backend/scripts/import-programs.mjs` — accepts the program API JSON format, imports 100k+ records via:
- Batched transactions (500 programs per transaction)
- Pre-resolved country + institution cache (one DB lookup per unique entity, not per program)
- Source intake integer IDs preserved as PKs via raw SQL `INSERT ... ON CONFLICT DO UPDATE`
- Serial sequence advanced after import to prevent collisions
- Idempotent — safe to re-run

---

## Phase 3 — Full admin panel

### Backend additions
- `Institution`: `slug`, `city`, `province`, `isBlacklisted` added to schema + restore endpoint
- `MoiAcceptance`: full CRUD endpoints added (previously read-only)
- `GET /api/auth/users` — list all users with activity counts (SUPER_ADMIN only)
- `GET /api/reports/admin-stats` — 6 count queries for dashboard stat cards (ADMIN+)

### Frontend — 11 admin pages
| Page | Route | Features |
|---|---|---|
| Admin Dashboard | `/admin` | 6 stat cards (live from DB), 8 quick-action tiles |
| Institutions | `/admin/institutions` | Full CRUD modal: name, slug (auto-derived), country, city, province, logo (URL + preview), trending/blacklist toggles, archive/restore |
| Courses | `/admin/courses` | Full CRUD modal: all program fields, intake date rows (add/remove), tag chip editor, badge chip editor |
| Commissions | `/admin/commissions` | Upsert per institution with tier editor |
| Entry Requirements | `/admin/entry-requirements` | UG/PG tab switcher |
| MOI Acceptances | `/admin/moi` | Full CRUD |
| Important Updates | `/admin/updates` | Full CRUD |
| Document Bank | `/admin/documents` | Upload/manage across 5 categories |
| Announcements | `/admin/announcements` | Manage portal-wide banners |
| Support Contacts | `/admin/support-contacts` | Full CRUD |
| Users | `/admin/users` | List + create with role selection (SUPER_ADMIN only) |

---

## Phase 4 — Portal restructure (3 separate portals)

### URL structure
- Partner: `/partner/*` (moved from `/*`)
- Admin: `/admin/*` (unchanged)
- Student: `/*` (new)

### Auth isolation
- `/partner/login` — partner login, redirects all roles to their home
- `/admin/login` — dark-themed login, rejects non-admin roles with error message
- `/login` — student login + register (tabs)
- `ProtectedRoute` accepts `loginPath` prop so each portal guards to its own login page

### Session bleed prevention
- `useAuth` holds `_queryClient` reference
- `setSession()`, `setAnonymous()`, `logout()` all call `queryClient.clear()` first
- Login pages navigate to `homePathFor(role)` — never `location.state?.from` — preventing previous user's URL from being restored

---

## Phase 5 — STUDENT role + student portal

### Backend
- `STUDENT` added to `Role` enum
- `StudentProfile` table: nationality, dateOfBirth, passportNo, phone, address
- `POST /api/auth/register/student` — public, always creates STUDENT
- `GET/PUT /api/students/profile` — student's own profile
- `GET/POST /api/students/applications` — student's own applications
- `GET /api/students/applications/:id` — single application detail
- All partner endpoints (`/applications`, `/course-inquiries`, etc.) restricted to `AGENT/ADMIN/SUPER_ADMIN`
- All student endpoints restricted to `STUDENT`

### Frontend — student portal
| Page | Route |
|---|---|
| Login + Register | `/login` |
| Program Browser | `/programs` |
| Program Detail | `/programs/:id` |
| Apply Form | `/apply/:courseId` |
| My Applications | `/my-applications` |
| Application Detail | `/my-applications/:id` |
| Student Profile | `/profile` |

Features:
- Debounced search (350ms) on program browser
- Sidebar filters: country (with flag emoji + institution count), program level radio buttons
- Active filter pills with individual × clear buttons
- Skeleton loading cards during fetch
- Stage filter chips on My Applications
- Application progress tracker (8-step visual stepper)
- Student profile with student-specific fields (DOB, passport, nationality, address)

---

## Phase 6 — Production audit + bug fixes (11 issues)

| # | Bug | Fix |
|---|---|---|
| 1 | `isoCode` field missing from DB crashed `/api/countries` | Migration added, service returns it |
| 2 | `countries.controller` double-destructured `_count` after service already flattened it | Controller simplified to pass through directly |
| 3 | `AdminLoginPage` wrong-role error never showed | Local `wrongRoleErr` state instead of `mutation.reset()` pattern |
| 4 | `PartnerLoginPage` showed form forever to authenticated students | All authenticated users redirected via `homePathFor(role)` |
| 5 | `reports/admin-stats` had double `requireRole` | Simplified to single `requireRole('ADMIN','SUPER_ADMIN')` |
| 6 | `notifications` routes were open to STUDENT | Added `partnerAuth` restriction |
| 7 | `STAGE_COLOR` used `bg` key instead of `background` | Fixed CSS property name |
| 8 | `institutionCount` was undefined everywhere | Service flattens `_count.institutions` → `institutionCount` |
| 9 | Admin course edit modal: institution picker empty on load | `useEffect` re-runs match when `institutions` array arrives |
| 10 | Student program browser fired API on every keypress | Added `useDebounced(350ms)` hook |
| 11 | `StudentProfile` used render-time setState | Fixed to `useEffect` pattern |

---

## Phase 7 — Agency branding

### Backend
- `AgencyProfile` model: `agencyName`, `logoUrl`, `website`, `accentColor`
- `GET /api/agency` — get resolved profile (sub-agents inherit parent's)
- `PUT /api/agency` — upsert (top-level agents only, enforced via DB lookup)
- `DELETE /api/agency` — reset to NV branding
- `POST /api/agency/logo` — multipart logo upload (local disk or S3)
- `agencyProfile` returned in login, refresh, and `/me` responses

### Frontend
- `LogoCropper` component: canvas drag-to-move, corner-resize, live preview at 64/40/28px
- `extractDominantColorFromData()` — samples cropped image pixels, buckets by hue, returns most vibrant hex
- Color auto-detected from logo on crop; agent can override
- `useTheme.js` — derives full `--accent-800` through `--accent-50` scale from one hex using HSL math
- `applyTheme(hex)` / `resetTheme()` — sets/removes CSS vars on `:root`
- Theme applied on `setSession`, `bootstrap`, `setAgencyProfile` — zero flash on reload
- Theme reset on `logout`

---

## Phase 8 — Profile management (all roles)

### Backend
- `User`: added `phone`, `bio`, `avatarUrl`, `isActive` fields via migration
- `GET /api/profile` — any authenticated user
- `PUT /api/profile` — update name, phone, bio, avatarUrl
- `POST /api/profile/password` — change password (validates current, revokes all sessions)
- `POST /api/profile/avatar` — upload avatar (local disk or S3, removes old local file)
- Login blocked for `isActive: false` users

### Frontend — `ProfilePage` (shared across all roles)
- Avatar upload with `LogoCropper` crop UI
- Name, phone, bio fields
- Email shown read-only
- Change password with strength meter (5-level: Weak/Fair/Good/Strong)
- Student-only section: nationality, DOB, passport, address
- Account info: role badge, join date, active status
- Quick links: agents → Agency Settings, admins → Admin Panel, students → My Applications
- Available at `/partner/profile`, `/admin/profile`, `/profile`

### Header avatar dropdown (all portals)
Replaced the minimal "Log out" dropdown with a proper menu:
- User avatar (image if set, initials fallback)
- Name, email, role badge
- My profile link
- Agency settings (agents only)
- Admin panel (admins only)
- My applications (students only)
- Sign out (navigates to the correct login page for the user's portal)
- Closes on click-outside

---

## Phase 9 — Student portal search fixes

| Fix | Detail |
|---|---|
| HTML entities in JSX | `&rsquo;` → real apostrophes in program level labels |
| No debounce on search | 350ms debounce prevents API call per keypress |
| No flag emoji in country dropdown | Added `{c.flagEmoji}` + institution count to options |
| No active filter indicators | Active filter pill chips with × clear buttons |
| No "clear all" on empty state | Button added when filters are applied and results are 0 |
| No loading skeleton | Skeleton pulse animation during initial load |
| No stage filter on My Applications | Stage chip filter row added |
| No pagination on My Applications | `<Pagination>` with 10 per page |
| `isFetching` indicator missing | "updating…" text shown during background refetch |

---

## Database migration history

| # | Migration | What it added |
|---|---|---|
| 1 | `20260803033157_new` | Initial schema |
| 2 | `20260803170000_add_refresh_tokens` | RefreshToken table |
| 3 | `20260803190000_refresh_token_revoke_reason` | revokedReason enum |
| 4 | `20260804090000_data_model_overhaul` | Full schema overhaul |
| 5 | `20260806120000_program_api_overhaul` | Program API shape (slug, programLevel, CourseIntake) |
| 6 | `20260806200000_add_student_role` | STUDENT role, StudentProfile table |
| 7 | `20260806210000_add_country_isocode` | Country.isoCode |
| 8 | `20260815120000_add_agency_profile` | AgencyProfile table |
| 9 | `20260815140000_add_user_profile_fields` | User.phone, bio, avatarUrl |
| 10 | `20260810100000_add_user_isactive` | User.isActive |
| 11 | `20260815160000_agency_accent_color` | AgencyProfile.accentColor |
| 12 | (profile fields) | User profile fields |

---

## Security summary

| Concern | How addressed |
|---|---|
| Token storage | Access token in memory, refresh in httpOnly cookie |
| Replay attacks | ROTATED token replayed → all sessions revoked |
| Role escalation | Public register hard-codes AGENT; staff creation behind SUPER_ADMIN |
| Cross-portal data | Students blocked from partner endpoints; partners from student endpoints |
| Session bleed | `queryClient.clear()` on every session boundary |
| Account takeover | Password change revokes all other sessions immediately |
| Deactivated accounts | `isActive: false` blocks login and immediately revokes all sessions |
| CORS | Allow-list driven; misconfigured origins fail closed |
| Rate limiting | Applied to `/api/auth/*` |

---

## What is NOT yet built

| Feature | Notes |
|---|---|
| Email verification | Students register without email verification |
| Password reset flow | No "forgot password" — admin must create new account |
| Real-time notifications | Polling only, no WebSocket |
| E2E test suite | Manual API verification only |
| S3 file upload (tested) | Code is complete; needs real credentials to test |
| Admin analytics | Beyond the 6 stat cards, no charts or trends |
| Application messaging | Help & Support contacts exist; no in-app thread |
