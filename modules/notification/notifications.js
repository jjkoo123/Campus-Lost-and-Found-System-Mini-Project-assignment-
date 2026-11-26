let me = null;
let notifications = [];
let currentFilter = "all";

const TYPE_STYLE = {
    Match:        { icon: "stars",          badge: "bg-warning text-dark" },
    Claim:        { icon: "patch-check",    badge: "bg-success" },
    Announcement: { icon: "megaphone",      badge: "bg-primary" },
    General:      { icon: "bell",           badge: "bg-secondary" }
};

function formatDateTime(value) {
    const d = new Date(value);
    return formatDate(value) + " " +
        String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
}

async function loadNotifications() {
    // Own notifications + announcements (user_id empty), for students and admin
    const { data, error } = await sb.from("notification")
        .select("*")
        .or("user_id.eq." + me.id + ",user_id.is.null")
        .order("created_at", { ascending: false });

    if (error) {
        showMessage("message", "error", friendlyError(error));
        return;
    }
    notifications = data;
    showCounts();
    showNotifications();
    loadUnreadBadge(me);
}

function showCounts() {
    const unreadPersonal = notifications.filter(n => n.user_id === me.id && !n.is_read).length;
    document.getElementById("tab-all").textContent = notifications.length;
    document.getElementById("tab-unread").textContent = unreadPersonal;
    document.getElementById("tab-Match").textContent = notifications.filter(n => n.type === "Match").length;
    document.getElementById("tab-Claim").textContent = notifications.filter(n => n.type === "Claim").length;
    document.getElementById("tab-Announcement").textContent = notifications.filter(n => n.type === "Announcement").length;

    const markAllBtn = document.getElementById("mark-all-btn");
    if (unreadPersonal > 0) markAllBtn.classList.remove("d-none");
    else markAllBtn.classList.add("d-none");
}

function showNotifications() {
    const shown = notifications.filter(n => {
        if (currentFilter === "all") return true;
        if (currentFilter === "unread") return n.user_id === me.id && !n.is_read;
        return n.type === currentFilter;
    });

    const list = document.getElementById("notif-list");
    if (shown.length === 0) {
        list.innerHTML = "<div class='ll-empty'>No notifications here.</div>";
        return;
    }

    list.innerHTML = shown.map(n => {
        const style = TYPE_STYLE[n.type] || TYPE_STYLE.General;
        const isMine = n.user_id === me.id;
        const canDelete = isMine || (me.role === "Admin" && n.user_id === null);
        const isUnread = isMine && !n.is_read;   // announcements are shared, so they have no read state
        const unreadClass = isUnread ? "border-start border-4 border-primary bg-white" : "bg-light";

        const readBtn = isMine
            ? "<button class='btn btn-outline-primary btn-sm toggle-read-btn' data-id='" + n.id + "' data-read='" + n.is_read + "'>" +
              (n.is_read ? "<i class='bi bi-envelope'></i> Mark Unread" : "<i class='bi bi-envelope-open'></i> Mark Read") +
              "</button>"
            : "";

        const delBtn = canDelete
            ? "<button class='btn btn-outline-danger btn-sm delete-btn' data-id='" + n.id + "'>" +
              "<i class='bi bi-trash'></i> Delete</button>"
            : "";

        const unreadDot = isUnread
            ? "<span class='badge bg-warning text-dark ms-1'>Unread</span>"
            : "";

        return "<div class='card shadow-sm mb-2 " + unreadClass + "'>" +
            "<div class='card-body d-flex flex-wrap justify-content-between align-items-start gap-3'>" +
              "<div class='flex-fill'>" +
                "<div class='d-flex align-items-center gap-2 mb-1'>" +
                  "<span class='badge " + style.badge + "'><i class='bi bi-" + style.icon + "'></i> " + escapeHtml(n.type) + "</span>" +
                  unreadDot +
                  "<span class='small text-muted'>" + formatDateTime(n.created_at) + "</span>" +
                "</div>" +
                "<h2 class='h6 mb-1'>" + escapeHtml(n.title) + "</h2>" +
                "<p class='small mb-0 text-muted'>" + escapeHtml(n.message) + "</p>" +
              "</div>" +
              "<div class='d-flex gap-2'>" + readBtn + delBtn + "</div>" +
            "</div>" +
        "</div>";
    }).join("");
}

document.getElementById("filter-tabs").addEventListener("click", (e) => {
    const tab = e.target.closest(".ll-tab");
    if (!tab) return;
    document.querySelectorAll("#filter-tabs .ll-tab").forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    currentFilter = tab.dataset.filter;
    showNotifications();
});

document.getElementById("notif-list").addEventListener("click", async (e) => {
    const toggleBtn = e.target.closest(".toggle-read-btn");
    const deleteBtn = e.target.closest(".delete-btn");

    if (toggleBtn) {
        const id = toggleBtn.dataset.id;
        const nextRead = toggleBtn.dataset.read !== "true";

        const { error } = await sb.from("notification")
            .update({ is_read: nextRead })
            .eq("id", id)
            .eq("user_id", me.id);

        if (error) { showMessage("message", "error", friendlyError(error)); return; }
        loadNotifications();
    }

    if (deleteBtn) {
        const id = deleteBtn.dataset.id;
        if (!confirm("Delete this notification? This cannot be undone.")) return;

        const { error } = await sb.from("notification").delete().eq("id", id);
        if (error) { showMessage("message", "error", friendlyError(error)); return; }

        showMessage("message", "success", "Notification deleted.");
        loadNotifications();
    }
});

document.getElementById("mark-all-btn").addEventListener("click", async () => {
    const { error } = await sb.from("notification")
        .update({ is_read: true })
        .eq("user_id", me.id)
        .eq("is_read", false);

    if (error) { showMessage("message", "error", friendlyError(error)); return; }
    showMessage("message", "success", "All personal notifications marked as read.");
    loadNotifications();
});

const annForm = document.getElementById("announce-form");
annForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearMessage("message");
    clearFieldErrors(annForm);

    const title = document.getElementById("ann-title").value.trim();
    const message = document.getElementById("ann-message").value.trim();

    const errors = [];
    if (title === "") {
        errors.push("Title is required.");
        setFieldError("ann-title", "Title is required.");
    }
    if (message === "") {
        errors.push("Message is required.");
        setFieldError("ann-message", "Message is required.");
    }
    if (errors.length > 0) {
        showMessage("message", "error", errors);
        return;
    }

    const btn = document.getElementById("ann-btn");
    btn.disabled = true;

    const { error } = await sb.from("notification").insert({
        user_id: null,
        title: title,
        message: message,
        type: "Announcement"
    });

    btn.disabled = false;
    if (error) { showMessage("message", "error", friendlyError(error)); return; }

    annForm.reset();
    showMessage("message", "success", "Announcement sent to all users!");
    loadNotifications();
});

(async () => {
    me = await initLayout("any");
    if (!me) return;
    if (me.role === "Admin") {
        document.getElementById("admin-announce-card").classList.remove("d-none");
    }
    await loadNotifications();
})();