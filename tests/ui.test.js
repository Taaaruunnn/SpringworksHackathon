/**
 * Regression tests for the front-end bugs in my-bug-report.md (#10-#12).
 *
 * These load public/index.html + public/app.js into a jsdom window with a stubbed
 * `fetch`, then exercise the real client code. Each test fails against the
 * original app.js and passes once the fix is applied.
 */

const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const PUBLIC_DIR = path.join(__dirname, "..", "public");
const INDEX_HTML = fs.readFileSync(path.join(PUBLIC_DIR, "index.html"), "utf8");
const APP_JS = fs.readFileSync(path.join(PUBLIC_DIR, "app.js"), "utf8");

// A minimal seed payload for GET /api/checks, mirroring data.js (incl. the
// DISCREPANCY row used by bug #11).
const SEED_CHECKS = [
  { id: 1, candidateId: 1, candidateName: "Aditi Sharma", type: "IDENTITY", status: "VERIFIED", createdAt: "2026-07-01T09:12:00.000Z" },
  { id: 3, candidateId: 2, candidateName: "Rohan Mehta", type: "EMPLOYMENT", status: "DISCREPANCY", createdAt: "2026-07-03T11:30:00.000Z" },
];

const openWindows = [];
afterEach(() => {
  while (openWindows.length) {
    try { openWindows.pop().close(); } catch (_) { /* already closed */ }
  }
});

function flush(times = 5) {
  let p = Promise.resolve();
  for (let i = 0; i < times; i++) p = p.then(() => new Promise((r) => setTimeout(r, 0)));
  return p;
}

/**
 * Boot the client. `fetchImpl` receives (url, options) and returns a Promise.
 * Returns the jsdom window once app.js has run and its initial loadChecks()
 * has settled.
 */
async function boot(fetchImpl) {
  const dom = new JSDOM(INDEX_HTML, {
    url: "http://localhost/",
    runScripts: "dangerously",
  });
  const { window } = dom;
  openWindows.push(window);

  window.fetch =
    fetchImpl ||
    ((url) => {
      if (String(url).startsWith("/api/checks")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(SEED_CHECKS) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

  const script = window.document.createElement("script");
  script.textContent = APP_JS;
  window.document.head.appendChild(script);

  await flush();
  return window;
}

describe("Bug #10 - Type filter dropdown defaults to 'Identity' instead of 'All Types'", () => {
  test("on load the Type filter has no value selected (All Types)", async () => {
    const window = await boot();
    const select = window.document.getElementById("filter-type");
    expect(select.value).toBe("");
    expect(select.options[select.selectedIndex].textContent.trim()).toBe("All Types");
  });
});

describe("Bug #11 - Discrepancy status badge is green (same as Verified) instead of red", () => {
  test("the rendered DISCREPANCY badge uses a red colour distinct from VERIFIED", async () => {
    const window = await boot();
    const rows = [...window.document.querySelectorAll("#checks-tbody tr")];
    const badgeColor = (status) => {
      const row = rows.find((r) => r.querySelector(".badge").textContent.trim() ===
        (status === "DISCREPANCY" ? "Discrepancy" : "Verified"));
      return row.querySelector(".badge").style.color.toLowerCase();
    };

    const discrepancy = badgeColor("DISCREPANCY");
    const verified = badgeColor("VERIFIED");

    // Distinct from the "verified" green...
    expect(discrepancy).not.toBe(verified);

    // ...and actually red: red channel dominant. Accept hex or rgb() form.
    const toRgb = (c) => {
      const m = c.match(/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/);
      if (m) return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
      const rgb = c.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
      return rgb ? [+rgb[1], +rgb[2], +rgb[3]] : null;
    };
    const [r, g, b] = toRgb(discrepancy);
    expect(r).toBeGreaterThan(g + 40);
    expect(r).toBeGreaterThan(b + 40);
  });
});

describe("Bug #12 - failed Add Check / Update Status requests fail silently", () => {
  test("a network failure on Add Check shows a user-facing error message", async () => {
    const window = await boot();
    window.fetch = () => Promise.reject(new TypeError("Failed to fetch"));

    window.document.getElementById("add-check-btn").click();
    await flush();

    const toast = window.document.getElementById("toast");
    expect(toast.classList.contains("hidden")).toBe(false);
    expect(toast.classList.contains("error")).toBe(true);
    expect(toast.textContent.length).toBeGreaterThan(0);
  });

  test("a network failure on Update Status shows a user-facing error message", async () => {
    const window = await boot();
    const updateBtn = window.document.querySelector("#checks-tbody .row-update");
    expect(updateBtn).toBeTruthy();

    window.fetch = () => Promise.reject(new TypeError("Failed to fetch"));
    updateBtn.click();
    await flush();

    const toast = window.document.getElementById("toast");
    expect(toast.classList.contains("error")).toBe(true);
  });
});
