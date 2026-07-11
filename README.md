# GrowEasy CSV Importer

An AI-powered CSV importer that intelligently maps CRM lead data from **any** CSV
layout (Facebook Lead Ads, Google Ads exports, Excel sheets, real-estate CRM
exports, manually created spreadsheets, etc.) into GrowEasy's fixed CRM schema.

Built for the GrowEasy Software Developer assignment.

## How it works

1. **Upload** — drag & drop or browse for a `.csv` file.
2. **Preview** — the file is parsed client-side and shown in a scrollable,
   sticky-header table. No AI runs yet.
3. **Confirm Import** — only on confirmation does the frontend call the
   backend API.
4. **AI Mapping** — the backend batches the raw rows and sends each batch to
   an LLM with a carefully engineered prompt that maps arbitrary columns into
   the GrowEasy CRM schema, following all business rules (allowed status
   values, allowed data sources, multi-email/phone handling, skip logic for
   rows with no email/phone, etc.).
5. **Results** — the frontend shows imported records, skipped records (with
   reasons), and total counts.

## Tech stack

- **Framework:** Next.js 14 (App Router) — used for both frontend and the
  backend API (via Next.js Route Handlers, which run on Node.js). This keeps
  the whole app in one deployable unit; a separate Express server was not
  needed since Next.js Route Handlers are also a full Node.js backend.
- **CSV parsing:** PapaParse
- **Styling:** Tailwind CSS
- **AI:** Anthropic Claude by default (configurable to OpenAI)

## Project structure

```
app/
  page.tsx                    # Main 4-step UI flow
  layout.tsx
  globals.css
  api/
    process-leads/route.ts    # Backend API — batches rows, calls AI, returns JSON
components/
  UploadDropzone.tsx           # Drag & drop upload
  DataTable.tsx                 # Reusable sticky-header scrollable table
lib/
  types.ts                     # Shared CRM schema + constants
  aiMapper.ts                  # Prompt engineering + batching + retry logic
sample-data/
  messy-facebook-export.csv    # Example CSV with a non-standard layout, for testing
```

## Setup & local development

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy `.env.example` to `.env.local` and fill in your AI provider's API key:

```bash
cp .env.example .env.local
```

```env
ANTHROPIC_API_KEY=your_key_here
AI_PROVIDER=anthropic
AI_BATCH_SIZE=20
```

To use OpenAI instead, set `AI_PROVIDER=openai` and `OPENAI_API_KEY=...`.

### 3. Run the dev server

```bash
npm run dev
```

Visit `http://localhost:3000`.

### 4. Test it

Upload `sample-data/messy-facebook-export.csv` — it uses deliberately
non-standard column names (`Full Name`, `Contact Email`, `Phone No.`, `Town`,
`Remarks`, `Status Notes`, etc.) to exercise the AI mapping, including:
- a row with no email/phone (should be skipped)
- a row with two emails (should merge into `crm_note`)
- rows implying different `crm_status` values from free-text remarks

## API

### `POST /api/process-leads`

**Request body:**
```json
{ "rows": [ { "Full Name": "Amit Sharma", "Contact Email": "...", ... }, ... ] }
```

**Response body:**
```json
{
  "imported": [ { "created_at": "...", "name": "...", "...": "..." } ],
  "skipped": [ { "row": { ... }, "reason": "No email or mobile number found" } ],
  "totalImported": 4,
  "totalSkipped": 1,
  "totalReceived": 5
}
```

## Deployment (Vercel)

1. Push this repo to GitHub.
2. Go to [vercel.com](https://vercel.com) → New Project → import the repo.
3. Add environment variables in the Vercel dashboard (Project Settings →
   Environment Variables): `ANTHROPIC_API_KEY` (or `OPENAI_API_KEY`),
   `AI_PROVIDER`, `AI_BATCH_SIZE`.
4. Deploy. Vercel auto-detects Next.js — no extra config needed.

## Design notes / assumptions

- **Single Next.js app instead of separate Express backend:** Next.js Route
  Handlers are genuine Node.js backend code (not client-side), satisfying the
  "Node.js backend" requirement while keeping deployment to a single Vercel
  project. This can be split into a standalone Express service if preferred —
  the logic in `lib/aiMapper.ts` is framework-agnostic and would drop into an
  Express route unchanged.
- **Batching:** rows are sent to the AI in batches of `AI_BATCH_SIZE` (default
  20) to stay within model context/rate limits and to keep partial failures
  isolated to a single batch.
- **Retry:** each batch is retried up to 2 times on failure before its rows
  are marked as skipped with an error reason, so one bad batch never crashes
  the whole import.
- **Validation:** max file size 5MB, max 5000 rows per import (adjustable in
  `app/api/process-leads/route.ts`).
- **Data cleaning:** all AI output is sanitized server-side — `crm_status`
  and `data_source` are hard-validated against the allowed enum values before
  being returned, so the AI can never leak an invalid value to the client.

## Possible improvements (not implemented, noted for transparency)

- Streaming/incremental progress updates per batch (currently a single
  loading state covers the whole AI call).
- Virtualized table rendering for very large result sets.
- Persisting imports to a database (kept stateless per assignment's optional
  database note).
- Unit tests for `aiMapper.ts` sanitization logic.
