// =====================================================
// Login page (shared)
// =====================================================
initLayout(null);

const form = document.getElementById("login-form");

form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearMessage("message");
    clearFieldErrors(form);

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    // ---- Validation ----
    const errors = [];
    if (email === "") {
        errors.push("Email is required.");
        setFieldError("email", "Email is required.");
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

    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) {
        showMessage("message", "error", friendlyError(error));
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
