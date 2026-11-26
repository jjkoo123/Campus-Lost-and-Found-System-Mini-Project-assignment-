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

async function loadMyReports() {
    const { data, error } = await sb.from("lost_report")
        .select("*, category(name), location(name)")
        .eq("user_id", me.id)
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
        if (keyword !== "" && !r.item_name.toLowerCase().includes(keyword) && !r.description.toLowerCase().includes(keyword)) return false;
        if (catId !== "" && String(r.category_id) !== catId) return false;
        if (locId !== "" && String(r.location_id) !== locId) return false;
        if (dateVal !== "" && r.date_lost !== dateVal) return false;
        return true;
    });

    const list = document.getElementById("report-list");
    if (shown.length === 0) {
        list.innerHTML = "<div class='ll-empty'>" +
            (reports.length === 0 ? "You have not filed any lost reports yet." : "No lost reports match your filters.") +
            "</div>";
        return;
    }

    list.innerHTML = shown.map(r => {
        const isLost = r.status === "Lost";
        const cardClass = isLost ? "pending" : "approved";
        const chipClass = isLost ? "ll-chip-pending" : "ll-chip-approved";
        const chipText = isLost ? "Lost · Searching for matches" : "Found · Resolved";

        const photo = r.photo_url
            ? "<img src='" + escapeHtml(r.photo_url) + "' alt='Item photo'>"
            : "<i class='bi bi-image'></i>";

        // Only the admin marks a report as Found (Admin > Lost Reports)
        const markBtn = isLost
            ? "<div class='small text-muted mb-2'>The Security Office will mark this report as Found when your item is returned.</div>"
            : "";

        return "<div class='ll-claim-card " + cardClass + "'>" +
            "<div class='ll-claim-photo'>" + photo + "</div>" +
            "<div class='ll-claim-body'>" +
              "<span class='ll-chip " + chipClass + "'>" + chipText + "</span>" +
              "<div class='small text-muted mt-2'>Reported " + formatDate(r.created_at) + " · " + displayId("LR", r.id) + "</div>" +
              "<h2 class='h5 my-1'>" + escapeHtml(r.item_name) + "</h2>" +
              "<div class='row g-2 small mt-1'>" +
                "<div class='col-sm-6'><b>Category:</b> " + escapeHtml(r.category ? r.category.name : "-") + "</div>" +
                "<div class='col-sm-6'><b>Location:</b> " + escapeHtml(r.location ? r.location.name : "-") + "</div>" +
                "<div class='col-sm-6'><b>Date Lost:</b> " + formatDate(r.date_lost) + "</div>" +
                "<div class='col-sm-6'><b>Status:</b> " + statusBadge(r.status) + "</div>" +
              "</div>" +
              "<div class='ll-note'><b>Description:</b> " + escapeHtml(r.description) + "</div>" +
            "</div>" +
            "<div class='ll-claim-side'>" +
              "<div class='ll-side-title'>Actions</div>" +
              markBtn +
              "<a class='btn btn-primary btn-sm w-100 mb-2' href='lost-form.html?id=" + r.id + "'><i class='bi bi-pencil'></i> Edit Report</a>" +
              "<button class='btn btn-outline-danger btn-sm w-100 delete-btn' data-id='" + r.id + "'><i class='bi bi-trash'></i> Delete Report</button>" +
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
    const deleteBtn = e.target.closest(".delete-btn");

    if (deleteBtn) {
        const id = deleteBtn.dataset.id;
        if (!confirm("Delete " + displayId("LR", id) + "? This cannot be undone.")) return;

        const { error } = await sb.from("lost_report")
            .delete()
            .eq("id", id)
            .eq("user_id", me.id);

        if (error) {
            showMessage("message", "error", friendlyError(error));
            return;
        }
        showMessage("message", "success", displayId("LR", id) + " has been deleted.");
        loadMyReports();
    }
});

(async () => {
    me = await initLayout("Student");
    if (!me) return;
    showProfileHead(me);
    await loadFilterDropdowns();
    await loadMyReports();
})();