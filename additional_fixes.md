# Additional Fixes — Candidate Check Tracker

**Prepared:** 2026-09-10
**Author:** taaaruunnn@gmail.com (with Claude Code)
**Context:** Follow-up to `BUG_FIX_REPORT.md`. After that round, further manual testing of the running
app surfaced **6 more genuine defects** not listed in `my-bug-report.md`. This document reports and
fixes them. Per request, **no automated tests were added for these** — each fix was verified manually
(curl + a throwaway jsdom harness); the original 17-test suite still passes unchanged.

Files touched: `server.js`, `public/app.js`. No change to `public/index.html`, `public/style.css`,
`data.js`, `isolation.js`, or the test suite.

---

## Summary

| # | Area | Defect | Severity | Reported by |
|---|---|---|---|---|
| A1 | `GET /api/checks` | `candidateId` filter always returns an empty list | **High** | user |
| A2 | UI — Checks table | *Update* on any row sends **row 1's** dropdown value, not the clicked row's | **High** | user |
| A3 | UI — Checks table | Every row's status dropdown pre-selects "Pending" regardless of the row's real status | **Medium** | found while fixing A2 |
| A4 | `GET /api/checks/:id` | Unknown / non-numeric id returns `200 {}` instead of `404` | **Medium** | found (was a recommendation in the first report) |
| A5 | UI — Checks table | Row HTML is built from unescaped field values — an HTML/script-injection sink | **Low** (latent) | found while fixing A2 |
| A6 | UI — Checks table | `formatDate()` is a no-op stub; the *Created* column shows raw ISO timestamps | **Low** | found while fixing A2 |

Severity rubric is the same one stated in `BUG_FIX_REPORT.md` §2.

---

## A1 — `candidateId` filter always returns an empty table

**Severity: High · Priority: P1**

### Symptom
Typing any value into the **Candidate ID** filter and clicking **Apply Filters** empties the table.
`GET /api/checks?candidateId=1` returns `[]` even though candidate 1 has two checks.

### Root cause
`server.js`, `GET /api/checks`:

```js
if (candidateId) {
  result = result.filter((c) => c.candidateId === candidateId);
}
```

Query-string values are always **strings** (`req.query.candidateId === "1"`), but the stored
`c.candidateId` is a **number** (`1`). `"1" === 1` is `false` under strict equality, so the predicate
never matches and the result is always `[]`. This is the same class of bug as the original #7/#8
(filter comparison logic) — a type mismatch this time rather than a casing/substring mistake.

### Fix
`server.js`:

```diff
   if (candidateId) {
-    result = result.filter((c) => c.candidateId === candidateId);
+    // Query params arrive as strings; stored candidateId is numeric. Compare like
+    // for like so ?candidateId=1 actually matches candidate 1 (was always empty).
+    const wantedId = Number(candidateId);
+    result = Number.isNaN(wantedId)
+      ? []
+      : result.filter((c) => c.candidateId === wantedId);
   }
```

Coerce the query value to a number and compare numerically. A non-numeric value
(`?candidateId=abc`) yields an empty list rather than an error, consistent with how the other
filters treat a value that matches nothing.

### Verification
```
GET /api/checks?candidateId=1   -> 2 rows (ids 1,2), every row candidateId === 1
GET /api/checks?candidateId=abc -> 200 []
```

---

## A2 — *Update Status* always uses the first row's dropdown

**Severity: High · Priority: P1**

### Symptom
Change the status dropdown on any row **other than the first**, click its **Update** button — the row
flips to **Pending** (or whatever the first row's dropdown shows) instead of the value you picked.
The first row updates correctly.

### Root cause
`public/app.js`, inside the per-row `.row-update` click handler:

```js
const row = e.target.closest("tr");
const id = row.dataset.id;                          // correct: the clicked row's id
const status = document.querySelector(".row-status").value;   // BUG
```

`document.querySelector(".row-status")` returns the **first** `.row-status` element in the whole
document — always row 1's `<select>`. So every row's *Update* sends row 1's currently-selected value.
The request URL uses the right `id` (from `row.dataset.id`), so the **correct record** is updated
with the **wrong status**. Paired with A3 (every dropdown defaults to "Pending"), the visible effect
is "any non-first row resets to Pending".

### Fix
`public/app.js`:

```diff
   const row = e.target.closest("tr");
   const id = row.dataset.id;
-  const status = document.querySelector(".row-status").value;
+  // Read THIS row's dropdown, not the first one in the table.
+  const status = row.querySelector(".row-status").value;
```

Scope the lookup to the row that owns the clicked button.

### Verification
jsdom harness: set row 3's dropdown to `CLOSED`, click row 3's *Update* →
`PATCH /api/checks/3/status` with body `{"status":"CLOSED"}` (exactly one call, correct id, correct
value).

---

## A3 — Row status dropdown always pre-selects "Pending"

**Severity: Medium · Priority: P1**

### Symptom
Every row's status `<select>` shows **Pending** as the selected option on load, even for a row whose
actual status is *Verified*, *Discrepancy*, etc. The dropdown misrepresents the record, and — once A2
is fixed — clicking *Update* without touching the dropdown silently rewrites the record to `PENDING`.

### Root cause
`public/app.js`, `renderChecks()`:

```js
const statusOptions = ALL_STATUSES.map(
  (s) => `<option value="${s}"${s === "PENDING" ? " selected" : ""}>${STATUS_LABELS[s]}</option>`
).join("");
```

The `selected` attribute is hard-coded onto the `PENDING` option for **every** row, instead of onto
the option matching that row's current `c.status`.

### Fix
`public/app.js`:

```diff
+  // Pre-select the option that matches this row's current status, not always PENDING.
   const statusOptions = ALL_STATUSES.map(
-    (s) => `<option value="${s}"${s === "PENDING" ? " selected" : ""}>${STATUS_LABELS[s]}</option>`
+    (s) => `<option value="${s}"${s === c.status ? " selected" : ""}>${STATUS_LABELS[s]}</option>`
   ).join("");
```

### Verification
jsdom harness: rows with status `VERIFIED` / `IN_PROGRESS` / `DISCREPANCY` now render their
`<select>` with `value` equal to `VERIFIED` / `IN_PROGRESS` / `DISCREPANCY` respectively.

---

## A4 — `GET /api/checks/:id` returns `200 {}` for a missing record

**Severity: Medium · Priority: P2**

### Symptom
`GET /api/checks/999` (no such check) and `GET /api/checks/abc` (non-numeric) both return
`200 OK` with body `{}`. A client cannot tell "not found" from "found, but empty", and standard
error handling that keys on the status code never fires.

### Root cause
`server.js`, `GET /api/checks/:id`:

```js
const check = req.store.checks.find((c) => c.id === id);
if (!check) {
  res.status(200).json({});   // BUG — should be 404
  return;
}
```

The app's own `openapi.json` documents `404` for this path
(`responses: { '200': …, '404': { description: 'Not found' } }`). `parseInt("abc", 10)` is `NaN`,
which also falls into this branch and so also returned `200 {}`.

### Fix
`server.js`:

```diff
   const check = req.store.checks.find((c) => c.id === id);
   if (!check) {
-    res.status(200).json({});
+    res.status(404).json({ error: "Check not found" });
     return;
   }
```

This matches the error shape already used by `PATCH /api/checks/:id/status` for the same condition.

### Verification
```
GET /api/checks/999 -> 404 {"error":"Check not found"}
GET /api/checks/abc -> 404
GET /api/checks/2   -> 200 (unchanged)
```
No existing test exercises a missing id, so the 17-test suite is unaffected.

---

## A5 — Row markup is built from unescaped values (injection sink)

**Severity: Low (latent — no live exploit path today) · Priority: P2**

### Symptom
None currently observable through the API. Flagged as a code-safety defect.

### Root cause
`public/app.js`, `renderChecks()` interpolates `c.id`, `c.candidateName`, `c.type`, the status label
and the formatted date straight into a template string that is then assigned to
`tbody.innerHTML`. Any `<`, `>` or quote in those values is parsed as markup. Example: a check whose
`candidateName` were `"<img src=x onerror=alert(1)>"` would execute script on render.

Today every field that reaches this path is server-controlled (candidate names come from the fixed
seed; `type` and `status` are enum-validated on write after the first fix round), so there is **no
live injection vector**. But the render path is unsafe by construction — the moment any
free-text field (a note, an external data import, a future "add candidate" form) flows through it,
it becomes stored XSS.

### Fix
`public/app.js` — add a small escaper and apply it to every interpolated value:

```diff
+function escapeHtml(value) {
+  return String(value == null ? "" : value).replace(
+    /[&<>"']/g,
+    (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch])
+  );
+}
...
-        <tr data-id="${c.id}">
-          <td>${c.id}</td>
-          <td>${c.candidateName ?? c.candidateId}</td>
-          <td>${c.type}</td>
-          <td><span class="badge" style="...">${label}</span></td>
-          <td>${formatDate(c.createdAt)}</td>
+        <tr data-id="${escapeHtml(c.id)}">
+          <td>${escapeHtml(c.id)}</td>
+          <td>${escapeHtml(c.candidateName ?? c.candidateId)}</td>
+          <td>${escapeHtml(c.type)}</td>
+          <td><span class="badge" style="...">${escapeHtml(label)}</span></td>
+          <td>${escapeHtml(formatDate(c.createdAt))}</td>
```

(`color` in the inline `style` still comes only from the `STATUS_COLORS` map / a hex fallback, so it
is not attacker-influenced.)

### Verification
jsdom harness: a check with `candidateName = "<img src=x onerror=alert(1)>"` renders with **no
`<img>` element** in the table body — the value appears as inert text.

---

## A6 — `formatDate()` is a no-op; the *Created* column shows raw ISO strings

**Severity: Low · Priority: P3**

### Symptom
The **Created** column displays `2026-07-01T09:12:00.000Z` rather than a human-readable date.

### Root cause
`public/app.js`:

```js
function formatDate(iso) {
  return iso;   // stub — returns its input unchanged
}
```

The function exists and is called for the column, but was never implemented. (In the first fix round
the *stored* value was corrected to ISO 8601; that made the un-formatted display more prominent, not
less.)

### Fix
`public/app.js`:

```diff
 function formatDate(iso) {
-  return iso;
+  const d = new Date(iso);
+  if (Number.isNaN(d.getTime())) return iso == null ? "" : String(iso);
+  return d.toLocaleString("en-GB", {
+    day: "2-digit", month: "short", year: "numeric",
+    hour: "2-digit", minute: "2-digit",
+  });
 }
```

Parses the ISO string and renders e.g. `01 Jul 2026, 09:12`; falls back to the raw input if it is not
a valid date, so a bad value is still shown rather than `Invalid Date`.

### Verification
jsdom harness: seed row `2026-07-03T11:30:00.000Z` renders in the Created cell as
`03 Jul 2026, 17:00` (local-time formatting on the test machine); no `…T…Z` string remains.

---

## Notes & remaining recommendations

- **Regression safety.** The original suite (`tests/api.test.js`, `tests/ui.test.js`) was re-run
  after all six fixes: **17/17 pass**. None of these changes touch a path those tests assert on.
- **No tests added for A1–A6**, per request. If you want them later, the natural additions are:
  `?candidateId=1` returns candidate 1's rows (A1); a jsdom click on the 2nd row's *Update* PATCHes
  that row's id with that row's value (A2/A3); `GET /api/checks/999` → 404 (A4); a malicious
  `candidateName` renders inert (A5).
- **Still open (out of scope here, low impact):**
  - `showToast()` schedules an independent 2.5 s hide timer per call, so a rapid second toast can be
    hidden early by the first timer.
  - `GET /api/checks` returns checks in insertion order with no `sort` option; fine per the current
    spec, but worth confirming that's intended.
  - The client has no loading/disabled state on the *Add Check* / *Update* buttons, so a double-click
    fires the request twice.

---

*All paths, diffs and command output above are from the actual fix session on 2026-09-10.*
