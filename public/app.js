const STATUS_COLORS = {
  PENDING: "#696A6F",
  IN_PROGRESS: "#0ABAF6",
  VERIFIED: "#036B26",
  DISCREPANCY: "#C62828",
  INSUFFICIENCY: "#BC7964",
  CLOSED: "#696A6F",
};

const STATUS_LABELS = {
  PENDING: "Pending",
  IN_PROGRESS: "In Progress",
  VERIFIED: "Verified",
  DISCREPANCY: "Discrepancy",
  INSUFFICIENCY: "Insufficiency",
  CLOSED: "Closed",
};

const ALL_STATUSES = ["PENDING", "IN_PROGRESS", "VERIFIED", "DISCREPANCY", "INSUFFICIENCY", "CLOSED"];

function formatDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso == null ? "" : String(iso);
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function escapeHtml(value) {
  return String(value == null ? "" : value).replace(
    /[&<>"']/g,
    (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch])
  );
}

function showToast(message, type) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.className = "toast" + (type === "error" ? " error" : "");
  setTimeout(() => toast.classList.add("hidden"), 2500);
}

function renderLegend() {
  const legend = document.getElementById("status-legend");
  legend.innerHTML = ALL_STATUSES.map((s) => {
    return `<span class="badge" style="background:${STATUS_COLORS[s]}22;color:${STATUS_COLORS[s]}">${STATUS_LABELS[s]}</span>`;
  }).join("");
}

function renderChecks(checks) {
  const tbody = document.getElementById("checks-tbody");
  tbody.innerHTML = checks
    .map((c) => {
      const color = STATUS_COLORS[c.status] || "#696A6F";
      const label = STATUS_LABELS[c.status] || c.status;
      // Pre-select the option that matches this row's current status, not always PENDING.
      const statusOptions = ALL_STATUSES.map(
        (s) => `<option value="${s}"${s === c.status ? " selected" : ""}>${STATUS_LABELS[s]}</option>`
      ).join("");
      return `
        <tr data-id="${escapeHtml(c.id)}">
          <td>${escapeHtml(c.id)}</td>
          <td>${escapeHtml(c.candidateName ?? c.candidateId)}</td>
          <td>${escapeHtml(c.type)}</td>
          <td><span class="badge" style="background:${color}22;color:${color}">${escapeHtml(label)}</span></td>
          <td>${escapeHtml(formatDate(c.createdAt))}</td>
          <td>
            <select class="row-status">${statusOptions}</select>
            <button class="row-update secondary" type="button">Update</button>
          </td>
        </tr>`;
    })
    .join("");

  tbody.querySelectorAll(".row-update").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const row = e.target.closest("tr");
      const id = row.dataset.id;
      // Read THIS row's dropdown, not the first one in the table.
      const status = row.querySelector(".row-status").value;
      try {
        const res = await fetch(`/api/checks/${id}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        });
        if (res.ok) {
          showToast("Status updated", "success");
        } else {
          showToast("Failed to update status", "error");
        }
        loadChecks();
      } catch (err) {
        showToast("Network error — could not update status", "error");
      }
    });
  });
}

function buildQuery() {
  const status = document.getElementById("filter-status").value;
  const type = document.getElementById("filter-type").value;
  const candidateId = document.getElementById("filter-candidate-id").value.trim();
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (type) params.set("type", type);
  if (candidateId) params.set("candidateId", candidateId);
  return params.toString();
}

async function loadChecks() {
  const qs = buildQuery();
  const res = await fetch(`/api/checks${qs ? "?" + qs : ""}`);
  const data = await res.json();
  renderChecks(data);
}

document.getElementById("apply-filters").addEventListener("click", loadChecks);
document.getElementById("clear-filters").addEventListener("click", () => {
  document.getElementById("filter-status").value = "";
  document.getElementById("filter-type").value = "";
  document.getElementById("filter-candidate-id").value = "";
  loadChecks();
});

document.getElementById("add-check-btn").addEventListener("click", async () => {
  const candidateId = parseInt(document.getElementById("new-candidate-id").value, 10);
  const type = document.getElementById("new-type").value;

  try {
    const res = await fetch("/api/checks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ candidateId, type }),
    });
    if (res.ok) {
      showToast("Check added successfully", "success");
      loadChecks();
    } else {
      showToast("Failed to add check", "error");
    }
  } catch (err) {
    showToast("Network error — could not add check", "error");
  }
});

renderLegend();
loadChecks();

// --- Interviewer/candidate tooling: reset seed data (not part of the app-under-test) ---
document.getElementById("reset-data-btn").addEventListener("click", async () => {
  await fetch("/api/reset", { method: "POST" });
  loadChecks();
  showToast("Data reset", "success");
});
