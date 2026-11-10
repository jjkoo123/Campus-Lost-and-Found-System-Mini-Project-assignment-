// =====================================================
// Chat module - live chat between each student and the admin
//   CREATE:   send a message
//   RETRIEVE: view the conversation (admin: list of students + conversation)
//   UPDATE:   edit your own message
//   DELETE:   delete your own message
// Live updates use Supabase Realtime (new messages appear without refreshing).
// =====================================================
let me = null;
let currentStudentId = null;   // whose conversation is open
let editingId = null;          // id of the message being edited (null = sending new)
let students = [];             // admin: all students for the list

const MAX_LENGTH = 500;
const form = document.getElementById("chat-form");
const input = document.getElementById("chat-input");
const sendBtn = document.getElementById("send-btn");

// "2026-11-10T09:05:00Z" -> "10/11/2026 17:05"
function formatDateTime(value) {
    const d = new Date(value);
    return formatDate(value) + " " +
        String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
}

// ---------- RETRIEVE: load messages of the open conversation ----------
async function loadMessages() {
    if (!currentStudentId) return;

    // sender:user_profile!sender_id(...) = join to get the sender's name and role
    const { data, error } = await sb.from("chat_message")
        .select("*, sender:user_profile!sender_id(name, role)")
        .eq("student_id", currentStudentId)
        .order("created_at", { ascending: true });

    if (error) { showMessage("message", "error", friendlyError(error)); return; }

    const list = document.getElementById("message-list");
    if (data.length === 0) {
        list.innerHTML = "<p class='text-muted text-center mt-5'>No messages yet. Say hello!</p>";
        return;
    }

    list.innerHTML = data.map(m => {
        const mine = m.sender_id === me.id;
        const who = m.sender.role === "Admin" ? "Security Office" : m.sender.name;
        const actions = mine
            ? " · <a href='#' class='edit-link' data-id='" + m.id + "'>Edit</a>" +
              " · <a href='#' class='delete-link text-danger' data-id='" + m.id + "'>Delete</a>"
            : "";
        return "<div class='d-flex mb-3 " + (mine ? "justify-content-end" : "") + "'>" +
            "<div class='bubble'>" +
              "<div class='small text-muted " + (mine ? "text-end" : "") + "'>" + escapeHtml(who) + "</div>" +
              "<div class='p-2 rounded-3 " + (mine ? "bg-primary text-white" : "bg-white border") + "' data-text-id='" + m.id + "'>" +
                escapeHtml(m.message) + "</div>" +
              "<div class='small text-muted " + (mine ? "text-end" : "") + "'>" +
                formatDateTime(m.created_at) + (m.is_edited ? " (edited)" : "") + actions + "</div>" +
            "</div></div>";
    }).join("");

    list.scrollTop = list.scrollHeight;   // jump to newest message
}

// ---------- Admin: list of students ----------
async function loadStudents() {
    const { data: users, error } = await sb.from("user_profile")
        .select("id, name, student_id").eq("role", "Student").order("name");
    if (error) { showMessage("message", "error", friendlyError(error)); return; }

    // Latest message per student (to sort and show a preview)
    const { data: msgs } = await sb.from("chat_message")
        .select("student_id, message, created_at").order("created_at", { ascending: false });
    const latest = {};
    (msgs || []).forEach(m => { if (!latest[m.student_id]) latest[m.student_id] = m; });

    students = users.map(u => ({ ...u, last: latest[u.id] || null }));
    // Students with recent messages first
    students.sort((a, b) => (b.last ? new Date(b.last.created_at) : 0) - (a.last ? new Date(a.last.created_at) : 0));
    showStudents();
}

function showStudents() {
    const keyword = document.getElementById("conv-search").value.trim().toLowerCase();
    const shown = students.filter(s =>
        s.name.toLowerCase().includes(keyword) || s.student_id.toLowerCase().includes(keyword));

    const box = document.getElementById("conv-list");
    if (shown.length === 0) {
        box.innerHTML = "<div class='p-3 text-muted small'>No students found.</div>";
        return;
    }
    box.innerHTML = shown.map(s =>
        "<button type='button' class='list-group-item list-group-item-action conv-item" +
        (s.id === currentStudentId ? " active" : "") + "' data-id='" + s.id + "'>" +
        "<div class='fw-semibold'>" + escapeHtml(s.name) + " <span class='small text-muted'>" + escapeHtml(s.student_id) + "</span></div>" +
        "<div class='small text-muted text-truncate'>" + (s.last ? escapeHtml(s.last.message) : "No messages") + "</div>" +
        "</button>").join("");
}

document.getElementById("conv-list").addEventListener("click", (e) => {
    const item = e.target.closest(".conv-item");
    if (!item) return;
    openConversation(item.dataset.id);
});

document.getElementById("conv-search").addEventListener("input", showStudents);

function openConversation(studentId) {
    currentStudentId = studentId;
    cancelEdit();
    const s = students.find(x => x.id === studentId);
    document.getElementById("chat-title").textContent = "Chat with " + (s ? s.name + " (" + s.student_id + ")" : "student");
    sendBtn.disabled = false;
    showStudents();
    loadMessages();
}

// ---------- Validation ----------
input.addEventListener("input", () => {
    document.getElementById("char-count").textContent = input.value.length;
});

function validateMessage(text) {
    if (text === "") return "Message cannot be empty.";
    if (text.length > MAX_LENGTH) return "Message cannot be longer than " + MAX_LENGTH + " characters.";
    return "";
}

// ---------- CREATE (send) and UPDATE (save edit) ----------
form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearMessage("message");
    clearFieldErrors(form);

    const text = input.value.trim();
    const err = validateMessage(text);
    if (err) {
        setFieldError("chat-input", err);
        showMessage("message", "error", err);
        return;
    }
    if (!currentStudentId) {
        showMessage("message", "error", "Please select a student first.");
        return;
    }

    sendBtn.disabled = true;
    let result;
    if (editingId) {
        // UPDATE: only your own message (also enforced by RLS)
        result = await sb.from("chat_message").update({ message: text })
            .eq("id", editingId).eq("sender_id", me.id).select();
    } else {
        // CREATE
        result = await sb.from("chat_message").insert({
            student_id: currentStudentId, sender_id: me.id, message: text
        }).select();
    }
    sendBtn.disabled = false;

    if (result.error) {
        showMessage("message", "error", friendlyError(result.error));
        return;
    }
    if (result.data.length === 0) {
        showMessage("message", "error", "This message can no longer be changed.");
        return;
    }

    showMessage("message", "success", editingId ? "Message updated." : "Message sent.");
    setTimeout(() => clearMessage("message"), 2000);
    form.reset();
    document.getElementById("char-count").textContent = 0;
    cancelEdit();
    loadMessages();
    if (me.role === "Admin") loadStudents();
});

// Press Enter to send, Shift+Enter for a new line
input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        form.requestSubmit();
    }
});

// ---------- Edit / Delete links on your own messages ----------
document.getElementById("message-list").addEventListener("click", async (e) => {
    const editLink = e.target.closest(".edit-link");
    const deleteLink = e.target.closest(".delete-link");

    if (editLink) {
        e.preventDefault();
        editingId = Number(editLink.dataset.id);
        input.value = document.querySelector("[data-text-id='" + editingId + "']").textContent;
        document.getElementById("char-count").textContent = input.value.length;
        document.getElementById("edit-hint").classList.remove("d-none");
        sendBtn.textContent = "Save";
        input.focus();
    }

    if (deleteLink) {
        e.preventDefault();
        if (!confirm("Delete this message? This cannot be undone.")) return;

        // DELETE: only your own message (also enforced by RLS)
        const { data, error } = await sb.from("chat_message")
            .delete().eq("id", deleteLink.dataset.id).eq("sender_id", me.id).select();
        if (error) { showMessage("message", "error", friendlyError(error)); return; }
        if (data.length === 0) { showMessage("message", "error", "This message could not be deleted."); return; }

        showMessage("message", "success", "Message deleted.");
        setTimeout(() => clearMessage("message"), 2000);
        loadMessages();
        if (me.role === "Admin") loadStudents();
    }
});

function cancelEdit() {
    editingId = null;
    sendBtn.textContent = "Send";
    document.getElementById("edit-hint").classList.add("d-none");
}

document.getElementById("cancel-edit").addEventListener("click", (e) => {
    e.preventDefault();
    cancelEdit();
    form.reset();
    document.getElementById("char-count").textContent = 0;
});

// ---------- Live updates (Supabase Realtime) ----------
function startLive() {
    sb.channel("chat-room")
        .on("postgres_changes", { event: "*", schema: "public", table: "chat_message" }, (payload) => {
            // Reload if the change belongs to the open conversation (deletes only carry the id, so always reload)
            const row = payload.new && payload.new.student_id ? payload.new : null;
            if (!row || row.student_id === currentStudentId) loadMessages();
            if (me.role === "Admin") loadStudents();
        })
        .subscribe((status) => {
            const badge = document.getElementById("live-badge");
            const live = status === "SUBSCRIBED";
            badge.textContent = live ? "● Live" : "○ Offline";
            badge.className = "badge " + (live ? "bg-success" : "bg-secondary");
        });
}

// ---------- Start ----------
(async () => {
    me = await initLayout("any");
    if (!me) return;

    if (me.role === "Admin") {
        document.getElementById("conv-panel").classList.remove("d-none");
        document.getElementById("chat-title").textContent = "Select a student";
        await loadStudents();
    } else {
        // A student always chats in their own conversation
        currentStudentId = me.id;
        sendBtn.disabled = false;
        await loadMessages();
    }
    startLive();
})();
