// =====================================================
// Shared layout ("master page"): sidebar + top bar + footer for every page.
//
// How to use on a page:
//   1. <body data-root="../../">   (path back to the project root; "" for root pages)
//   2. <div id="navbar"></div> ... <div id="footer"></div>
//   3. In the page script:   const me = await initLayout("Student");
//      access: null = public page, "any" = must log in,
//              "Student" / "Admin" = only that role
//      Returns the logged-in user's profile (or null).
// =====================================================

const ROOT = document.body.dataset.root || "";

// Fonts and icons used by the layout (loaded once here, so pages do not need extra <link> tags)
function addStylesheet(href) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
}
addStylesheet("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Plus+Jakarta+Sans:wght@600;700&display=swap");
addStylesheet("https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css");

// Links shown in the sidebar for each role. Teammates: add your pages here.
// icon = a Bootstrap Icons name (https://icons.getbootstrap.com)
const NAV_LINKS = {
    guest: [
        { text: "Home", href: "index.html", icon: "house" },
        { text: "Login", href: "login.html", icon: "box-arrow-in-right" },
        { text: "Register", href: "register.html", icon: "person-plus" }
    ],
    Student: [
        { text: "Dashboard", href: "index.html", icon: "house" },
        { text: "My Claims", href: "modules/claim/my-claims.html", icon: "patch-check" },
        { text: "Chat", href: "modules/chat/chat.html", icon: "chat-dots" },
        { text: "My Profile", href: "modules/user/profile.html", icon: "person" }
    ],
    Admin: [
        { text: "Dashboard", href: "index.html", icon: "house" },
        { text: "Claims", href: "modules/claim/admin-claims.html", icon: "clipboard-check" },
        { text: "Users", href: "modules/user/admin-users.html", icon: "people" },
        { text: "Chat", href: "modules/chat/chat.html", icon: "chat-dots" },
        { text: "My Profile", href: "modules/user/profile.html", icon: "person" }
    ]
};

async function initLayout(access) {
    let profile = null;

    // 1. Who is logged in?
    const { data: { session } } = await sb.auth.getSession();
    if (session) {
        const { data } = await sb.from("user_profile")
            .select("*").eq("id", session.user.id).single();
        profile = data;

        // Deactivated users are logged out straight away
        if (profile && profile.status === "Inactive") {
            await sb.auth.signOut();
            alert("Your account has been deactivated. Please contact the admin.");
            window.location.href = ROOT + "login.html";
            return null;
        }
    }

    // 2. Page protection
    if (access && !profile) {
        window.location.href = ROOT + "login.html";
        return null;
    }
    if ((access === "Student" || access === "Admin") && profile.role !== access) {
        alert("You do not have permission to open this page.");
        window.location.href = ROOT + "index.html";
        return null;
    }

    // 3. Draw navbar + footer
    renderNavbar(profile);
    renderFooter();
    return profile;
}

// "Ali bin Ahmad" -> "AB"
function initials(name) {
    const parts = name.trim().split(/\s+/);
    return (parts[0][0] + (parts.length > 1 ? parts[1][0] : "")).toUpperCase();
}

// Sidebar (left) + top bar. On phones the sidebar slides in from the menu button.
function renderNavbar(profile) {
    const links = profile ? NAV_LINKS[profile.role] : NAV_LINKS.guest;
    const current = window.location.pathname;
    const onHome = current.endsWith("/");   // opening the folder shows index.html

    const linkHtml = links.map(l => {
        const active = current.endsWith(l.href) || (onHome && l.href === "index.html") ? " active" : "";
        return "<a class='ll-nav-link" + active + "' href='" + ROOT + l.href + "'>" +
            "<i class='bi bi-" + (l.icon || "circle") + "'></i><span>" + l.text + "</span></a>";
    }).join("");

    const rightHtml = profile
        ? "<div class='text-end d-none d-sm-block'>" +
            "<div class='ll-user-name'>" + escapeHtml(profile.name) + "</div>" +
            "<div class='ll-user-id'>" + profile.role + " · ID " + escapeHtml(profile.student_id) + "</div>" +
          "</div>" +
          "<div class='ll-avatar'>" + escapeHtml(initials(profile.name)) + "</div>" +
          "<button class='btn btn-outline-primary btn-sm' id='logout-btn'>Logout</button>"
        : "<a class='btn btn-outline-primary btn-sm' href='" + ROOT + "login.html'>Login</a>" +
          "<a class='btn btn-primary btn-sm' href='" + ROOT + "register.html'>Register</a>";

    document.body.classList.add("ll-has-sidebar");
    document.getElementById("navbar").innerHTML = `
      <aside class="ll-sidebar offcanvas-lg offcanvas-start" tabindex="-1" id="llSidebar" aria-label="Main menu">
        <div class="ll-sidebar-inner">
          <a class="ll-brand" href="${ROOT}index.html">
            <span class="ll-brand-icon"><i class="bi bi-search-heart"></i></span>
            <span>LostLink</span>
          </a>
          <nav class="ll-nav">${linkHtml}</nav>
          <div class="ll-sidebar-note">
            <div class="ll-sidebar-note-title"><span class="ll-dot"></span>${profile ? profile.role + " account" : "Guest"}</div>
            <div>Lost and Found Management System</div>
          </div>
        </div>
      </aside>
      <header class="ll-topbar">
        <div class="d-flex align-items-center gap-2">
          <button class="btn ll-menu-btn d-lg-none" type="button" data-bs-toggle="offcanvas"
                  data-bs-target="#llSidebar" aria-controls="llSidebar" aria-label="Open menu">
            <i class="bi bi-list"></i>
          </button>
          <a class="ll-topbar-brand" href="${ROOT}index.html">
            <span class="ll-topbar-icon"><i class="bi bi-arrow-repeat"></i></span>
            <span>
              <span class="ll-topbar-title">LostLink</span>
              <span class="ll-topbar-sub">Campus Lost &amp; Found</span>
            </span>
          </a>
        </div>
        <div class="d-flex align-items-center gap-2 gap-sm-3">${rightHtml}</div>
      </header>`;

    const logoutBtn = document.getElementById("logout-btn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", async () => {
            await sb.auth.signOut();
            window.location.href = ROOT + "login.html";
        });
    }
}

function renderFooter() {
    document.getElementById("footer").innerHTML = `
      <footer class="ll-footer">
        LostLink – Lost and Found Management System &copy; 2026 · AMCS2194 Mini Project
      </footer>`;
}
