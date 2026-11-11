// =====================================================
// A2 Claim Verification
//   RETRIEVE: student views own claims (cards, filter by status)
//   DELETE:   student cancels a Pending claim
// =====================================================
let me = null;
let claims = [];          // all my claims, loaded once
let statusFilter = "";    // "" = all

// Text shown for each claim status
const STATUS_INFO = {
    Pending:  { css: "pending",  chip: "Pending · Waiting for admin review",
                title: "What happens next", text: "The admin compares your proof with the item's hidden detail." },
    Approved: { css: "approved", chip: "Claim approved · Ready for collection",
                title: "Collect your item", text: "Bring your student card to the Security Office." },
    Rejected: { css: "rejected", chip: "Claim rejected",
                title: "Not approved", text: "Your proof did not match the item. Chat with the Security Office if you think this is a mistake." }
};

async function loadMyClaims() {
    // found_item(...) = join to the Found Item table (shared data with C1)
    const { data, error } = await sb.from("claim")
        .select("*, found_item(id, item_name, status, photo_url)")
        .eq("user_id", me.id)
        .order("created_at", { ascending: false });

    if (error) {
        showMessage("message", "error", friendlyError(error));
        return;
    }
    claims = data;
    showCounts();
    showClaims();
}

// Numbers on the tiles and tabs
function showCounts() {
    const count = (s) => claims.filter(c => c.status === s).length;
    document.getElementById("stat-pending").textContent = count("Pending");
    document.getElementById("stat-approved").textContent = count("Approved");
    document.getElementById("stat-rejected").textContent = count("Rejected");
    document.getElementById("stat-total").textContent = claims.length;
    document.getElementById("tab-all").textContent = claims.length;
    document.getElementById("tab-pending").textContent = count("Pending");
    document.getElementById("tab-approved").textContent = count("Approved");
    document.getElementById("tab-rejected").textContent = count("Rejected");
}

function showClaims() {
    const list = document.getElementById("claim-list");
    const shown = claims.filter(c => statusFilter === "" || c.status === statusFilter);

    if (shown.length === 0) {
        list.innerHTML = "<div class='ll-empty'>" +
            (claims.length === 0 ? "You have not claimed any items yet." : "No " + statusFilter.toLowerCase() + " claims.") +
            "</div>";
        return;
    }

    list.innerHTML = shown.map(c => {
        const info = STATUS_INFO[c.status];
        const photo = c.found_item.photo_url
            ? "<img src='" + escapeHtml(c.found_item.photo_url) + "' alt='Photo of the item'>"
            : "<i class='bi bi-box-seam'></i>";

        // Buttons: Edit / Cancel only while Pending
        const buttons = c.status === "Pending"
            ? "<a class='btn btn-primary btn-sm w-100 mb-2' href='claim-form.html?id=" + c.id + "'><i class='bi bi-pencil'></i> Edit Claim</a>" +
              "<button class='btn btn-outline-danger btn-sm w-100 cancel-btn' data-id='" + c.id + "'><i class='bi bi-x-circle'></i> Cancel Claim</button>"
            : "<a class='btn btn-outline-primary btn-sm w-100' href='../chat/chat.html'><i class='bi bi-chat-dots'></i> Message Security Office</a>";

        const remark = c.admin_remark
            ? "<div class='ll-note'><b>Admin remark:</b> " + escapeHtml(c.admin_remark) + "</div>"
            : "";

        return "<div class='ll-claim-card " + info.css + "'>" +
            "<div class='ll-claim-photo'>" + photo + "</div>" +
            "<div class='ll-claim-body'>" +
              "<span class='ll-chip ll-chip-" + info.css + "'>" + info.chip + "</span>" +
              "<div class='small text-muted mt-2'>Submitted " + formatDate(c.created_at) + " · " + displayId("CL", c.id) + "</div>" +
              "<h2 class='h5 my-1'>" + displayId("FI", c.found_item.id) + " · " + escapeHtml(c.found_item.item_name) + "</h2>" +
              "<div class='row g-2 small mt-1'>" +
                "<div class='col-sm-6'><b>My proof:</b> " + escapeHtml(c.proof_description) + "</div>" +
                "<div class='col-sm-6'><b>Special mark:</b> " + escapeHtml(c.special_mark) + "</div>" +
                "<div class='col-sm-6'><b>Item status:</b> " + escapeHtml(c.found_item.status) + "</div>" +
                "<div class='col-sm-6'><b>Reviewed:</b> " + formatDate(c.reviewed_at) + "</div>" +
              "</div>" + remark +
            "</div>" +
            "<div class='ll-claim-side'>" +
              "<div class='ll-side-title'>" + info.title + "</div>" +
              "<p class='small mb-3'>" + info.text + "</p>" + buttons +
            "</div>" +
        "</div>";
    }).join("");
}

// ---------- Filter tabs ----------
document.getElementById("status-tabs").addEventListener("click", (e) => {
    const tab = e.target.closest(".ll-tab");
    if (!tab) return;
    document.querySelectorAll("#status-tabs .ll-tab").forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    statusFilter = tab.dataset.status;
    showClaims();
});

// ---------- DELETE: cancel a pending claim ----------
document.getElementById("claim-list").addEventListener("click", async (e) => {
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
    if (!me) return;
    showProfileHead(me);
    loadMyClaims();
})();
