// =====================================================
// A2 Claim Verification (Admin)
//   RETRIEVE: view all claims, filter by status
//   -> "Review" opens review.html (approve / reject = UPDATE + unique feature)
// =====================================================

async function loadClaims(status) {
    // Join: claim -> found item (C1) and claim -> user profile (A1)
    let query = sb.from("claim")
        .select("*, found_item(id, item_name, status), user_profile(name, student_id)")
        .order("created_at", { ascending: true });   // oldest first = fair queue

    if (status !== "") query = query.eq("status", status);

    const { data, error } = await query;
    if (error) {
        showMessage("message", "error", friendlyError(error));
        return;
    }

    const tbody = document.getElementById("claim-table");
    if (data.length === 0) {
        tbody.innerHTML = "<tr><td colspan='7' class='text-center text-muted'>No claims found.</td></tr>";
        return;
    }

    tbody.innerHTML = data.map(c => {
        const btnText = c.status === "Pending" ? "Review" : "View";
        const btnCss = c.status === "Pending" ? "btn-primary" : "btn-outline-secondary";
        return "<tr>" +
            "<td>" + displayId("CL", c.id) + "</td>" +
            "<td>" + displayId("FI", c.found_item.id) + " " + escapeHtml(c.found_item.item_name) + "</td>" +
            "<td>" + statusBadge(c.found_item.status) + "</td>" +
            "<td>" + escapeHtml(c.user_profile.name) +
                "<br><span class='small text-muted'>" + escapeHtml(c.user_profile.student_id) + "</span></td>" +
            "<td>" + formatDate(c.created_at) + "</td>" +
            "<td>" + statusBadge(c.status) + "</td>" +
            "<td><a class='btn btn-sm " + btnCss + "' href='review.html?id=" + c.id + "'>" + btnText + "</a></td>" +
            "</tr>";
    }).join("");
}

// Number of claims in each status (shown on the tabs)
async function loadCounts() {
    for (const s of ["Pending", "Approved", "Rejected"]) {
        const { count } = await sb.from("claim")
            .select("id", { count: "exact", head: true }).eq("status", s);
        document.getElementById("count-" + s).textContent = count || 0;
    }
}

// Tab click = change filter
document.getElementById("status-tabs").addEventListener("click", (e) => {
    const tab = e.target.closest("[data-status]");
    if (!tab) return;
    document.querySelectorAll("#status-tabs .nav-link").forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    loadClaims(tab.dataset.status);
});

// Start
(async () => {
    const me = await initLayout("Admin");
    if (!me) return;
    loadCounts();
    loadClaims("Pending");
})();
