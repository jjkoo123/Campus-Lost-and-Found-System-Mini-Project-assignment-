// =====================================================
// A1 User / Account - validation rules (used by register + profile)
// The same rules are also in database/schema.sql as CHECK constraints.
// =====================================================

const STUDENT_ID_PATTERN = /^2\d{6}$/;               // "2" + 6 digits, e.g. 2412345
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;   // something@something.something
const PHONE_PATTERN = /^01\d-?\d{7,8}$/;              // Malaysian mobile, e.g. 012-3456789
const MIN_PASSWORD = 8;

// Each function returns an error message, or "" if the value is OK.
function validateName(name) {
    if (name === "") return "Full name is required.";
    if (name.length < 2) return "Full name must be at least 2 characters.";
    return "";
}

function validateStudentId(id) {
    if (id === "") return "Student ID is required.";
    if (!STUDENT_ID_PATTERN.test(id)) return "Student ID must be 7 digits starting with 2 (e.g. 2412345).";
    return "";
}

function validateEmail(email) {
    if (email === "") return "Email is required.";
    if (!EMAIL_PATTERN.test(email)) return "Email format is invalid (e.g. name@student.edu.my).";
    return "";
}

function validatePhone(phone) {
    if (phone === "") return "Phone number is required.";
    if (!PHONE_PATTERN.test(phone)) return "Phone must be a Malaysian mobile number, e.g. 012-3456789.";
    return "";
}

function validatePassword(password) {
    if (password === "") return "Password is required.";
    if (password.length < MIN_PASSWORD) return "Password must be at least " + MIN_PASSWORD + " characters.";
    return "";
}

function validateConfirmPassword(password, confirm) {
    if (confirm === "") return "Please confirm your password.";
    if (password !== confirm) return "Passwords do not match.";
    return "";
}

// Runs a list of [inputId, errorMessage] checks.
// Marks every bad field red and returns all the error messages.
function runChecks(checks) {
    const errors = [];
    checks.forEach(([inputId, message]) => {
        if (message !== "") {
            errors.push(message);
            setFieldError(inputId, message);
        }
    });
    return errors;
}
