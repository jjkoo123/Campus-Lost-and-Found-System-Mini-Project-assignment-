// =====================================================
// A2 Claim Verification
//   CREATE: student claims a found item with proof
//   UPDATE: student edits own claim while it is "Pending"
// =====================================================
let me = null;
let editClaimId = getQueryParam("id");    // set when editing
let itemId = getQueryParam("item");       // set when claiming a new item

const form = document.getElementById("claim-form");
const proofInput = document.getElementById("proof-description");

// Live character counter
proofInput.addEventListener("input", () => {
    document.getElementById("proof-count").textContent = proofInput.value.length;
});

// ---------- Show the item's public info ----------
async function showItem(id) {
    const card = document.getElementById("item-card");
    if (!id) { card.classList.add("d-none"); return null; }

    const { data: item, error } = await sb.from("found_item")
        .select("id, item_name, description, date_found, photo_url, status, category(name), location(name)")
        .eq("id", id).single();

    if (error || !item) {
        showMessage("message", "error", "Found item not found.");
        card.classList.add("d-none");
        return null;
    }

    document.getElementById("item-name").textContent = displayId("FI", item.id) + " · " + item.item_name;
    document.getElementById("item-meta").textContent =
        item.category.name + " · Found at " + item.location.name + " on " + formatDate(item.date_found);
    document.getElementById("item-description").textContent = item.description;
    document.getElementById("item-status").innerHTML = statusBadge(item.status);

    const photo = document.getElementById("item-photo");
    if (item.photo_url) { photo.src = item.photo_url; photo.classList.remove("d-none"); }
    else { photo.classList.add("d-none"); }

    card.classList.remove("d-none");
    return item;
}

// Dropdown of available items (used when no ?item= in the URL)
async function loadAvailableItems() {
    const { data, error } = await sb.from("found_item")
        .select("id, item_name").eq("status", "Available").order("id", { ascending: false });
    if (error) { showMessage("message", "error", friendlyError(error)); return; }

    const select = document.getElementById("item-select");
    data.forEach(item => {
        const opt = document.createElement("option");
        opt.value = item.id;
        opt.textContent = displayId("FI", item.id) + " - " + item.item_name;
        select.appendChild(opt);
    });
    document.getElementById("item-select-group").classList.remove("d-none");

    select.addEventListener("change", () => {
        itemId = select.value;
        showItem(itemId);
    });
}

// ---------- Edit mode: load the existing claim ----------
async function loadClaimForEdit() {
    document.getElementById("page-title").textContent = "Edit Claim";
    document.getElementById("submit-btn").textContent = "Save Changes";

    // RLS only returns the claim if it belongs to this student
    const { data: claim, error } = await sb.from("claim")
        .select("*").eq("id", editClaimId).single();

    if (error || !claim) {
        showMessage("message", "error", "Claim not found.");
        form.querySelectorAll("input, textarea, button").forEach(el => el.disabled = true);
        return;
    }

    itemId = claim.found_item_id;
    await showItem(itemId);
    proofInput.value = claim.proof_description;
    document.getElementById("special-mark").value = claim.special_mark;
    document.getElementById("proof-count").textContent = claim.proof_description.length;

    // Rule: can edit only while Pending
    if (claim.status !== "Pending") {
        showMessage("message", "error", "This claim is already " + claim.status + " and can no longer be edited.");
        form.querySelectorAll("input, textarea, button").forEach(el => el.disabled = true);
    }
}

// ---------- Validation ----------
function validateClaim(proof, mark) {
    const errors = [];
    if (!itemId) {
        errors.push("Please select a found item.");
        setFieldError("item-select", "Please select a found item.");
    }
    if (proof === "") {
        errors.push("Proof description is required.");
        setFieldError("proof-description", "Proof description is required.");
    } else if (proof.length < 10) {
        errors.push("Proof description must be at least 10 characters.");
        setFieldError("proof-description", "At least 10 characters.");
    }
    if (mark === "") {
        errors.push("Special mark is required.");
        setFieldError("special-mark", "Special mark is required.");
    } else if (mark.length < 3) {
        errors.push("Special mark must be at least 3 characters.");
        setFieldError("special-mark", "At least 3 characters.");
    }
    return errors;
}

// ---------- Submit ----------
form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearMessage("message");
    clearFieldErrors(form);

    const proof = proofInput.value.trim();
    const mark = document.getElementById("special-mark").value.trim();

    const errors = validateClaim(proof, mark);
    if (errors.length > 0) {
        showMessage("message", "error", errors);
        return;
    }

    const btn = document.getElementById("submit-btn");
    btn.disabled = true;

    if (editClaimId) {
        await updateClaim(proof, mark);
    } else {
        await createClaim(proof, mark);
    }
    btn.disabled = false;
});

async function createClaim(proof, mark) {
    // Rule 1: item must be "Available" (check again - it may have changed)
    const { data: item } = await sb.from("found_item").select("status").eq("id", itemId).single();
    if (!item || item.status !== "Available") {
        showMessage("message", "error", "Sorry, this item is no longer available for claiming.");
        return;
    }

    // Rule 2: one claim per item per student
    const { data: existing } = await sb.from("claim")
        .select("id").eq("found_item_id", itemId).eq("user_id", me.id);
    if (existing && existing.length > 0) {
        showMessage("message", "error", "You have already claimed this item. See My Claims.");
        return;
    }

    // Save (DB trigger + UNIQUE constraint check the same rules again)
    const { error } = await sb.from("claim").insert({
        found_item_id: Number(itemId),
        user_id: me.id,
        proof_description: proof,
        special_mark: mark
    });

    if (error) {
        showMessage("message", "error", friendlyError(error));
        return;
    }

    showMessage("message", "success", "Claim submitted! The admin will review your proof. Redirecting...");
    setTimeout(() => { window.location.href = "my-claims.html"; }, 1500);
}

async function updateClaim(proof, mark) {
    // Only update if it is still Pending (status filter in the query)
    const { data, error } = await sb.from("claim")
        .update({ proof_description: proof, special_mark: mark })
        .eq("id", editClaimId).eq("status", "Pending")
        .select();

    if (error) {
        showMessage("message", "error", friendlyError(error));
        return;
    }
    if (data.length === 0) {
        showMessage("message", "error", "This claim is no longer Pending, so it cannot be edited.");
        return;
    }

    showMessage("message", "success", "Claim updated successfully. Redirecting...");
    setTimeout(() => { window.location.href = "my-claims.html"; }, 1500);
}

// ---------- Start ----------
(async () => {
    me = await initLayout("Student");
    if (!me) return;

    if (editClaimId) {
        await loadClaimForEdit();
    } else if (itemId) {
        const item = await showItem(itemId);
        if (item && item.status !== "Available") {
            showMessage("message", "error", "This item is " + item.status + " and cannot be claimed.");
            document.getElementById("submit-btn").disabled = true;
        }
    } else {
        await loadAvailableItems();
    }
})();
