# LabLog — Backend

The REST API behind **LabLog — Digital Practical Lab Book**, an offline-first iPhone app for
university practicals. Express + TypeScript in front of **Supabase** (Postgres, Auth, Storage).

| | |
|---|---|
| **Module** | SE5070 Enterprise Mobility · MSc in IT (Enterprise Application Development), 2026 |
| **Student** | Thanura Manjitha Peiris · MS26928210 |
| **iOS app, report and documentation** | [github.com/thxnura/lablog-ios](https://github.com/thxnura/lablog-ios) (the report is in `docs/LabLog-Report.pdf`) |

## What it does

- Serves the **lab catalog**: labs, experiments, and each experiment's step graph (prerequisites,
  photo and timer guards, step guides). The app caches it for offline use.
- Accepts the app's **offline outbox** in one idempotent call, `POST /api/sync`. Records, step
  completions (with notes), observations and photo metadata are upserted by client-generated UUIDs,
  with a result per record.
- Issues **signed upload URLs** so photos go straight to a private Storage bucket.
- Gives **lecturers** the submitted records for an experiment, with student emails and signed
  photo links.
- Enforces the rules server-side: JWT on every route, lecturer-only reads, ownership checks
  against record hijacking, zod validation, and only drafts can be deleted (submitted records can't).

## Architecture

```
src/
  routes/        one router per resource
  controllers/   HTTP in and out, no business logic
  services/      business rules (sync, catalog mapping, storage URLs)
  repositories/  Supabase data access only
  middleware/    auth (JWT, roles), validate (zod), errorHandler
  dto/           zod schemas: the request contracts
  config/        environment and Supabase clients
db/              schema.sql, seed.sql, migrations/   (the source of truth)
supabase/        local stack config (applies db/ as migration and seed)
scripts/         local setup and demo users
test/            end-to-end tests against the real stack
```

The app signs in with **Supabase Auth** directly and sends the JWT as `Authorization: Bearer <jwt>`.
`requireAuth` verifies it; the user's role comes from `app_metadata.role`, which only the service
role can set.

## Endpoints

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/api/health` | public | Liveness check |
| GET | `/api/labs` | signed in | Labs: lecturers see all; a student sees the open course labs and the labs they're enrolled in |
| GET | `/api/labs/:labId/experiments` | signed in | Experiments in a lab |
| GET | `/api/experiments/:id` | signed in | An experiment with its steps and guides |
| POST | `/api/attachments/sign` | signed in | Signed Storage upload URL for a photo (deterministic path; retries overwrite) |
| POST | `/api/sync` | signed in | Batch upsert of records (≤ 100) with a result per record. `deleted: true` deletes a draft (tombstone); photos missing from a record's set are removed |
| GET | `/api/records/mine` | signed in | The student's own records (drafts and submitted) with signed photo URLs, so the app can restore a phone after sign-in |
| GET | `/api/records?experimentId=` | lecturer | Submitted records with student email and 1-hour signed photo URLs |
| GET | `/api/manage/labs` | lecturer | Every lab with its experiment count and enrolled students |
| POST | `/api/manage/labs` | lecturer | Create a lab (`code`, `name`); 409 if the code exists |
| POST | `/api/manage/labs/:labId/experiments` | lecturer | Create an experiment with its steps (photo, wait time, prerequisites by step number); the step graph is checked with Kahn's algorithm, 422 on a loop |
| PUT | `/api/manage/experiments/:experimentId` | lecturer | Edit an experiment and its steps in place: steps keep their ids, new steps are added, and a step with students' work can't be removed (409) |
| PUT | `/api/manage/labs/:labId/students` | lecturer | Choose exactly which students can do a lab |
| GET | `/api/manage/students` | lecturer | Student accounts to choose from |

## Running it locally

**Requirements:** Node 22, Docker Desktop, and the [Supabase CLI](https://supabase.com/docs/guides/cli).

```sh
npm install
supabase start -x realtime,imgproxy,mailpit,postgres-meta,studio,edge-runtime,logflare,vector,supavisor
npm run local:setup -- --host <your Mac's LAN IP>   # writes .env, creates demo users, prints the iOS config
npm run dev                                          # API on http://localhost:3100/api/health
```

`local:setup` prints the three values for the iOS app's `Config/Secrets.xcconfig`. Use the Mac's
LAN IP for a phone; `127.0.0.1` works for the simulator.

Demo accounts (local stack only):

| Role | Email | Password |
|---|---|---|
| Student | `student@lablog.test` | `LabLog-Student-1` |
| Student | `student2@lablog.test` | `LabLog-Student-2` |
| Lecturer | `lecturer@lablog.test` | `LabLog-Lecturer-1` |

**Changing networks.** `.env` uses loopback (`127.0.0.1:54321`). Storage URLs the API hands to the
app are rewritten to whatever host the app called (`src/services/client-url.ts`), but only for a
local or private-network Supabase. So when the Mac's IP changes, nothing on the Mac needs re-running:
set the new address in the app under Sync → Server.

### Hosted: Supabase + Vercel
1. **Database.** `supabase link --project-ref <ref>`, then `supabase db push --include-seed`. This applies
   `db/schema.sql`, the seed, and `db/migrations/003_lock_down_tables.sql`, which turns on row-level
   security for every table (the anon key ships in the app; the API uses the service role) and creates
   the private `evidence` bucket.
2. **Accounts.** Create users with private passwords: the demo passwords above are for the local stack
   only, and this README is public. A lecturer needs `app_metadata.role = "lecturer"`.
3. **API.** Import the repository in Vercel. Express is detected with zero configuration (the default
   export of `src/app.ts`). Add the environment variables `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_STORAGE_BUCKET=evidence`; the API is then at
   `https://<project>.vercel.app/api/health`.

## Tests

```sh
npm run test:e2e
```

20 end-to-end tests drive the Express app over HTTP against the real local stack (Postgres, Auth,
Storage), the same way the app does:
- auth: 401 without a token;
- the catalog and step guides;
- idempotent sync and 422 validation;
- ownership: anti-hijack 403 and 409;
- signed upload with a retry;
- storage URLs following the caller's host;
- a retake replacing the stored photo;
- ids in the app's upper-case form keeping their photo;
- a student getting their own records back (and nobody else's);
- lecturers creating and editing labs and experiments, enrolment deciding who sees them, step graphs with a loop refused, and a step with students' work kept;
- draft tombstones: idempotent, drafts only, owner only;
- lecturer access: 403 for students, 200 for lecturers, with working photo URLs.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Run in watch mode (tsx) |
| `npm run build` / `npm start` | Compile to `dist/` and run it |
| `npm run typecheck` | Type-check only |
| `npm run local:setup` | Local `.env`, demo users, and the iOS config |
| `npm run test:e2e` | End-to-end tests against the local stack |

Design decisions and the failure log for the whole project live in the iOS repo's `docs/` folder
(ADR-002, 004, 005, 014, 018, 019, 021, 022 and 023 concern this service).
