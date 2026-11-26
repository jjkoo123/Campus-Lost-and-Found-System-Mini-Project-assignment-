// MEMBER C - Module 6: Category & Location (full CRUD, admin only)
let map = null;
let markerLayer = null;
let clickMarker = null;

// type: "danger" or "success"; shown in the #message box at the top of the page
function notify(type, message) {
  if (typeof showMessage === "function" && document.getElementById("message")) {
    showMessage("message", type === "danger" ? "error" : "success", message);
    window.scrollTo({ top: 0, behavior: "smooth" });
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

function escapeAttr(str) {
  return safeEscape(str).replaceAll("'", "&#39;");
}

(async function start() {
  const profile = await initLayout("Admin");
  if (!profile) return;
  initMap();
  await Promise.all([loadCategories(), loadLocations()]);
})();

/* ---------------- CATEGORIES ---------------- */
async function loadCategories() { // RETRIEVE
  const { data, error } = await sb.from("category").select("*").order("name");
  if (error) {
    notify("danger", "Could not load categories: " + error.message);
    return;
  }

  const tbody = document.getElementById("catBody");
  if (!tbody) return;

  tbody.innerHTML = data && data.length
    ? data.map(c => {
        const encoded = encodeURIComponent(JSON.stringify(c));
        return `
          <tr>
            <td>${safeEscape(c.name)}</td>
            <td>${safeEscape(c.description || "")}</td>
            <td class="text-end">
              <button type="button" class="btn btn-sm btn-outline-primary" onclick="editCategoryEncoded('${encoded}')">Edit</button>
              <button type="button" class="btn btn-sm btn-outline-danger" onclick="deleteCategory(${c.id}, '${escapeAttr(c.name).replace(/'/g, "\\'")}')">Delete</button>
            </td>
          </tr>`;
      }).join("")
    : '<tr><td colspan="3" class="text-muted">No categories yet. Add the first one above.</td></tr>';
}

function editCategoryEncoded(encoded) {
  const c = JSON.parse(decodeURIComponent(encoded));
  editCategory(c);
}

document.getElementById("catForm").addEventListener("submit", async e => {
  e.preventDefault();
  const id = document.getElementById("catId").value;
  const name = document.getElementById("catName").value.trim();
  const description = document.getElementById("catDesc").value.trim();

  if (!name) return notify("danger", "Category name is required.");
  if (name.length < 2) return notify("danger", "Category name must be at least 2 characters.");

  const q = id
    ? sb.from("category").update({ name, description }).eq("id", id)
    : sb.from("category").insert({ name, description });

  const { error } = await q;
  if (error) {
    return notify("danger", error.code === "23505" ? `"${name}" already exists.` : error.message);
  }

  notify("success", id ? "Category updated." : "Category added.");
  resetCategoryForm();
  await loadCategories();
});

function editCategory(c) {
  document.getElementById("catId").value = c.id;
  document.getElementById("catName").value = c.name || "";
  document.getElementById("catDesc").value = c.description || "";
  document.getElementById("catSave").textContent = "Save changes";
  document.getElementById("catCancel").classList.remove("d-none");
}

function resetCategoryForm() {
  document.getElementById("catForm").reset();
  document.getElementById("catId").value = "";
  document.getElementById("catSave").textContent = "Add category";
  document.getElementById("catCancel").classList.add("d-none");
}

document.getElementById("catCancel").addEventListener("click", resetCategoryForm);

async function deleteCategory(id, name) { // DELETE
  const [f, l] = await Promise.all([
    sb.from("found_item").select("id", { count: "exact", head: true }).eq("category_id", id),
    sb.from("lost_report").select("id", { count: "exact", head: true }).eq("category_id", id)
  ]);

  if (f.error || l.error) {
    return notify("danger", "Could not verify category usage before deleting.");
  }

  const used = (f.count || 0) + (l.count || 0);
  if (used > 0) {
    return notify("danger", `Cannot delete "${name}": it is used by ${used} item(s)/report(s).`);
  }
  if (!confirm(`Delete category "${name}"?`)) return;

  const { error } = await sb.from("category").delete().eq("id", id);
  if (error) return notify("danger", error.message);

  notify("success", "Category deleted.");
  await loadCategories();
}

/* ---------------- LOCATIONS ---------------- */
function initMap() {
  map = L.map("map").setView([3.2147, 101.7290], 16);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap"
  }).addTo(map);
  markerLayer = L.layerGroup().addTo(map);

  map.on("click", e => {
    document.getElementById("locLat").value = e.latlng.lat.toFixed(6);
    document.getElementById("locLng").value = e.latlng.lng.toFixed(6);
    if (clickMarker) map.removeLayer(clickMarker);
    clickMarker = L.marker(e.latlng, { opacity: 0.6 }).addTo(map);
  });
}

async function loadLocations() { // RETRIEVE
  const { data, error } = await sb.from("location").select("*").order("name");
  if (error) {
    notify("danger", "Could not load locations: " + error.message);
    return;
  }

  markerLayer.clearLayers();
  (data || []).forEach(l => {
    if (l.latitude != null && l.longitude != null) {
      L.marker([l.latitude, l.longitude]).bindPopup(safeEscape(l.name)).addTo(markerLayer);
    }
  });

  const tbody = document.getElementById("locBody");
  if (!tbody) return;

  tbody.innerHTML = data && data.length
    ? data.map(l => {
        const encoded = encodeURIComponent(JSON.stringify(l));
        const coords = l.latitude != null && l.longitude != null
          ? `${Number(l.latitude).toFixed(4)}, ${Number(l.longitude).toFixed(4)}`
          : "-";
        return `
          <tr>
            <td>${safeEscape(l.name)}</td>
            <td class="small">${safeEscape(coords)}</td>
            <td class="text-end">
              <button type="button" class="btn btn-sm btn-outline-primary" onclick="editLocationEncoded('${encoded}')">Edit</button>
              <button type="button" class="btn btn-sm btn-outline-danger" onclick="deleteLocation(${l.id}, '${escapeAttr(l.name).replace(/'/g, "\\'")}')">Delete</button>
            </td>
          </tr>`;
      }).join("")
    : '<tr><td colspan="3" class="text-muted">No locations yet. Add the first one above.</td></tr>';
}

function editLocationEncoded(encoded) {
  const l = JSON.parse(decodeURIComponent(encoded));
  editLocation(l);
}

document.getElementById("locForm").addEventListener("submit", async e => {
  e.preventDefault();
  const id = document.getElementById("locId").value;
  const name = document.getElementById("locName").value.trim();
  const latText = document.getElementById("locLat").value.trim();
  const lngText = document.getElementById("locLng").value.trim();

  if (!name) return notify("danger", "Location name is required.");

  let latitude = null;
  let longitude = null;
  if (latText || lngText) {
    if (latText === "" || lngText === "") {
      return notify("danger", "Enter both latitude and longitude as numbers, or leave both empty.");
    }
    latitude = Number(latText);
    longitude = Number(lngText);
    if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
      return notify("danger", "Latitude and longitude must be valid numbers.");
    }
    if (latitude < -90 || latitude > 90) {
      return notify("danger", "Latitude must be between -90 and 90.");
    }
    if (longitude < -180 || longitude > 180) {
      return notify("danger", "Longitude must be between -180 and 180.");
    }
  }

  const row = { name, latitude, longitude };
  const q = id
    ? sb.from("location").update(row).eq("id", id)
    : sb.from("location").insert(row);

  const { error } = await q;
  if (error) {
    return notify("danger", error.code === "23505" ? `"${name}" already exists.` : error.message);
  }

  notify("success", id ? "Location updated." : "Location added.");
  resetLocationForm();
  await loadLocations();
});

function editLocation(l) {
  document.getElementById("locId").value = l.id;
  document.getElementById("locName").value = l.name || "";
  document.getElementById("locLat").value = l.latitude ?? "";
  document.getElementById("locLng").value = l.longitude ?? "";
  document.getElementById("locSave").textContent = "Save changes";
  document.getElementById("locCancel").classList.remove("d-none");
  if (l.latitude != null && l.longitude != null && map) {
    map.setView([l.latitude, l.longitude], 17);
  }
}

function resetLocationForm() {
  document.getElementById("locForm").reset();
  document.getElementById("locId").value = "";
  document.getElementById("locSave").textContent = "Add location";
  document.getElementById("locCancel").classList.add("d-none");
  if (clickMarker && map) {
    map.removeLayer(clickMarker);
    clickMarker = null;
  }
}

document.getElementById("locCancel").addEventListener("click", resetLocationForm);

async function deleteLocation(id, name) { // DELETE
  const [f, l] = await Promise.all([
    sb.from("found_item").select("id", { count: "exact", head: true }).eq("location_id", id),
    sb.from("lost_report").select("id", { count: "exact", head: true }).eq("location_id", id)
  ]);

  if (f.error || l.error) {
    return notify("danger", "Could not verify location usage before deleting.");
  }

  const used = (f.count || 0) + (l.count || 0);
  if (used > 0) {
    return notify("danger", `Cannot delete "${name}": it is used by ${used} item(s)/report(s).`);
  }
  if (!confirm(`Delete location "${name}"?`)) return;

  const { error } = await sb.from("location").delete().eq("id", id);
  if (error) return notify("danger", error.message);

  notify("success", "Location deleted.");
  await loadLocations();
}