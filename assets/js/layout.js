// =====================================================
// Shared layout ("master page"): navbar + footer for every page.
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

// Links shown in the navbar for each role. Teammates: add your pages here.
const NAV_LINKS = {
    guest: [
        { text: "Home", href: "index.html" }
    ],
    Student: [
        { text: "Home", href: "index.html" },
        { text: "My Claims", href: "modules/claim/my-claims.html" },
        { text: "Chat", href: "modules/chat/chat.html" },
        { text: "My Profile", href: "modules/user/profile.html" }
    ],
    Admin: [
        { text: "Home", href: "index.html" },
        { text: "Claims", href: "modules/claim/admin-claims.html" },
        { text: "Users", href: "modules/user/admin-users.html" },
        { text: "Chat", href: "modules/chat/chat.html" },
        { text: "My Profile", href: "modules/user/profile.html" }
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

function renderNavbar(profile) {
    const links = profile ? NAV_LINKS[profile.role] : NAV_LINKS.guest;
    const current = window.location.pathname;

    const linkHtml = links.map(l => {
        const active = current.endsWith(l.href) ? " active" : "";
        return "<li class='nav-item'><a class='nav-link" + active + "' href='" +
            ROOT + l.href + "'>" + l.text + "</a></li>";
    }).join("");

    const rightHtml = profile
        ? "<span class='navbar-text me-3'>👤 " + escapeHtml(profile.name) +
          " <span class='badge bg-light text-dark'>" + profile.role + "</span></span>" +
          "<button class='btn btn-outline-light btn-sm' id='logout-btn'>Logout</button>"
        : "<a class='btn btn-outline-light btn-sm me-2' href='" + ROOT + "login.html'>Login</a>" +
          "<a class='btn btn-light btn-sm' href='" + ROOT + "register.html'>Register</a>";

    document.getElementById("navbar").innerHTML = `
      <nav class="navbar navbar-expand-lg navbar-dark bg-primary">
        <div class="container">
          <a class="navbar-brand fw-bold" href="${ROOT}index.html">🎒 LostLink</a>
          <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#mainNav">
            <span class="navbar-toggler-icon"></span>
          </button>
          <div class="collapse navbar-collapse" id="mainNav">
            <ul class="navbar-nav me-auto">${linkHtml}</ul>
            <div class="d-flex align-items-center">${rightHtml}</div>
          </div>
        </div>
      </nav>`;

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
      <footer class="bg-light border-top mt-5 py-3 text-center text-muted small">
        LostLink – Lost and Found Management System &copy; 2026 · AMCS2194 Mini Project
      </footer>`;
}
