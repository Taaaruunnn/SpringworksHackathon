/**
 * Regression tests for the API bugs listed in my-bug-report.md (#1-#9).
 *
 * Each `test` is written to FAIL against the original server.js and PASS once the
 * root-cause fix is applied. The spec of record is the app's own /openapi.json:
 *   - status enum: PENDING, IN_PROGRESS, VERIFIED, DISCREPANCY, INSUFFICIENCY, CLOSED
 *   - type enum:   IDENTITY, EDUCATION, EMPLOYMENT, ADDRESS
 *   - documented check shape: { id, candidateId, candidateName, type, status, createdAt }
 *   - POST /api/checks success -> 201; validation failure -> 400
 *   - PATCH /api/checks/:id/status invalid value -> 400
 */

const request = require("supertest");
const app = require("../server");

const DOCUMENTED_KEYS = ["id", "candidateId", "candidateName", "type", "status", "createdAt"];
const SEED_CHECK_COUNT = 6;
const ISO_8601 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;

// Fresh per-student store per test: a brand-new agent has no `sid` cookie, so the
// first request it makes seeds a clean copy of the demo data (see isolation.js).
let agent;
beforeEach(() => {
  agent = request.agent(app);
});

describe("Bug #1 - GET /api/checks/:id leaks internalReviewNotes", () => {
  test("single-check response contains only the documented keys", async () => {
    const res = await agent.get("/api/checks/1").expect(200);
    expect(Object.keys(res.body).sort()).toEqual([...DOCUMENTED_KEYS].sort());
    expect(res.body).not.toHaveProperty("internalReviewNotes");
  });

  test("list response objects also omit internalReviewNotes", async () => {
    const res = await agent.get("/api/checks").expect(200);
    for (const check of res.body) {
      expect(check).not.toHaveProperty("internalReviewNotes");
    }
  });
});

describe("Bug #2 - POST /api/checks does not validate candidateId against existing candidates", () => {
  test("nonexistent candidateId is rejected with 400 and nothing is created", async () => {
    await agent.get("/api/checks"); // establish session / seed
    const res = await agent
      .post("/api/checks")
      .send({ candidateId: 9999, type: "IDENTITY" });
    expect(res.status).toBe(400);

    const list = await agent.get("/api/checks").expect(200);
    expect(list.body).toHaveLength(SEED_CHECK_COUNT);
  });

  test("a valid candidateId still succeeds", async () => {
    const res = await agent
      .post("/api/checks")
      .send({ candidateId: 2, type: "IDENTITY" });
    expect(res.status).toBe(201);
    expect(res.body.candidateName).toBe("Rohan Mehta");
  });
});

describe("Bug #3 - POST /api/checks persists lowercase 'pending' instead of the PENDING enum value", () => {
  test("created check has status exactly 'PENDING'", async () => {
    const res = await agent
      .post("/api/checks")
      .send({ candidateId: 1, type: "IDENTITY" });
    expect(res.body.status).toBe("PENDING");
  });
});

describe("Bug #4 - POST /api/checks stores createdAt as a non-ISO string", () => {
  test("createdAt is ISO 8601", async () => {
    const res = await agent
      .post("/api/checks")
      .send({ candidateId: 1, type: "IDENTITY" });
    expect(res.body.createdAt).toMatch(ISO_8601);
    expect(new Date(res.body.createdAt).toISOString()).toBe(res.body.createdAt);
  });
});

describe("Bug #5 - PATCH /api/checks/:id/status does not validate the status enum", () => {
  test("an invalid status is rejected with 400 and the record is left unchanged", async () => {
    const before = await agent.get("/api/checks/4").expect(200);

    const res = await agent
      .patch("/api/checks/4/status")
      .send({ status: "NOT_REAL" });
    expect(res.status).toBe(400);

    const after = await agent.get("/api/checks/4").expect(200);
    expect(after.body.status).toBe(before.body.status);
  });

  test("a valid status transition still works", async () => {
    const res = await agent
      .patch("/api/checks/4/status")
      .send({ status: "IN_PROGRESS" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("IN_PROGRESS");
  });
});

describe("Bug #6 - POST /api/checks returns 200 instead of 201", () => {
  test("a fully valid create returns 201", async () => {
    const res = await agent
      .post("/api/checks")
      .send({ candidateId: 2, type: "IDENTITY" });
    expect(res.status).toBe(201);
  });
});

describe("Bug #7 - GET /api/checks type filter matches on substring instead of exact enum value", () => {
  test("?type=EDU returns [] because EDU is not an exact enum value", async () => {
    const res = await agent.get("/api/checks?type=EDU").expect(200);
    expect(res.body).toEqual([]);
  });

  test("?type=EDUCATION still returns the education rows", async () => {
    const res = await agent.get("/api/checks?type=EDUCATION").expect(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body.every((c) => c.type === "EDUCATION")).toBe(true);
  });
});

describe("Bug #8 - GET /api/checks status filter is case-sensitive (spec says case-insensitive)", () => {
  test("?status=pending and ?status=PENDING return identical result sets", async () => {
    const lower = await agent.get("/api/checks?status=pending").expect(200);
    const upper = await agent.get("/api/checks?status=PENDING").expect(200);
    expect(lower.body).toEqual(upper.body);
    expect(upper.body.length).toBeGreaterThan(0);
    expect(upper.body.every((c) => c.status === "PENDING")).toBe(true);
  });
});

describe("Bug #9 - POST /api/checks does not validate the type enum", () => {
  test("an invalid type is rejected with 400 and nothing is created", async () => {
    await agent.get("/api/checks");
    const res = await agent
      .post("/api/checks")
      .send({ candidateId: 2, type: "INVALID_TYPE" });
    expect(res.status).toBe(400);

    const list = await agent.get("/api/checks").expect(200);
    expect(list.body).toHaveLength(SEED_CHECK_COUNT);
  });
});
