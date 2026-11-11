// =====================================================
// A1 User / Account
//   RETRIEVE: view own profile
//   UPDATE:   edit profile (name, phone), change password
// =====================================================
let me = null;   // logged-in user's profile

async function loadProfile() {
    me = await initLayout("any");   // any logged-in user
    if (!me) return;

    // Show profile details
    showProfileHead(me);
    document.getElementById("view-user-no").textContent = displayId("U", me.user_no);
    document.getElementById("view-student-id").textContent = me.student_id;
    document.getElementById("view-phone").textContent = me.phone;
    document.getElementById("view-joined").textContent = formatDate(me.created_at);

    // Fill the edit form with current values
    document.getElementById("name").value = me.name;
    document.getElementById("phone").value = me.phone;
}

// ---------- UPDATE: edit profile ----------
const profileForm = document.getElementById("profile-form");

profileForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearMessage("profile-message");
    clearFieldErrors(profileForm);

    const name = document.getElementById("name").value.trim();
    const phone = document.getElementById("phone").value.trim();

    const errors = runChecks([
        ["name", validateName(name)],
        ["phone", validatePhone(phone)]
    ]);
    if (errors.length > 0) {
        showMessage("profile-message", "error", errors);
        return;
    }

    const { error } = await sb.from("user_profile")
        .update({ name: name, phone: phone })
        .eq("id", me.id);

    if (error) {
        showMessage("profile-message", "error", friendlyError(error));
        return;
    }

    showMessage("profile-message", "success", "Profile updated successfully.");
    await loadProfile();   // refresh the view + navbar name
});

// ---------- UPDATE: change password ----------
const passwordForm = document.getElementById("password-form");

passwordForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearMessage("password-message");
    clearFieldErrors(passwordForm);

    const oldPassword = document.getElementById("old-password").value;
    const newPassword = document.getElementById("new-password").value;
    const confirm = document.getElementById("confirm-password").value;

    const errors = runChecks([
        ["old-password", oldPassword === "" ? "Current password is required." : ""],
        ["new-password", validatePassword(newPassword)],
        ["confirm-password", validateConfirmPassword(newPassword, confirm)]
    ]);
    if (newPassword !== "" && newPassword === oldPassword) {
        errors.push("New password must be different from the current password.");
        setFieldError("new-password", "Must be different from the current password.");
    }
    if (errors.length > 0) {
        showMessage("password-message", "error", errors);
        return;
    }

    // 1. Check the old password is correct by logging in with it again
    const { error: loginError } = await sb.auth.signInWithPassword({
        email: me.email, password: oldPassword
    });
    if (loginError) {
        setFieldError("old-password", "Current password is incorrect.");
        showMessage("password-message", "error", "Current password is incorrect.");
        return;
    }

    // 2. Save the new password
    const { error } = await sb.auth.updateUser({ password: newPassword });
    if (error) {
        showMessage("password-message", "error", friendlyError(error));
        return;
    }

    passwordForm.reset();
    showMessage("password-message", "success", "Password changed successfully.");
});

loadProfile();
