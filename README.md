# NV Immigration — Partner Portal

Full-stack agent/partner portal for a study-visa consultancy: course search,
applications, course inquiries, and MOI-accepted institution reference data.

## Structure

```
nv-immigration-portal/
├── backend/     Express + Prisma + PostgreSQL API
└── frontend/    React (Vite) + React Query + Zustand
```

### Why it's organized this way

- **`backend/src/modules/`** — one folder per business area (auth, courses,
  applications, ...), each with its own `service.js` (database logic),
  `controller.js` (HTTP request/response), and `routes.js` (URL wiring).
  This means: to add a feature, you touch one folder, not scattered files
  across the codebase. `courses/` is the fully-built reference — copy its
  three-file pattern for every other module.

- **`frontend/src/features/`** — same idea on the frontend. Each sidebar
  page (`courseFinder`, `applications`, ...) is a self-contained folder
  with its own components. `components/layout/` holds only the shell
  (Header, Sidebar) that's shared across every page.

- **`navConfig.js`** is the single source of truth for the sidebar menu —
  add a page there once, and both the link and the icon appear
  automatically. You never edit `Sidebar.jsx` itself to add a menu item.

- **CSS is untouched** — `frontend/src/index.css` is extracted directly
  from the polished HTML mockup you already approved. No redesign risk;
  it's the exact same styling, just serving React markup instead of
  template strings.

## Getting started

### Backend
```bash
cd backend
cp .env.example .env        # fill in your Postgres connection string
npm install
npm run prisma:migrate      # creates the tables
npm run prisma:seed         # loads placeholder course/institution data
npm run dev                 # http://localhost:4000
```

### Frontend
```bash
cd frontend
npm install
npm run dev                 # http://localhost:5173
```

The Vite dev server proxies `/api/*` to `http://localhost:4000`, so no
CORS config is needed locally.

## What's built vs. what's stubbed

| Module | Status |
|---|---|
| Auth (login/register/JWT) | ✅ Fully implemented |
| Courses (search/filter/pagination) | ✅ Fully implemented, wired to real DB |
| Institutions (list + admin CRUD + blacklist) | ✅ Fully implemented |
| Applications (create + filtered history) | ✅ Fully implemented |
| Course Inquiries (create + history) | ✅ Fully implemented |
| MOI Institutions (filtered list) | ✅ Fully implemented |
| Notifications (derived from live data) | ✅ Fully implemented |
| Dashboard / CourseFinder UI | ✅ Fully implemented, fetches from the API |
| Ask our team / Course Inquiry History UI | ✅ Fully implemented |
| Add new application / Application History UI | ✅ Fully implemented |
| MOI Accepted UI | ✅ Fully implemented |
| Admin panel (institution/course CRUD UI, bulk import) | 🟡 Institution + course CRUD UI done — CSV bulk import still backend-only (`POST /api/courses/bulk-import` exists, no upload UI yet) |
| Commission, Entry Requirements, Document Bank, Report | ⬜ Not started (no UI mockup yet either) |
| Role-based route guards on the frontend | ✅ Fully implemented — `ProtectedRoute` supports `allowedRoles`, Admin sidebar section only renders for Admin/Super Admin |

## Try it end to end

```bash
# backend
cd backend && npm install && npm run prisma:migrate && npm run prisma:seed && npm run dev

# frontend (separate terminal)
cd frontend && npm install && npm run dev
```

Then go to `http://localhost:5173` — you'll land on **/login**. Sign in with
**agent@example.com / password123** to see the agent-facing pages, or
**admin@example.com / password123** to additionally see the **Admin**
section in the sidebar (Institutions, Courses) — try logging in as the
agent account and navigating to `/admin/institutions` directly in the URL
bar to confirm the redirect-to-dashboard actually works.

## Next steps, in order

1. Build a CSV upload UI for the bulk-import endpoint that already exists
   (`POST /api/courses/bulk-import`) — parse client-side with PapaParse,
   POST the resulting rows.
2. Harden the token storage before deploying anywhere real — see the
   security note at the top of `store/useAuth.js` (currently localStorage,
   which is simple but has an XSS exposure; httpOnly refresh cookie is the
   stronger pattern).
3. Design and build Commission, Entry Requirements, and Document Bank —
   no HTML mockup exists yet for these, unlike everything else here.
4. Design and build Commission, Entry Requirements, and Document Bank —
   no HTML mockup exists yet for these, unlike everything else here.
