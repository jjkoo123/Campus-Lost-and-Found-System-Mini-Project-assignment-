let me = null;
let reports = [];
let statusFilter = "";

async function loadFilterDropdowns() {
    const [catRes, locRes] = await Promise.all([
        sb.from("category").select("id, name").order("name"),
        sb.from("location").select("id, name").order("name")
    ]);

    if (catRes.data) {
        const catSelect = document.getElementById("filter-category");
        catRes.data.forEach(c => {
            const opt = document.createElement("option");
            opt.value = c.id;
            opt.textContent = c.name;
            catSelect.appendChild(opt);
        });
    }

    if (locRes.data) {
        const locSelect = document.getElementById("filter-location");
        locRes.data.forEach(l => {
            const opt = document.createElement("option");
            opt.value = l.id;
            opt.textContent = l.name;
            locSelect.appendChild(opt);
        });
    }
}

async function loadAllReports() {
    const { data, error } = await sb.from("lost_report")
        .select("*, category(name), location(name), user_profile(name, student_id)")
        .order("created_at", { ascending: false });

    if (error) {
        showMessage("message", "error", friendlyError(error));
        return;
    }

    reports = data;
    showCounts();
    showReports();
}

function showCounts() {
    const lostCount = reports.filter(r => r.status === "Lost").length;
    const foundCount = reports.filter(r => r.status === "Found").length;

    document.getElementById("stat-lost").textContent = lostCount;
    document.getElementById("stat-found").textContent = foundCount;
    document.getElementById("stat-total").textContent = reports.length;
    document.getElementById("tab-all").textContent = reports.length;
    document.getElementById("tab-lost").textContent = lostCount;
    document.getElementById("tab-found").textContent = foundCount;
}

function showReports() {
    const keyword = document.getElementById("filter-search").value.trim().toLowerCase();
    const catId = document.getElementById("filter-category").value;
    const locId = document.getElementById("filter-location").value;
    const dateVal = document.getElementById("filter-date").value;

    const shown = reports.filter(r => {
        if (statusFilter !== "" && r.status !== statusFilter) return false;
        if (keyword !== "") {
            const studentName = r.user_profile ? r.user_profile.name.toLowerCase() : "";
            const matchText = r.item_name.toLowerCase().includes(keyword) ||
                r.description.toLowerCase().includes(keyword) ||
                studentName.includes(keyword);
            if (!matchText) return false;
        }
        if (catId !== "" && String(r.category_id) !== catId) return false;
        if (locId !== "" && String(r.location_id) !== locId) return false;
        if (dateVal !== "" && r.date_lost !== dateVal) return false;
        return true;
    });

    const list = document.getElementById("report-list");
    if (shown.length === 0) {
        list.innerHTML = "<div class='ll-empty'>No lost reports found.</div>";
        return;
    }

    list.innerHTML = shown.map(r => {
        const isLost = r.status === "Lost";
        const cardClass = isLost ? "pending" : "approved";
        const chipClass = isLost ? "ll-chip-pending" : "ll-chip-approved";
        const chipText = isLost ? "Lost · Unresolved" : "Found · Resolved";

        const photo = r.photo_url
            ? "<img src='" + escapeHtml(r.photo_url) + "' alt='Item photo'>"
            : "<i class='bi bi-image'></i>";

        const reporter = r.user_profile
            ? escapeHtml(r.user_profile.name) + " (" + escapeHtml(r.user_profile.student_id || "-") + ")"
            : "Unknown";

        const actionBtn = isLost
            ? "<button class='btn btn-success btn-sm w-100 mb-2 status-btn' data-id='" + r.id + "' data-user='" + r.user_id + "' data-item='" + escapeHtml(r.item_name) + "' data-next='Found'><i class='bi bi-check-circle'></i> Mark as Found</button>"
            : "<button class='btn btn-outline-secondary btn-sm w-100 mb-2 status-btn' data-id='" + r.id + "' data-user='" + r.user_id + "' data-item='" + escapeHtml(r.item_name) + "' data-next='Lost'><i class='bi bi-arrow-counterclockwise'></i> Reopen as Lost</button>";

        return "<div class='ll-claim-card " + cardClass + "'>" +
            "<div class='ll-claim-photo'>" + photo + "</div>" +
            "<div class='ll-claim-body'>" +
              "<span class='ll-chip " + chipClass + "'>" + chipText + "</span>" +
              "<div class='small text-muted mt-2'>Reported " + formatDate(r.created_at) + " · " + displayId("LR", r.id) + "</div>" +
              "<h2 class='h5 my-1'>" + escapeHtml(r.item_name) + "</h2>" +
              "<div class='row g-2 small mt-1'>" +
                "<div class='col-sm-6'><b>Reported By:</b> " + reporter + "</div>" +
                "<div class='col-sm-6'><b>Category:</b> " + escapeHtml(r.category ? r.category.name : "-") + "</div>" +
                "<div class='col-sm-6'><b>Location:</b> " + escapeHtml(r.location ? r.location.name : "-") + "</div>" +
                "<div class='col-sm-6'><b>Date Lost:</b> " + formatDate(r.date_lost) + "</div>" +
              "</div>" +
              "<div class='ll-note'><b>Description:</b> " + escapeHtml(r.description) + "</div>" +
            "</div>" +
            "<div class='ll-claim-side'>" +
              "<div class='ll-side-title'>Admin Action</div>" +
              actionBtn +
            "</div>" +
        "</div>";
    }).join("");
}

document.getElementById("status-tabs").addEventListener("click", (e) => {
    const tab = e.target.closest(".ll-tab");
    if (!tab) return;
    document.querySelectorAll("#status-tabs .ll-tab").forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    statusFilter = tab.dataset.status;
    showReports();
});

["filter-search", "filter-category", "filter-location", "filter-date"].forEach(id => {
    document.getElementById(id).addEventListener("input", showReports);
});

document.getElementById("reset-btn").addEventListener("click", () => {
    document.getElementById("filter-search").value = "";
    document.getElementById("filter-category").value = "";
    document.getElementById("filter-location").value = "";
    document.getElementById("filter-date").value = "";
    showReports();
});

document.getElementById("report-list").addEventListener("click", async (e) => {
    const btn = e.target.closest(".status-btn");
    if (!btn) return;

    const id = btn.dataset.id;
    const nextStatus = btn.dataset.next;
    const itemName = btn.dataset.item;
    const ownerId = btn.dataset.user;

    if (!confirm("Change " + displayId("LR", id) + " status to " + nextStatus + "?")) return;

    const { error } = await sb.from("lost_report")
        .update({ status: nextStatus })
        .eq("id", id);

    if (error) {
        showMessage("message", "error", friendlyError(error));
        return;
    }

    if (nextStatus === "Found") {
        await sb.from("notification").insert({
            user_id: ownerId,
            title: "Lost Report Marked as Found",
            message: "An admin has marked your lost report \"" + itemName + "\" (" + displayId("LR", id) + ") as Found.",
            type: "General"
        });
    }

    showMessage("message", "success", displayId("LR", id) + " updated to " + nextStatus + ".");
    loadAllReports();
});

(async () => {
    me = await initLayout("Admin");
    if (!me) return;
    await loadFilterDropdowns();
    await loadAllReports();
})();