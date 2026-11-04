// =====================================================
// A2 Claim Verification (Admin)
//   UPDATE: approve or reject a claim
//   ⭐ UNIQUE FEATURE - Claim Proof Check:
//     1. Admin sees the found item's HIDDEN DETAIL beside the claimant's PROOF
//     2. A keyword check shows which hidden-detail words the claimant mentioned
//     3. On approval: claim -> "Approved", found item -> "Returned",
//        other pending claims on the same item -> "Rejected",
//        claimants get a notification (shared with B2 Notification)
// =====================================================
const claimId = getQueryParam("id");
let claim = null;

async function loadClaim() {
    // found_item_secret is admin-only (RLS), so students can never read it
    const { data, error } = await sb.from("claim")
        .select("*, user_profile(*), " +
                "found_item(*, category(name), location(name), found_item_secret(hidden_detail, storage_place))")
        .eq("id", claimId).single();

    if (error || !data) {
        showMessage("message", "error", "Claim not found.");
        document.getElementById("decision-card").classList.add("d-none");
        return;
    }
    claim = data;
    const item = claim.found_item;
    const secret = item.found_item_secret || { hidden_detail: "(no hidden detail recorded)", storage_place: "-" };
    const user = claim.user_profile;

    // Header
    document.getElementById("claim-no").textContent = displayId("CL", claim.id);
    document.getElementById("claim-status").innerHTML =
        "Claim: " + statusBadge(claim.status) + " &nbsp; Item: " + statusBadge(item.status);

    // LEFT - found item + secret
    document.getElementById("item-name").textContent = displayId("FI", item.id) + " · " + item.item_name;
    document.getElementById("item-meta").textContent =
        item.category.name + " · Found at " + item.location.name + " on " + formatDate(item.date_found);
    document.getElementById("item-description").textContent = item.description;
    document.getElementById("hidden-detail").textContent = secret.hidden_detail;
    document.getElementById("storage-place").textContent = secret.storage_place;
    const photo = document.getElementById("item-photo");
    if (item.photo_url) { photo.src = item.photo_url; photo.classList.remove("d-none"); }

    // RIGHT - claimant's proof
    document.getElementById("claimant-name").textContent = user.name + " (" + displayId("U", user.user_no) + ")";
    document.getElementById("claimant-info").textContent =
        user.student_id + " · " + user.email + " · " + user.phone;
    document.getElementById("proof-description").textContent = claim.proof_description;
    document.getElementById("special-mark").textContent = claim.special_mark;
    document.getElementById("claim-date").textContent = "Submitted on " + formatDate(claim.created_at);

    showKeywordMatch(secret.hidden_detail, claim.proof_description + " " + claim.special_mark);
    await showOtherClaims();

    // Already decided -> show result, hide buttons
    if (claim.status !== "Pending") {
        document.getElementById("decision-card").classList.add("d-none");
        showMessage("message", claim.status === "Approved" ? "success" : "error",
            "This claim was " + claim.status + " on " + formatDate(claim.reviewed_at) +
            (claim.admin_remark ? ". Remark: " + claim.admin_remark : "."));
    }
}

// Which important words from the hidden detail also appear in the proof?
function showKeywordMatch(hidden, proof) {
    const ignore = ["the", "and", "with", "has", "have", "inside", "there", "this", "that", "from", "for"];
    const words = hidden.toLowerCase().match(/[a-z0-9]+/g) || [];
    const keywords = [...new Set(words.filter(w => w.length >= 3 && !ignore.includes(w)))];
    const proofText = proof.toLowerCase();
    const matched = keywords.filter(w => proofText.includes(w));

    const box = document.getElementById("match-hint");
    if (keywords.length === 0) {
        box.textContent = "🔍 Keyword check: no keywords in hidden detail.";
        return;
    }
    const percent = Math.round(matched.length / keywords.length * 100);
    box.innerHTML = "🔍 <b>Keyword check:</b> " + matched.length + " of " + keywords.length +
        " hidden-detail keywords found in the proof (" + percent + "%)" +
        (matched.length > 0 ? " — matched: <b>" + matched.map(escapeHtml).join(", ") + "</b>" : "") +
        "<br><span class='text-muted'>This is only a hint. Read both sides before deciding.</span>";
}

// Warn admin if other students also claimed this item
async function showOtherClaims() {
    const { data } = await sb.from("claim")
        .select("id, status, user_profile(name)")
        .eq("found_item_id", claim.found_item_id).neq("id", claim.id);

    if (data && data.length > 0) {
        const box = document.getElementById("other-claims");
        box.innerHTML = "⚠ This item has " + data.length + " other claim(s): " +
            data.map(c => "<a href='review.html?id=" + c.id + "'>" + displayId("CL", c.id) + "</a> (" +
                escapeHtml(c.user_profile.name) + ", " + c.status + ")").join(", ") +
            ". Approving this claim will reject the other pending ones.";
        box.classList.remove("d-none");
    }
}

// Send a notification to a student (table owned by B2 Notification)
async function notify(userId, title, message) {
    await sb.from("notification").insert({ user_id: userId, title: title, message: message, type: "Claim" });
}

// ---------- APPROVE ----------
document.getElementById("approve-btn").addEventListener("click", async () => {
    clearMessage("message");
    const remark = document.getElementById("remark").value.trim();
    const itemName = claim.found_item.item_name;

    if (claim.found_item.status === "Returned") {
        showMessage("message", "error", "This item has already been returned to someone else.");
        return;
    }
    if (!confirm("Approve " + displayId("CL", claim.id) + "?\n\n" +
                 "The item will be marked as Returned and other pending claims will be rejected.")) return;

    // 1. Approve this claim (only if still Pending)
    const { data: updated, error } = await sb.from("claim")
        .update({ status: "Approved", admin_remark: remark || null, reviewed_at: new Date().toISOString() })
        .eq("id", claim.id).eq("status", "Pending").select();

    if (error) { showMessage("message", "error", friendlyError(error)); return; }
    if (updated.length === 0) { showMessage("message", "error", "This claim is no longer Pending."); return; }

    // 2. Found Item status -> Returned (shared data with C1)
    const { error: itemError } = await sb.from("found_item")
        .update({ status: "Returned" }).eq("id", claim.found_item_id);
    if (itemError) { showMessage("message", "error", "Claim approved, but item status failed: " + friendlyError(itemError)); return; }

    // 3. Reject the other pending claims for the same item
    const { data: others } = await sb.from("claim")
        .update({ status: "Rejected", admin_remark: "Another claimant's proof was accepted.",
                  reviewed_at: new Date().toISOString() })
        .eq("found_item_id", claim.found_item_id).eq("status", "Pending")
        .select("user_id");

    // 4. Notifications (B2)
    await notify(claim.user_id, "Claim approved",
        "Your claim " + displayId("CL", claim.id) + " for \"" + itemName + "\" was approved. " +
        (remark || "Please collect your item."));
    for (const o of (others || [])) {
        await notify(o.user_id, "Claim rejected",
            "Your claim for \"" + itemName + "\" was rejected: another claimant's proof was accepted.");
    }

    await loadClaim();
    showMessage("message", "success", "Claim approved. Item marked as Returned" +
        (others && others.length ? " and " + others.length + " other claim(s) rejected." : "."));
});

// ---------- REJECT ----------
document.getElementById("reject-btn").addEventListener("click", async () => {
    clearMessage("message");
    clearFieldErrors(document.getElementById("decision-form"));
    const remark = document.getElementById("remark").value.trim();

    if (remark === "") {
        setFieldError("remark", "Please give a reason for rejecting.");
        showMessage("message", "error", "Admin remark is required when rejecting a claim.");
        return;
    }
    if (!confirm("Reject " + displayId("CL", claim.id) + "?")) return;

    const { data: updated, error } = await sb.from("claim")
        .update({ status: "Rejected", admin_remark: remark, reviewed_at: new Date().toISOString() })
        .eq("id", claim.id).eq("status", "Pending").select();

    if (error) { showMessage("message", "error", friendlyError(error)); return; }
    if (updated.length === 0) { showMessage("message", "error", "This claim is no longer Pending."); return; }

    await notify(claim.user_id, "Claim rejected",
        "Your claim " + displayId("CL", claim.id) + " for \"" + claim.found_item.item_name +
        "\" was rejected. Reason: " + remark);

    await loadClaim();
    showMessage("message", "success", "Claim rejected and the student has been notified.");
});

// Start
(async () => {
    const me = await initLayout("Admin");
    if (!me) return;
    if (!claimId) { showMessage("message", "error", "No claim selected."); return; }
    loadClaim();
})();
