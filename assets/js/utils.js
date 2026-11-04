// =====================================================
// Shared helper functions (used by every module)
// =====================================================

// Show a green (success) or red (error) message box.
// type: "success" | "error"   text: string, or an array of error strings
function showMessage(boxId, type, text) {
    const box = document.getElementById(boxId);
    const css = type === "success" ? "alert-success" : "alert-danger";
    const icon = type === "success" ? "✅" : "❌";

    let html;
    if (Array.isArray(text)) {
        html = icon + " Please fix the following:<ul class='mb-0'>" +
            text.map(t => "<li>" + escapeHtml(t) + "</li>").join("") + "</ul>";
    } else {
        html = icon + " " + escapeHtml(text);
    }

    box.innerHTML = "<div class='alert " + css + "' role='alert'>" + html + "</div>";
    box.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function clearMessage(boxId) {
    document.getElementById(boxId).innerHTML = "";
}

// Mark one input red (invalid) and show its message under it.
// The HTML needs: <div class="invalid-feedback" id="INPUTID-error"></div>
function setFieldError(inputId, message) {
    document.getElementById(inputId).classList.add("is-invalid");
    const fb = document.getElementById(inputId + "-error");
    if (fb) fb.textContent = message;
}

// Remove red marks from all inputs inside a form
function clearFieldErrors(form) {
    form.querySelectorAll(".is-invalid").forEach(el => el.classList.remove("is-invalid"));
}

// Stop HTML injection when putting user text into innerHTML
function escapeHtml(value) {
    if (value === null || value === undefined) return "";
    return String(value)
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// Display ID: displayId("CL", 7) -> "CL007"
function displayId(prefix, number) {
    return prefix + String(number).padStart(3, "0");
}

// "2026-11-04" or a timestamp -> "04/11/2026"
function formatDate(value) {
    if (!value) return "-";
    const d = new Date(value);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    return dd + "/" + mm + "/" + d.getFullYear();
}

// Coloured badge for a status word
function statusBadge(status) {
    const colours = {
        Pending: "warning", Approved: "success", Rejected: "danger",
        Available: "success", Claimed: "warning", Returned: "secondary",
        Active: "success", Inactive: "secondary", Lost: "danger", Found: "success"
    };
    const c = colours[status] || "secondary";
    const text = c === "warning" ? " text-dark" : "";
    return "<span class='badge bg-" + c + text + "'>" + escapeHtml(status) + "</span>";
}

// Read ?name=value from the page URL
function getQueryParam(name) {
    return new URLSearchParams(window.location.search).get(name);
}

// Turn a Supabase / database error into a friendly message
function friendlyError(error) {
    const msg = error && error.message ? error.message : String(error);
    if (msg.includes("duplicate key") && msg.includes("found_item_id")) {
        return "You have already claimed this item.";
    }
    if (msg.includes("duplicate key")) return "This record already exists.";
    if (msg.includes("Invalid login credentials")) return "Wrong email or password.";
    return msg;
}
