# LabLog Backend

Custom backend for **LabLog — Digital Practical Lab Book** (SE5070 Enterprise Mobility).
Express + TypeScript REST API fronting **Supabase** (Postgres + Storage + Auth).

## Architecture

```
routes/ → controllers/ → services/ → repositories/ → Supabase
          (req/res)       (rules)     (data access)
middleware/  auth (JWT verify) · validate (zod) · errorHandler
dto/         zod schemas = request contracts
config/      env + supabase client factory
```

The iOS app authenticates **directly with Supabase Auth** to obtain a JWT, then
calls this API with `Authorization: Bearer <jwt>`. This service verifies the
token (`requireAuth`) and scopes writes to the authenticated student.

## Endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/health` | – | liveness check |
| GET | `/api/labs` | ✓ | list labs |
| GET | `/api/labs/:labId/experiments` | ✓ | experiments in a lab |
| GET | `/api/experiments/:id` | ✓ | experiment + steps (cached offline) |
| POST | `/api/sync` | ✓ | idempotent batch upsert of local records; `deleted: true` deletes a draft (tombstone); photos missing from a record's set are removed |
| GET | `/api/records?experimentId=` | lecturer | submitted records + student email + signed photo URLs |
| POST | `/api/attachments/sign` | ✓ | signed Storage upload URL for a photo |

## Setup

1. Create a Supabase project. In the SQL editor run `db/schema.sql` then `db/seed.sql`.
   A database created before the step guides were added also needs
   `db/migrations/002_step_guides.sql` (run it before re-running the seed).
2. Create a private Storage bucket named `evidence` (Storage → New bucket).
3. `cp .env.example .env` and fill in the URL + keys (Settings → API).
4. `npm install`
5. `npm run dev` → http://localhost:3100/api/health

## Local stack (no hosted project needed)

Requires Docker and the Supabase CLI.

```sh
supabase start -x realtime,imgproxy,mailpit,postgres-meta,studio,edge-runtime,logflare,vector,supavisor
npm run local:setup                         # .env + demo users (simulator: 127.0.0.1)
npm run local:setup -- --host 192.168.1.8   # same, reachable from an iPhone on the LAN
npm run dev                                 # API on :3100 (3000 clashes with other dev servers)
npm run test:e2e                            # 14 HTTP tests against the real stack
```

`supabase/` applies `db/schema.sql` as its migration and `db/seed.sql` as the seed, so
`db/` stays the source of truth. The setup script prints the iOS `Config/Secrets.xcconfig`.

**Changing networks.** `.env` uses loopback (`127.0.0.1:54321`). Signed upload and photo URLs are
rewritten to whatever host the app called (`src/services/client-url.ts`), but only for a local or
private-network Supabase. So when the Mac's IP changes (a new Wi-Fi, or the iPhone's hotspot at a
demo), nothing on the Mac needs re-running. Set the new address in the app under Sync → Server.

Demo accounts (local only): `student@lablog.test` / `LabLog-Student-1`,
`student2@lablog.test` / `LabLog-Student-2`, `lecturer@lablog.test` / `LabLog-Lecturer-1`.
The role lives in `app_metadata.role`, which only the service role can set.

## Security rules

- Every route except `/api/health` needs a Supabase JWT (`requireAuth`).
- `/api/records` is lecturer-only (`requireRole('lecturer')`).
- Sync refuses a record id owned by another student (403) and child ids that belong to
  another record (409), so client-generated UUIDs can't be used to hijack data.

## Scripts

- `npm run dev` — watch mode (tsx)
- `npm run build` — compile to `dist/`
- `npm start` — run compiled server
- `npm run typecheck` — types only
- `npm run local:setup` — local `.env` + demo users (see above)
- `npm run test:e2e` — end-to-end tests against the local stack

## Sync contract

`POST /api/sync` accepts `{ records: [...] }` where each record carries its
`stepCompletions`, `observations`, and `attachment` metadata. All ids are
client-generated UUIDs, so retries are idempotent. The response returns
`{ results: [{ id, status: 'synced' | 'failed' }] }` so the app marks each local
record accordingly. See `src/dto/sync.dto.ts` for the full schema.
