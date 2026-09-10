// In-memory seed data. Fresh copy per student store (see isolation.js).

function makeSeed() {
  const candidates = [
    { id: 1, name: "Aditi Sharma" },
    { id: 2, name: "Rohan Mehta" },
    { id: 3, name: "Kavya Iyer" },
    { id: 4, name: "Arjun Nair" },
  ];

  const checks = [
    {
      id: 1,
      candidateId: 1,
      candidateName: "Aditi Sharma",
      type: "IDENTITY",
      status: "VERIFIED",
      createdAt: "2026-07-01T09:12:00.000Z",
    },
    {
      id: 2,
      candidateId: 1,
      candidateName: "Aditi Sharma",
      type: "EDUCATION",
      status: "IN_PROGRESS",
      createdAt: "2026-07-02T10:00:00.000Z",
    },
    {
      id: 3,
      candidateId: 2,
      candidateName: "Rohan Mehta",
      type: "EMPLOYMENT",
      status: "DISCREPANCY",
      createdAt: "2026-07-03T11:30:00.000Z",
    },
    {
      id: 4,
      candidateId: 3,
      candidateName: "Kavya Iyer",
      type: "ADDRESS",
      status: "PENDING",
      createdAt: "2026-07-04T08:45:00.000Z",
    },
    {
      id: 5,
      candidateId: 4,
      candidateName: "Arjun Nair",
      type: "IDENTITY",
      status: "INSUFFICIENCY",
      createdAt: "2026-07-05T14:20:00.000Z",
    },
    {
      id: 6,
      candidateId: 2,
      candidateName: "Rohan Mehta",
      type: "ADDRESS",
      status: "CLOSED",
      createdAt: "2026-07-06T16:05:00.000Z",
    },
  ];

  return { candidates, checks, nextCheckId: checks.length + 1 };
}

module.exports = { makeSeed };
