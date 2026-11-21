// =====================================================
// B1 Lost Report
//   CREATE: report a lost item (+ upload photo + run auto-match)
//   UPDATE: edit own lost report
// =====================================================
let me = null;
const editId = getQueryParam("id");       // null = Create mode, number = Edit mode
let existingPhotoUrl = null;              // keeps the old photo if user doesn't upload a new one

const form = document.getElementById("lost-form");
const descInput = document.getElementById("description");
const photoInput = document.getElementById("photo");
const photoPreview = document.getElementById("photo-preview");

// Prevent picking a future date in the calendar picker
const todayStr = new Date().toISOString().split("T")[0];
document.getElementById("date-lost").max = todayStr;

// Live character counter
descInput.addEventListener("input", () => {
    document.getElementById("desc-count").textContent = descInput.value.length;
});

// Live image preview when user picks a file
photoInput.addEventListener("change", () => {
    const file = photoInput.files[0];
    if (file && (file.type === "image/jpeg" || file.type === "image/png")) {
        photoPreview.src = URL.createObjectURL(file);
        photoPreview.classList.remove("d-none");
    } else if (!existingPhotoUrl) {
        photoPreview.classList.add("d-none");
    }
});

// ---------- 1. Load Categories & Locations from DB ----------
async function loadDropdowns() {
    const [catRes, locRes] = await Promise.all([
        sb.from("category").select("id, name").order("name"),
        sb.from("location").select("id, name").order("name")
    ]);

    if (catRes.data) {
        const catSelect = document.getElementById("category-id");
        catRes.data.forEach(c => {
            const opt = document.createElement("option");
            opt.value = c.id;
            opt.textContent = c.name;
            catSelect.appendChild(opt);
        });
    }

    if (locRes.data) {
        const locSelect = document.getElementById("location-id");
        locRes.data.forEach(l => {
            const opt = document.createElement("option");
            opt.value = l.id;
            opt.textContent = l.name;
            locSelect.appendChild(opt);
        });
    }
}

// ---------- 2. Edit Mode: Load existing report ----------
async function loadReportForEdit() {
    document.getElementById("page-title").textContent = "Edit Lost Report";
    document.getElementById("submit-btn").textContent = "Save Changes";

    const { data: report, error } = await sb.from("lost_report")
        .select("*").eq("id", editId).single();

    if (error || !report) {
        showMessage("message", "error", "Lost report not found.");
        form.querySelectorAll("input, select, textarea, button").forEach(el => el.disabled = true);
        return;
    }

    // Owner-only check (also enforced by RLS in Supabase)
    if (report.user_id !== me.id) {
        showMessage("message", "error", "You can only edit your own lost reports.");
        form.querySelectorAll("input, select, textarea, button").forEach(el => el.disabled = true);
        return;
    }

    document.getElementById("item-name").value = report.item_name;
    document.getElementById("category-id").value = report.category_id;
    document.getElementById("location-id").value = report.location_id;
    document.getElementById("date-lost").value = report.date_lost;
    descInput.value = report.description;
    document.getElementById("desc-count").textContent = report.description.length;

    if (report.photo_url) {
        existingPhotoUrl = report.photo_url;
        photoPreview.src = report.photo_url;
        photoPreview.classList.remove("d-none");
    }
}

// ---------- 3. Validation (B1 rules) ----------
function validateForm(itemName, categoryId, locationId, dateLost, description, file) {
    const errors = [];

    if (itemName === "") {
        errors.push("Item name is required.");
        setFieldError("item-name", "Item name is required.");
        } else if (!/[a-zA-Z]/.test(itemName)) {
        errors.push("Item name must contain letters (cannot be numbers only).");
        setFieldError("item-name", "Item name cannot be numbers only.");
    } else if (itemName.length < 2) {
        errors.push("Item name must be at least 2 characters.");
        setFieldError("item-name", "At least 2 characters.");
    }
    
    if (categoryId === "") {
        errors.push("Please select a category.");
        setFieldError("category-id", "Category is required.");
    }
    if (locationId === "") {
        errors.push("Please select a location.");
        setFieldError("location-id", "Location is required.");
    }
    if (dateLost === "") {
        errors.push("Date lost is required.");
        setFieldError("date-lost", "Date lost is required.");
    } else if (dateLost > todayStr) {
        errors.push("Date lost cannot be in the future.");
        setFieldError("date-lost", "Date cannot be in the future.");
    }
    if (description === "") {
        errors.push("Description is required.");
        setFieldError("description", "Description is required.");
    }

    // Image check: optional, but if provided must be JPG/PNG and under 2 MB
    if (file) {
        const validTypes = ["image/jpeg", "image/png"];
        const maxBytes = 2 * 1024 * 1024; // 2 MB
        if (!validTypes.includes(file.type)) {
            errors.push("Photo must be a JPG or PNG image.");
            setFieldError("photo", "Only JPG or PNG files are allowed.");
        } else if (file.size > maxBytes) {
            errors.push("Photo must be smaller than 2 MB.");
            setFieldError("photo", "File size must be under 2 MB.");
        }
    }

    return errors;
}

// ---------- 4. Upload Photo to Supabase Storage ----------
async function uploadPhoto(file) {
    const ext = file.name.split(".").pop().toLowerCase();
    const filePath = me.id + "/" + Date.now() + "." + ext;

    const { error } = await sb.storage.from("lost-photos").upload(filePath, file);
    if (error) throw error;

    const { data } = sb.storage.from("lost-photos").getPublicUrl(filePath);
    return data.publicUrl;
}

// ---------- 5. Unique Feature: Auto-Match ----------
// Checks found_item for: same category + same location + date within 7 days + matching keyword
async function runAutoMatch(lostReport) {
    const lostDate = new Date(lostReport.date_lost);
    const minDate = new Date(lostDate); minDate.setDate(minDate.getDate() - 7);
    const maxDate = new Date(lostDate); maxDate.setDate(maxDate.getDate() + 7);

    const { data: candidates } = await sb.from("found_item")
        .select("id, item_name, description, date_found")
        .eq("status", "Available")
        .eq("category_id", lostReport.category_id)
        .eq("location_id", lostReport.location_id)
        .gte("date_found", minDate.toISOString().split("T")[0])
        .lte("date_found", maxDate.toISOString().split("T")[0]);

    if (!candidates || candidates.length === 0) return 0;

    // Extract keywords (words >= 3 letters) from the lost report
    const ignore = ["the", "and", "with", "for", "was", "lost", "near", "from", "this", "that"];
    const words = (lostReport.item_name + " " + lostReport.description)
        .toLowerCase().match(/[a-z0-9]+/g) || [];
    const keywords = [...new Set(words.filter(w => w.length >= 3 && !ignore.includes(w)))];

    let matchCount = 0;
    for (const item of candidates) {
        const foundText = (item.item_name + " " + item.description).toLowerCase();
        const hasKeywordMatch = keywords.some(k => foundText.includes(k));

        if (hasKeywordMatch) {
            matchCount++;
            await sb.from("notification").insert({
                user_id: me.id,
                title: "Possible Match Found!",
                message: "Your lost report \"" + lostReport.item_name + "\" may match found item " +
                    displayId("FI", item.id) + " (" + item.item_name + "). Check Found Items to claim it.",
                type: "Match"
            });
        }
    }
    return matchCount;
}

// ---------- 6. Form Submit ----------
form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearMessage("message");
    clearFieldErrors(form);

    const itemName = document.getElementById("item-name").value.trim();
    const categoryId = document.getElementById("category-id").value;
    const locationId = document.getElementById("location-id").value;
    const dateLost = document.getElementById("date-lost").value;
    const description = descInput.value.trim();
    const file = photoInput.files[0] || null;

    const errors = validateForm(itemName, categoryId, locationId, dateLost, description, file);
    if (errors.length > 0) {
        showMessage("message", "error", errors);
        return;
    }

    const btn = document.getElementById("submit-btn");
    btn.disabled = true;

    try {
        // Upload new photo if selected; otherwise keep existing one
        let photoUrl = existingPhotoUrl;
        if (file) {
            photoUrl = await uploadPhoto(file);
        }

        const payload = {
            item_name: itemName,
            category_id: Number(categoryId),
            location_id: Number(locationId),
            date_lost: dateLost,
            description: description,
            photo_url: photoUrl
        };

        if (editId) {
            // UPDATE
            const { error } = await sb.from("lost_report")
                .update(payload).eq("id", editId).eq("user_id", me.id);
            if (error) throw error;

            showMessage("message", "success", "Lost report updated! Redirecting...");
        } else {
            // CREATE
            const { data: created, error } = await sb.from("lost_report")
                .insert({ ...payload, user_id: me.id }).select().single();
            if (error) throw error;

            const matches = await runAutoMatch(created);
            const matchNote = matches > 0
                ? " 🎉 " + matches + " possible match(es) found — check your Notifications!"
                : "";
            showMessage("message", "success", "Lost report submitted!" + matchNote + " Redirecting...");
        }

        setTimeout(() => { window.location.href = "my-lost-reports.html"; }, 1800);
    } catch (err) {
        showMessage("message", "error", friendlyError(err));
        btn.disabled = false;
    }
});

// ---------- Start ----------
(async () => {
    me = await initLayout("Student");
    if (!me) return;
    await loadDropdowns();
    if (editId) await loadReportForEdit();
})();