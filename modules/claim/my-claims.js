// =====================================================
// A2 Claim Verification
//   RETRIEVE: student views own claims
//   DELETE:   student cancels a Pending claim
// =====================================================
let me = null;

async function loadMyClaims() {
    // found_item(...) = join to the Found Item table (shared data with C1)
    const { data, error } = await sb.from("claim")
        .select("*, found_item(id, item_name, status)")
        .eq("user_id", me.id)
        .order("created_at", { ascending: false });

    if (error) {
        showMessage("message", "error", friendlyError(error));
        return;
    }

    const tbody = document.getElementById("claim-table");
    if (data.length === 0) {
        tbody.innerHTML = "<tr><td colspan='7' class='text-center text-muted'>" +
            "You have not claimed any items yet.</td></tr>";
        return;
    }

    tbody.innerHTML = data.map(c => {
        // Edit / Cancel only while Pending
        const actions = c.status === "Pending"
            ? "<a class='btn btn-sm btn-outline-primary me-1' href='claim-form.html?id=" + c.id + "'>Edit</a>" +
              "<button class='btn btn-sm btn-outline-danger cancel-btn' data-id='" + c.id + "'>Cancel</button>"
            : "<span class='text-muted small'>-</span>";

        return "<tr>" +
            "<td>" + displayId("CL", c.id) + "</td>" +
            "<td>" + displayId("FI", c.found_item.id) + " " + escapeHtml(c.found_item.item_name) + "</td>" +
            "<td class='small'>" + escapeHtml(c.proof_description) +
                "<br><span class='text-muted'>Mark: " + escapeHtml(c.special_mark) + "</span></td>" +
            "<td>" + formatDate(c.created_at) + "</td>" +
            "<td>" + statusBadge(c.status) + "</td>" +
            "<td class='small'>" + escapeHtml(c.admin_remark || "-") + "</td>" +
            "<td class='text-nowrap'>" + actions + "</td>" +
            "</tr>";
    }).join("");
}

// ---------- DELETE: cancel a pending claim ----------
document.getElementById("claim-table").addEventListener("click", async (e) => {
    const btn = e.target.closest(".cancel-btn");
    if (!btn) return;

    const claimId = btn.dataset.id;
    if (!confirm("Cancel claim " + displayId("CL", claimId) + "? This cannot be undone.")) return;

    // RLS only allows deleting your own claim while it is Pending
    const { data, error } = await sb.from("claim")
        .delete().eq("id", claimId).eq("status", "Pending").select();

    if (error) {
        showMessage("message", "error", friendlyError(error));
        return;
    }
    if (data.length === 0) {
        showMessage("message", "error", "This claim is no longer Pending, so it cannot be cancelled.");
    } else {
        showMessage("message", "success", "Claim " + displayId("CL", claimId) + " has been cancelled.");
    }
    loadMyClaims();
});

// Start
(async () => {
    me = await initLayout("Student");
    if (me) loadMyClaims();
})();
