# EduTrack CRM

A complete, responsive training-institute CRM built with React + Vite, Express, Lucide icons, Recharts, and an optional PostgreSQL data layer. The interface uses an original red education/infinity mark and the brand name **EduTrack CRM**; it does not reuse any existing company's branding.

> The source repository did not contain the reference screenshot file, so the implementation follows the supplied visual specification: a white/black SaaS shell, 255px fixed sidebar, subtle borders, 12–16px radii, compact icons, restrained red accent, and spacious metric cards.

## Quick start

```bash
npm install
npm run dev
```

Open the Vite app preview on port `3002`. `npm run dev` starts:

- React/Vite app preview on `0.0.0.0:3002`
- Express API on `0.0.0.0:3001`, proxied through the app at `/api`

The app starts in **Local demo mode** unless a PostgreSQL database is configured. All demo data and dashboard preferences persist in this browser via `localStorage`.

### Demo sign-in

All demo accounts use: `Demo@12345`

| Role | Email | Access |
| --- | --- | --- |
| Admin | `admin@edutrack.demo` | Full CRUD and settings |
| Trainer | `aarav@edutrack.demo` | Assigned batches and own tasks |
| Read-Only | `viewer@edutrack.demo` | View records only |

Demo credentials are stored as salted PBKDF2-SHA256 derivatives, never plaintext. Browser demo mode is clearly labeled and is **not** production authentication.

## Optional PostgreSQL / Supabase mode

EduTrack ships with a real Express REST API and a relational PostgreSQL schema. A Supabase project's Postgres connection string can be used as `DATABASE_URL`.

1. Copy the sample environment file:

   ```bash
   cp .env.example .env
   ```

2. Set these values in `.env`:

   ```env
   DATABASE_URL=postgresql://user:password@host:5432/database
   JWT_SECRET=a-long-random-server-only-secret
   ```

3. Create the schema and seed the demo institute:

   ```bash
   npm run db:init
   ```

4. Restart `npm run dev`. `/api/health` now reports `mode: "database"`, and the frontend switches from localStorage to REST APIs automatically.

When a database is connected:

- Passwords are verified against PBKDF2 demo hashes or bcrypt hashes. New/updated passwords use bcrypt (cost 12).
- Sessions are signed JWTs in an `HttpOnly`, `SameSite=Lax` cookie. The token is never exposed to frontend JavaScript.
- Express re-reads the user from the database on every request and enforces role and record-scope authorization on every mutation.
- Read-Only users cannot write. Trainers can only edit students, attendance, assessments/results, tasks, trainer tasks, groups, and syllabi within their assigned batches or ownership. Admins can manage all records and users.
- The React client uses the same permission helper to hide controls, but the server is the authoritative check.
- Login attempts are rate-limited in memory. For horizontally scaled production, replace this with a shared store such as Redis.

If `DATABASE_URL` is missing, unreachable, or the schema has not been initialized, the header and Settings page explicitly identify local demo mode. The app never claims an unavailable database is connected.

## Database schema

`server/schema.sql` creates normalized tables and relationships for:

- `institutes`, `users`, `user_preferences`, `audit_logs`
- `batches` → assigned trainer (`users`)
- `students` → batch
- `attendance` → student + batch, with a unique `(student_id, batch_id, date)` constraint
- `assessments` → batch
- `assessment_results` → assessment + student, unique per pair
- `tasks`, `trainer_tasks` → trainer/batch
- `student_groups`, `group_members` → students
- `syllabi`, `syllabus_batch_assignments`, `syllabus_modules`, `syllabus_topics`
- `report_snapshots` for generated report metadata

Foreign keys use cascade/set-null rules, and indexed date/status columns support report queries.

## Project structure

```text
src/
  components/
    EntityPage.jsx         # reusable CRUD table, forms, filters, details, exports
    layout/                # persistent sidebar, header, shell
    ui/                    # buttons, cards, modals, tables, fields, toasts, etc.
  config/navigation.js     # single source for all sidebar routes and page icons
  context/AppContext.jsx   # auth, mode detection, state, persistence, mutations
  data/seed.js             # realistic, clearly labeled sample records
  lib/                     # utilities, metrics, permissions, password derivation
  pages/                   # dashboard + all 11 modules + login
  services/                # REST client and browser storage adapter
  styles/global.css        # full design system, responsive layout, dark mode
server/
  db.js                    # PostgreSQL pool and health check
  index.js                 # Express REST API, auth, RBAC, validation
  init-db.js               # schema + seed runner
  password.js              # bcrypt/PBKDF2 password helpers
  schema.sql               # relational schema
  store.js                 # SQL persistence and state reconstruction
  stateOps.js              # pure mutation helper for transaction authorization
```

## Implemented modules

- **Dashboard:** live KPI cards, add/remove metric modal, drag-to-reorder, persisted preferences, recent admissions, attendance summary, upcoming assessments, pending tasks, batch distribution and admissions charts.
- **Batches:** search, sort, filters, pagination, CRUD, detail drawer with students, trainer, attendance, syllabus and schedule.
- **Students:** validated CRUD, duplicate checks, profiles with attendance, assessment results and learning assignments, filters and CSV export.
- **Attendance:** batch/date register, four statuses, mark-all-present, duplicate-safe edits, daily/monthly history filters, KPIs and CSV export.
- **Assessments:** CRUD, configurable pass score, mark entry with automatic percentage/pass-fail, results table, batch/assessment filters and CSV export.
- **Tasks:** priorities, owners, due dates, filters, table and drag/drop Kanban, overdue highlighting.
- **Trainer Tasks:** syllabus completion, lesson prep, assignment evaluation, attendance submission and project review tracking with owners, progress and deadlines.
- **Groups:** batch/project association, trainers, leaders, duplicate-safe memberships and member views.
- **Syllabi:** arbitrary courses, editable modules/topics, completion toggles with dates and overall progress. The seeded DevOps example has all ten requested modules.
- **Reports:** admissions, enrollment, batch performance, daily/monthly attendance, assessment performance, task completion and syllabus completion, with date filters, KPIs, live charts and CSV downloads.
- **Settings:** institute/user profiles, user management, role matrix, theme, dashboard/application preferences, data export and demo reset.

## Verification

```bash
npm run build
npm test
npm run dev
```

Production build succeeds with Vite 7. The jsdom smoke suite signs in, visits every sidebar route, creates and persists a batch, changes the demo password, verifies logout, and checks for unfiltered console errors. The dev server exposes a live app preview on port `3002`; the API health endpoint is available at `/api/health` through the proxy.
