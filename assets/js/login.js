// =====================================================
// Login page (shared)
// =====================================================
initLayout(null);

const form = document.getElementById("login-form");

form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearMessage("message");
    clearFieldErrors(form);

    const loginId = document.getElementById("email").value.trim();   // email OR student ID
    const password = document.getElementById("password").value;

    // ---- Validation ----
    const errors = [];
    if (loginId === "") {
        errors.push("Email or student ID is required.");
        setFieldError("email", "Email or student ID is required.");
    }
    if (password === "") {
        errors.push("Password is required.");
        setFieldError("password", "Password is required.");
    }
    if (errors.length > 0) {
        showMessage("message", "error", errors);
        return;
    }

    // ---- Log in with Supabase Auth ----
    const btn = document.getElementById("login-btn");
    btn.disabled = true;

    // Supabase signs in with an email. If the user typed a student ID (no "@"),
    // ask the database which email belongs to that ID first.
    let email = loginId;
    if (!loginId.includes("@")) {
        const { data: foundEmail } = await sb.rpc("get_login_email", { p_student_id: loginId });
        if (!foundEmail) {
            showMessage("message", "error", "Wrong ID or password.");
            btn.disabled = false;
            return;
        }
        email = foundEmail;
    }

    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) {
        showMessage("message", "error", loginId.includes("@") ? friendlyError(error) : "Wrong ID or password.");
        btn.disabled = false;
        return;
    }

    // ---- Check the account is still active ----
    const { data: profile } = await sb.from("user_profile")
        .select("name, role, status").eq("id", data.user.id).single();

    if (!profile || profile.status === "Inactive") {
        await sb.auth.signOut();
        showMessage("message", "error", "Your account has been deactivated. Please contact the admin.");
        btn.disabled = false;
        return;
    }

    showMessage("message", "success", "Login successful. Welcome, " + profile.name + "!");
    setTimeout(() => { window.location.href = "index.html"; }, 1000);
});
