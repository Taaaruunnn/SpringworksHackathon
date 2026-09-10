# My bug report — 01

You reported 12 confirmed bugs. For Phase 2, write an automated test that FAILS because of each one — fixing them is an optional bonus.

## 1. GET /api/checks/:id — leaks-hidden-field

Issue: GET /api/checks/:id returns an internalReviewNotes field not in the documented response shape
Expected vs actual: Expected: only id, candidateId, candidateName, type, status, createdAt. Actual: also includes "internalReviewNotes": "".

## 2. POST /api/checks — missing-reference-or-state-check

Issue: candidateId is not checked against existing candidates before a check is created
Expected vs actual: Expected: candidateId 9999/7 (nonexistent) → 400, nothing created. Actual: 200, check created with candidateName: null.

## 3. POST /api/checks — wrong-persisted-default

Issue: New checks are persisted with status "pending" (lowercase) instead of the uppercase enum value used everywhere else
Expected vs actual: Expected: "status": "PENDING". Actual: "status": "pending".

## 4. POST /api/checks — wrong-date-time-handling

Issue: createdAt is stored/returned as a non-ISO string instead of ISO 8601.
Expected vs actual: Expected: ISO 8601, e.g. "2026-07-01T09:12:00.000Z". Actual: "Thu Sep 10 2026"

## 5. PATCH /api/checks/:id/status — missing-enum-validation

Issue: Status update endpoint does not validate the status value against the allowed enum before persisting it.
Expected vs actual: Expected: "NOT_REAL" → 400, record unchanged. Actual: 200, status field overwritten to "NOT_REAL".

## 6. POST /api/checks — wrong-status-code

Issue: Successful check creation returns 200 instead of the documented 201.
Expected vs actual: Expected: 201 Created. Actual: 200 OK (confirmed on a fully valid create with candidateId 2, type IDENTITY).

## 7. GET /api/checks — substring-vs-exact-match

Issue: The type filter matches on substring/prefix instead of requiring an exact match against the type enum value.
Expected vs actual: Expected: ?type=EDU returns [] (spec: must be exact match, EDU ≠ EDUCATION). Actual: returns the EDUCATION row(s).

## 8. GET /api/checks — case-sensitivity-mismatch

Issue: The status filter is case-sensitive, contradicting the spec's explicit claim that it's case-insensitive
Expected vs actual: Expected: ?status=pending and ?status=PENDING return identical results. Actual: ?status=PENDING excludes a record stored as lowercase "pending", so the two queries return different result sets.

## 9. POST /api/checks — missing-enum-validation

Issue: The type field is not validated against the allowed enum (IDENTITY, EDUCATION, EMPLOYMENT, ADDRESS) before creating a check.
Expected vs actual: Expected: type: "INVALID_TYPE" → 400, nothing created. Actual: 200, check created with type stored as "INVALID_TYPE".

## 10. UI — wrong-dropdown-default-selection

Issue: The Type filter dropdown defaults to "Identity" on page load instead of "All Types" as specified
Expected vs actual: Expected: Type dropdown shows "All Types" by default. Actual: shows "Identity" selected by default.

## 11. UI — wrong-status-badge-color

Issue: The Discrepancy status badge is rendered green (same color as Verified) instead of red as specified.
Expected vs actual: Expected: Discrepancy badge = red. Actual: Discrepancy badge = green, visually identical to Verified.

## 12. UI — missing-ui-feedback-guard

Issue: Failed Add Check / Update Status requests (network failure) are not caught, resulting in an unhandled promise rejection and no user-facing error message.
Expected vs actual: Expected: a failed request shows an error message to the user. Actual: fails silently — console shows "Uncaught (in promise) TypeError: Failed to fetch", nothing displayed on screen.

