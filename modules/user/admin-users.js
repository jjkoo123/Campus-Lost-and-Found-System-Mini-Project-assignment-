// =====================================================
// A1 User / Account (Admin)
//   RETRIEVE: view + search user list
//   DELETE:   deactivate a user (soft delete), or reactivate
// =====================================================
let me = null;

// Load users from the database. keyword = "" means show everyone.
async function loadUsers(keyword) {
    const status = document.getElementById("status-filter").value;

    let query = sb.from("user_profile").select("*").order("user_no");

    if (keyword !== "") {
        // ilike = case-insensitive "contains"
        query = query.or(
            "name.ilike.%" + keyword + "%," +
            "student_id.ilike.%" + keyword + "%," +
            "email.ilike.%" + keyword + "%"
        );
    }
    if (status !== "") {
        query = query.eq("status", status);
    }

    const { data, error } = await query;
    if (error) {
        showMessage("message", "error", friendlyError(error));
        return;
    }
    showUsers(data);
}

function showUsers(users) {
    const tbody = document.getElementById("user-table");
    document.getElementById("count").textContent = users.length + " user(s) found.";

    if (users.length === 0) {
        tbody.innerHTML = "<tr><td colspan='9' class='text-center text-muted'>No users found.</td></tr>";
        return;
    }

    tbody.innerHTML = users.map(u => {
        let action;
        if (u.id === me.id) {
            action = "<span class='text-muted small'>(you)</span>";   // cannot deactivate yourself
        } else {
            const newStatus = u.status === "Active" ? "Inactive" : "Active";
            const label = u.status === "Active" ? "Deactivate" : "Reactivate";
            const colour = u.status === "Active" ? "danger" : "success";
            action = "<button class='btn btn-sm btn-outline-" + colour + " status-btn'" +
                " data-id='" + u.id + "' data-status='" + newStatus + "'" +
                " data-name='" + escapeHtml(u.name) + "'>" + label + "</button>";
        }

        return "<tr>" +
            "<td>" + displayId("U", u.user_no) + "</td>" +
            "<td>" + escapeHtml(u.name) + "</td>" +
            "<td>" + escapeHtml(u.student_id) + "</td>" +
            "<td>" + escapeHtml(u.email) + "</td>" +
            "<td>" + escapeHtml(u.phone) + "</td>" +
            "<td>" + u.role + "</td>" +
            "<td>" + statusBadge(u.status) + "</td>" +
            "<td>" + formatDate(u.created_at) + "</td>" +
            "<td>" + action + "</td>" +
            "</tr>";
    }).join("");
}

// ---------- DELETE (deactivate) / reactivate ----------
async function changeStatus(userId, newStatus, name) {
    if (userId === me.id) {
        showMessage("message", "error", "You cannot deactivate your own account.");
        return;
    }

    const word = newStatus === "Inactive" ? "deactivate" : "reactivate";
    if (!confirm("Are you sure you want to " + word + " " + name + "?")) return;

    // set_user_status() is a database function that also checks
    // "admin only" and "not yourself" (see schema.sql)
    const { error } = await sb.rpc("set_user_status", { p_user_id: userId, p_status: newStatus });
    if (error) {
        showMessage("message", "error", friendlyError(error));
        return;
    }

    showMessage("message", "success", name + " has been " + word + "d.");
    loadUsers(document.getElementById("search").value.trim());
}

// One click listener for all Deactivate / Reactivate buttons in the table
document.getElementById("user-table").addEventListener("click", (e) => {
    const btn = e.target.closest(".status-btn");
    if (btn) changeStatus(btn.dataset.id, btn.dataset.status, btn.dataset.name);
});

// ---------- Search ----------
const searchForm = document.getElementById("search-form");

searchForm.addEventListener("submit", (e) => {
    e.preventDefault();
    clearMessage("message");
    clearFieldErrors(searchForm);

    const keyword = document.getElementById("search").value.trim();
    if (keyword === "") {
        setFieldError("search", "Please enter a name, student ID or email.");
        showMessage("message", "error", "Search box cannot be empty.");
        return;
    }
    // Remove characters that would break the search filter
    loadUsers(keyword.replace(/[,()%]/g, ""));
});

document.getElementById("reset-btn").addEventListener("click", () => {
    document.getElementById("search").value = "";
    document.getElementById("status-filter").value = "";
    clearMessage("message");
    clearFieldErrors(searchForm);
    loadUsers("");
});

document.getElementById("status-filter").addEventListener("change", () => {
    loadUsers(document.getElementById("search").value.trim().replace(/[,()%]/g, ""));
});

// Start
(async () => {
    me = await initLayout("Admin");
    if (me) loadUsers("");
})();
