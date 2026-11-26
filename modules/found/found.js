// MEMBER C - Module 5: Found Item (full CRUD). Students browse; admin adds/edits/deletes.
let me = null;
let isAdmin = false;
let allItems = [];
let modal = null;

function notify(type, message) {
  const msgType = type === "danger" ? "error" : type;
  if (typeof showMessage === "function" && document.getElementById("alertBox")) {
    showMessage("alerBox",type, message);
    return;
  }
  if (type === "danger") {
    alert("Error: " + message);
  } else {
    alert(message);
  }
}

function safeEscape(str) {
  if (typeof escapeHtml === "function") return escapeHtml(str);
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

(async function start() {
  // Use "any" so logged-in students and admins can view; change to null if public browsing is desired
  me = await initLayout("any");
  if (!me) return;

  isAdmin = me.role === "Admin";
  const addBtn = document.getElementById("addBtn");
  if (addBtn && isAdmin) addBtn.classList.remove("d-none");

  const modalEl = document.getElementById("itemModal");
  if (modalEl && typeof bootstrap !== "undefined") {
    modal = new bootstrap.Modal(modalEl);
  }

  const dateInput = document.getElementById("itemDate");
  if (dateInput) {
    dateInput.max = new Date().toISOString().split("T")[0];
  }

  await loadDropdowns(); // data sharing: categories + locations come from C2
  await loadItems();

  ["fSearch", "fCategory", "fLocation", "fStatus"].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener("input", render);
      el.addEventListener("change", render);
    }
  });
})();

async function loadDropdowns() {
  const [c, l] = await Promise.all([
    sb.from("category").select("id, name").order("name"),
    sb.from("location").select("id, name").order("name")
  ]);

  if (c.error) notify("danger", "Could not load categories: " + c.error.message);
  if (l.error) notify("danger", "Could not load locations: " + l.error.message);

  const opt = (rows, first) =>
    (first ? `<option value="">${safeEscape(first)}</option>` : "") +
    (rows || []).map(r => `<option value="${r.id}">${safeEscape(r.name)}</option>`).join("");

  const fCat = document.getElementById("fCategory");
  const fLoc = document.getElementById("fLocation");
  const iCat = document.getElementById("itemCategory");
  const iLoc = document.getElementById("itemLocation");

  if (fCat) fCat.innerHTML = opt(c.data, "All categories");
  if (fLoc) fLoc.innerHTML = opt(l.data, "All locations");
  if (iCat) iCat.innerHTML = opt(c.data, "Choose...");
  if (iLoc) iLoc.innerHTML = opt(l.data, "Choose...");
}

/* RETRIEVE */
async function loadItems() {
  const { data, error } = await sb
    .from("found_item")
    .select("*, category(name), location(name)")
    .order("created_at", { ascending: false });

  if (error) {
    notify("danger", "Could not load items: " + error.message);
    return;
  }

  allItems = data || [];
  render();
}

function render() {
  const s = (document.getElementById("fSearch")?.value || "").trim().toLowerCase();
  const cat = document.getElementById("fCategory")?.value || "";
  const loc = document.getElementById("fLocation")?.value || "";
  const st = document.getElementById("fStatus")?.value || "";

  const list = allItems.filter(i =>
    (!s || ((i.item_name || "") + " " + (i.description || "")).toLowerCase().includes(s)) &&
    (!cat || String(i.category_id) === cat) &&
    (!loc || String(i.location_id) === loc) &&
    (!st || i.status === st)
  );

  const container = document.getElementById("items");
  if (!container) return;

  container.innerHTML = list.length
    ? list.map(i => `
      <div class="col-sm-6 col-lg-4">
        <div class="card item-card h-100 shadow-sm">
          ${i.photo_url
            ? `<img src="${safeEscape(i.photo_url)}" class="card-img-top" alt="${safeEscape(i.item_name)}">`
            : '<div class="no-photo p-4 text-center text-muted bg-light">No photo</div>'}
          <div class="card-body">
            <div class="d-flex justify-content-between align-items-start gap-2">
              <h2 class="h6 mb-1">${safeEscape(i.item_name)}</h2>
              <span class="badge bg-secondary status-${safeEscape(i.status)}">${safeEscape(i.status)}</span>
            </div>
            <p class="small text-muted mb-1">
              ${safeEscape(i.category?.name || "—")} &middot;
              ${safeEscape(i.location?.name || "—")} &middot;
              ${safeEscape(i.date_found)}
            </p>
            <p class="small mb-0">${safeEscape(i.description || "")}</p>
          </div>
          <div class="card-footer bg-white d-flex gap-1">
            ${i.status === "Available" && !isAdmin
              ? `<a class="btn btn-sm btn-primary" href="../claim/claim-form.html?item=${i.id}">Claim this item</a>`
              : ""}
            ${isAdmin
              ? `<button type="button" class="btn btn-sm btn-outline-primary" onclick="openEdit(${i.id})">Edit</button>
                 <button type="button" class="btn btn-sm btn-outline-danger" onclick="deleteItem(${i.id}, '${safeEscape(i.item_name).replace(/'/g, "\\'")}')">Delete</button>`
              : ""}
          </div>
        </div>
      </div>`).join("")
    : '<div class="col-12"><div class="alert alert-light border">No items match. Try clearing the filters.</div></div>';
}

/* CREATE / UPDATE */
function openAdd() {
  document.getElementById("itemForm").reset();
  document.getElementById("itemId").value = "";
  document.getElementById("modalTitle").textContent = "Add found item";
  document.getElementById("itemDate").value = new Date().toISOString().split("T")[0];
  if (modal) modal.show();
}

async function openEdit(id) {
  const i = allItems.find(x => x.id === id);
  if (!i) return;

  document.getElementById("modalTitle").textContent = "Edit found item";
  document.getElementById("itemId").value = i.id;
  document.getElementById("itemName").value = i.item_name || "";
  document.getElementById("itemCategory").value = i.category_id ?? "";
  document.getElementById("itemLocation").value = i.location_id ?? "";
  document.getElementById("itemDate").value = i.date_found || "";
  document.getElementById("itemStatus").value = i.status || "Available";
  document.getElementById("itemDesc").value = i.description || "";
  document.getElementById("itemPhoto").value = "";

  const { data, error } = await sb
    .from("found_item_secret")
    .select("hidden_detail, storage_place")
    .eq("found_item_id", id)
    .maybeSingle();

  if (error) {
    notify("danger", "Could not load secret details: " + error.message);
  }

  document.getElementById("itemHidden").value = data?.hidden_detail || "";
  document.getElementById("itemStorage").value = data?.storage_place || "";
  if (modal) modal.show();
}

document.getElementById("itemForm").addEventListener("submit", async e => {
  e.preventDefault();
  console.log("1. submit start", { isAdmin, me });

  if (!isAdmin) {
    notify("danger", "Only Admin can add or edit found items.");
    return;
  }

  const id = document.getElementById("itemId").value;
  const v = k => (document.getElementById(k)?.value || "").trim();
  const file = document.getElementById("itemPhoto")?.files?.[0];
  const todayStr = new Date().toISOString().split("T")[0];

  // ---- input validation ----
  if (!v("itemName")) return notify("danger", "Item name is required.");
  if (!v("itemCategory")) return notify("danger", "Please choose a category.");
  if (!v("itemLocation")) return notify("danger", "Please choose the location found.");
  if (!v("itemDate")) return notify("danger", "Date found is required.");
  if (v("itemDate") > todayStr) return notify("danger", "Date found cannot be in the future.");
  if (!v("itemDesc")) return notify("danger", "Description is required.");
  if (!v("itemHidden")) return notify("danger", "Hidden detail is required so claims can be verified.");
  if (!v("itemStorage")) return notify("danger", "Storage place is required.");

  if (file) {
    if (!["image/jpeg", "image/png"].includes(file.type)) {
      return notify("danger", "Photo must be a JPG or PNG file.");
    }
    if (file.size > 2 * 1024 * 1024) {
      return notify("danger", "Photo must be smaller than 2 MB.");
    }
  }

  console.log("2. validation passed", { id, hasFile: !!file });

  const existingItem = id ? allItems.find(x => String(x.id) === String(id)) : null;
  const row = {
    item_name: v("itemName"),
    category_id: Number(v("itemCategory")),
    location_id: Number(v("itemLocation")),
    date_found: v("itemDate"),
    description: v("itemDesc"),
    status: v("itemStatus") || "Available",
    photo_url: existingItem?.photo_url || null
  };

  if (file) {
    const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${Date.now()}_${cleanName}`;
    console.log("3. uploading photo", path);
    const up = await sb.storage.from("item-photo").upload(path, file);
    console.log("4. upload result", up);
    if (up.error) {
      return notify("danger", "Photo upload failed: " + up.error.message);
    }
    row.photo_url = sb.storage.from("item-photo").getPublicUrl(path).data.publicUrl;
  }

  let itemId = id ? Number(id) : null;
  let error = null;

  console.log("5. saving found_item", { id, itemId, row });
  if (id) {
    const res = await sb.from("found_item").update(row).eq("id", itemId);
    console.log("6. update result", res);
    error = res.error;
  } else {
    const res = await sb
      .from("found_item")
      .insert({ ...row, created_by: me.id })
      .select("id")
      .single();
    console.log("6. insert result", res);
    error = res.error;
    itemId = res.data?.id;
  }

  if (error) {
    return notify("danger", error.message);
  }

  console.log("7. saving found_item_secret", { itemId });
  const sec = await sb
    .from("found_item_secret")
    .upsert({
      found_item_id: itemId,
      hidden_detail: v("itemHidden"),
      storage_place: v("itemStorage")
    });
  console.log("8. secret result", sec);

  if (sec.error) {
    return notify("danger", "Saved item, but failed to save secret details: " + sec.error.message);
  }

  console.log("9. finishing UI updates");
  notify("success", id ? "Item updated." : "Item added.");
  if (modal) modal.hide();
  await loadItems();
  console.log("10. done");
});

/* DELETE */
async function deleteItem(id, name) {
  if (!isAdmin) {
    return notify("danger", "Only Admin can delete found items.");
  }

  const { count, error: claimErr } = await sb
    .from("claim")
    .select("id", { count: "exact", head: true })
    .eq("found_item_id", id)
    .eq("status", "Approved");

  if (claimErr) {
    return notify("danger", "Could not check claims: " + claimErr.message);
  }
  if (count > 0) {
    return notify("danger", `Cannot delete "${name}": it has an approved claim.`);
  }

  if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;

  const { error } = await sb.from("found_item").delete().eq("id", id);
  if (error) {
    return notify("danger", error.message);
  }

  notify("success", "Item deleted.");
  await loadItems();
}