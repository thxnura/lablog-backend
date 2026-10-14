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
| POST | `/api/sync` | ✓ | idempotent batch upsert of local records |
| GET | `/api/records?experimentId=` | ✓ | lecturer view of submitted records |
| POST | `/api/attachments/sign` | ✓ | signed Storage upload URL for a photo |

## Setup

1. Create a Supabase project. In the SQL editor run `db/schema.sql` then `db/seed.sql`.
   A database created before the step guides were added also needs
   `db/migrations/002_step_guides.sql` (run it before re-running the seed).
2. Create a private Storage bucket named `evidence` (Storage → New bucket).
3. `cp .env.example .env` and fill in the URL + keys (Settings → API).
4. `npm install`
5. `npm run dev` → http://localhost:3000/api/health

## Scripts

- `npm run dev` — watch mode (tsx)
- `npm run build` — compile to `dist/`
- `npm start` — run compiled server
- `npm run typecheck` — types only

## Sync contract

`POST /api/sync` accepts `{ records: [...] }` where each record carries its
`stepCompletions`, `observations`, and `attachment` metadata. All ids are
client-generated UUIDs, so retries are idempotent. The response returns
`{ results: [{ id, status: 'synced' | 'failed' }] }` so the app marks each local
record accordingly. See `src/dto/sync.dto.ts` for the full schema.
