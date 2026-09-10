# Candidate Check Tracker

A small **Background Verification (BGV) check tracker**: an Express JSON API plus a
static vanilla-JS frontend for listing candidates' checks, filtering them, adding
new checks, and updating a check's status.

This repository is a **QA / bug-fix exercise** (Springworks hackathon). The starter
app shipped with a set of confirmed defects; this repo contains the app with those
defects **reproduced by automated tests, root-caused, and fixed**, plus a second
round of bugs found during follow-up testing.

- [`BUG_FIX_REPORT.md`](./BUG_FIX_REPORT.md) — the 12 bugs from `my-bug-report.md`: a
  failing regression test per bug, root-cause analysis, the fix, and test evidence.
- [`additional_fixes.md`](./additional_fixes.md) — 6 further genuine bugs found after
  the first round (candidate-id filter, per-row status update, `404` handling,
  output escaping, date formatting), fixed and manually verified.

---

## Requirements

- Node.js 18+ (developed on v24)
- npm

## Setup

```bash
npm install
```

## Run

```bash
npm start
```

Then open **http://localhost:3001**. Set `PORT` to use a different port:

```bash
PORT=4000 npm start
```

## Test

```bash
npm test
```

Runs the Jest suite (`tests/`): **17 tests across 2 suites** —
`tests/api.test.js` (Supertest against the Express app, bugs 1–9) and
`tests/ui.test.js` (jsdom exercising the real client code, bugs 10–12).

---

## API

Base URL `http://localhost:3001`. Full schema at `GET /openapi.json`; a rendered
spec page at `GET /spec`.

| Method & path | Description |
|---|---|
| `GET /api/checks` | List checks. Optional query: `status`, `type`, `candidateId`. |
| `GET /api/checks/:id` | Get one check. `404` if not found. |
| `POST /api/checks` | Create a check. Body: `{ "candidateId": <int>, "type": <enum> }`. `201` on success, `400` on validation error. |
| `PATCH /api/checks/:id/status` | Update a check's status. Body: `{ "status": <enum> }`. `400` invalid status, `404` unknown id. |
| `POST /api/reset` | Reset the in-memory data to seed (dev/demo helper). |

**Enums**

- `status`: `PENDING`, `IN_PROGRESS`, `VERIFIED`, `DISCREPANCY`, `INSUFFICIENCY`, `CLOSED`
- `type`: `IDENTITY`, `EDUCATION`, `EMPLOYMENT`, `ADDRESS`

Notes:
- The `status` filter is **case-insensitive**; the `type` filter is an **exact** enum match.
- Data is held **in memory per browser session** (a `sid` cookie), seeded from
  `data.js`. Restarting the server or calling `POST /api/reset` restores the seed.

---

## Project structure

```
server.js            Express app: routes, validation, static file serving
data.js              Seed candidates + checks
isolation.js         Per-session in-memory store middleware
public/
  index.html         UI markup
  app.js             UI logic (filters, table render, add/update)
  style.css          Styles
  report-widget.js   Exercise tooling (not part of the app under test)
tests/
  api.test.js        API regression tests (bugs 1–9)
  ui.test.js         UI regression tests (bugs 10–12)
BUG_FIX_REPORT.md    Full write-up of the 12 original bugs
additional_fixes.md  Write-up of 6 further bugs found and fixed
```

## Scripts

| Command | Does |
|---|---|
| `npm start` | Start the server on `PORT` (default 3001). |
| `npm test` | Run the Jest regression suite. |
