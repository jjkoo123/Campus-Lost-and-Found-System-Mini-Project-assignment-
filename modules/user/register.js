// =====================================================
// A1 User / Account - CREATE: register a new student account
// =====================================================
initLayout(null);

const form = document.getElementById("register-form");

form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearMessage("message");
    clearFieldErrors(form);

    // 1. Read the inputs
    const name = document.getElementById("name").value.trim();
    const studentId = document.getElementById("student-id").value.trim().toUpperCase();
    const email = document.getElementById("email").value.trim().toLowerCase();
    const phone = document.getElementById("phone").value.trim();
    const password = document.getElementById("password").value;
    const confirm = document.getElementById("confirm-password").value;

    // 2. Validate in the browser (instant messages)
    const errors = runChecks([
        ["name", validateName(name)],
        ["student-id", validateStudentId(studentId)],
        ["email", validateEmail(email)],
        ["phone", validatePhone(phone)],
        ["password", validatePassword(password)],
        ["confirm-password", validateConfirmPassword(password, confirm)]
    ]);
    if (errors.length > 0) {
        showMessage("message", "error", errors);
        return;
    }

    const btn = document.getElementById("register-btn");
    btn.disabled = true;

    // 3. No duplicate email / student ID (asks the database)
    const { data: duplicateMsg, error: checkError } = await sb.rpc("check_registration", {
        p_email: email, p_student_id: studentId
    });
    if (checkError || duplicateMsg) {
        showMessage("message", "error", duplicateMsg || friendlyError(checkError));
        if (duplicateMsg && duplicateMsg.includes("email")) setFieldError("email", duplicateMsg);
        if (duplicateMsg && duplicateMsg.includes("student ID")) setFieldError("student-id", duplicateMsg);
        btn.disabled = false;
        return;
    }

    // 4. Create the account in Supabase Auth.
    //    "data" is saved as user metadata; the DB trigger handle_new_user()
    //    copies it into the user_profile table.
    const { data, error } = await sb.auth.signUp({
        email: email,
        password: password,
        options: { data: { name: name, student_id: studentId, phone: phone } }
    });

    if (error) {
        showMessage("message", "error", friendlyError(error));
        btn.disabled = false;
        return;
    }

    // 5. Success
    form.reset();
    if (data.session) {
        showMessage("message", "success", "Account created! Redirecting to home page...");
        setTimeout(() => { window.location.href = "index.html"; }, 1500);
    } else {
        // Happens if "Confirm email" is turned ON in Supabase
        showMessage("message", "success", "Account created! Please check your email to confirm, then log in.");
    }
    btn.disabled = false;
});
