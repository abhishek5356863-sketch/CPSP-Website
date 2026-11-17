import "./demo-societies.js";

const USER_STORAGE_KEY = "civicfix_users";
const SESSION_STORAGE_KEY = "civicfix_session";
const SOCIETIES_STORAGE_KEY = "civicfix_societies";

const loginPanel = document.getElementById("loginPanel");
const registerPanel = document.getElementById("registerPanel");
const adminPanel = document.getElementById("adminPanel");
const societyManagerPanel = document.getElementById("societyManagerPanel");
const societyRegisterPanel = document.getElementById("societyRegisterPanel");

function readUsers() {
    try {
        const stored = JSON.parse(
            localStorage.getItem(USER_STORAGE_KEY) ||
            localStorage.getItem("users") ||
            "[]"
        );
        return Array.isArray(stored) ? stored : [];
    } catch {
        return [];
    }
}

function readSocieties() {
    try {
        const stored = JSON.parse(localStorage.getItem(SOCIETIES_STORAGE_KEY) || "[]");
        const societies = Array.isArray(stored) ? stored : [];
        const knownIds = new Set(societies.map(society => society.id));
        const missingDemoSocieties = (window.CIVICFIX_DEMO_SOCIETIES || [])
            .filter(society => !knownIds.has(society.id));

        if (missingDemoSocieties.length) {
            societies.push(...missingDemoSocieties);
            localStorage.setItem(SOCIETIES_STORAGE_KEY, JSON.stringify(societies));
        }

        return societies;
    } catch {
        return [];
    }
}

readSocieties();

function switchPanel(panelId) {
    [loginPanel, registerPanel, adminPanel, societyManagerPanel, societyRegisterPanel].forEach(panel => {
        panel.classList.toggle("is-hidden", panel.id !== panelId);
    });
    document.querySelectorAll(".form-message").forEach(message => {
        message.textContent = "";
    });
}

function startSession(user, destination) {
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
        name: user.name,
        email: user.email,
        role: user.role,
        societyId: user.societyId || "",
        societyName: user.societyName || ""
    }));
    window.location.assign(destination);
}

document.querySelectorAll("[data-panel]").forEach(button => {
    button.addEventListener("click", () => switchPanel(button.dataset.panel));
});

document.getElementById("loginForm").addEventListener("submit", event => {
    event.preventDefault();

    const email = document.getElementById("loginEmail").value.trim().toLowerCase();
    const password = document.getElementById("loginPassword").value;
    const user = readUsers().find(account =>
        account.role === "citizen" &&
        String(account.email).toLowerCase() === email &&
        account.password === password
    );

    if (!user) {
        document.getElementById("loginMessage").textContent =
            "No account matches those details. Check them or create an account.";
        return;
    }

    startSession(user, "index.html");
});

document.getElementById("registerForm").addEventListener("submit", event => {
    event.preventDefault();

    const name = document.getElementById("registerName").value.trim();
    const email = document.getElementById("registerEmail").value.trim().toLowerCase();
    const password = document.getElementById("registerPassword").value;
    const confirmation = document.getElementById("confirmPassword").value;
    const message = document.getElementById("registerMessage");
    const users = readUsers();

    if (users.some(account => String(account.email).toLowerCase() === email)) {
        message.textContent = "An account with this email already exists. Please sign in.";
        return;
    }

    if (password.length < 6) {
        message.textContent = "Choose a password with at least 6 characters.";
        return;
    }

    if (password !== confirmation) {
        message.textContent = "The passwords do not match.";
        return;
    }

    const newUser = { name, email, password, role: "citizen" };
    users.push(newUser);
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(users));
    localStorage.setItem("users", JSON.stringify(users));

    startSession(newUser, "index.html");
});

document.getElementById("adminForm").addEventListener("submit", event => {
    event.preventDefault();

    const username = document.getElementById("adminUsername").value.trim();
    const password = document.getElementById("adminPassword").value;

    if (username !== "admin" || password !== "admin123") {
        document.getElementById("adminMessage").textContent = "Invalid administrator username or password.";
        return;
    }

    startSession({ name: "Administrator", email: "", role: "admin" }, "index.html");
});

document.getElementById("societyManagerLoginForm").addEventListener("submit", event => {
    event.preventDefault();

    const email = document.getElementById("societyManagerEmail").value.trim().toLowerCase();
    const password = document.getElementById("societyManagerPassword").value;
    const manager = readUsers().find(account =>
        account.role === "society_manager" &&
        String(account.email).toLowerCase() === email &&
        account.password === password
    );

    if (!manager) {
        document.getElementById("societyManagerLoginMessage").textContent =
            "Manager login not found. Check your details or register your society.";
        return;
    }

    startSession(manager, "index.html");
});

document.getElementById("societyRegisterForm").addEventListener("submit", event => {
    event.preventDefault();

    const name = document.getElementById("newSocietyName").value.trim();
    const address = document.getElementById("newSocietyAddress").value.trim();
    const managerName = document.getElementById("newManagerName").value.trim();
    const email = document.getElementById("newManagerEmail").value.trim().toLowerCase();
    const password = document.getElementById("newManagerPassword").value;
    const confirmation = document.getElementById("confirmManagerPassword").value;
    const message = document.getElementById("societyRegisterMessage");
    const users = readUsers();
    const societies = readSocieties();

    if (users.some(account => String(account.email).toLowerCase() === email)) {
        message.textContent = "An account already uses this email. Use another manager email.";
        return;
    }

    if (societies.some(society => society.name.toLowerCase() === name.toLowerCase() && society.address.toLowerCase() === address.toLowerCase())) {
        message.textContent = "This society appears to be registered already. Contact its manager.";
        return;
    }

    if (password.length < 6) {
        message.textContent = "Choose a manager password with at least 6 characters.";
        return;
    }

    if (password !== confirmation) {
        message.textContent = "The passwords do not match.";
        return;
    }

    const societyId = `SOC-${Date.now().toString(36).toUpperCase()}`;
    const society = {
        id: societyId,
        name,
        address,
        managerEmail: email,
        status: "Pending verification",
        createdAt: new Date().toISOString()
    };
    const manager = {
        name: managerName,
        email,
        password,
        role: "society_manager",
        societyId,
        societyName: name
    };

    societies.push(society);
    users.push(manager);
    localStorage.setItem(SOCIETIES_STORAGE_KEY, JSON.stringify(societies));
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(users));
    localStorage.setItem("users", JSON.stringify(users));

    startSession(manager, "index.html");
});
