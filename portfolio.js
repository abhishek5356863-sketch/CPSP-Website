const menuToggle = document.querySelector(".menu-toggle");
const primaryNav = document.getElementById("primaryNav");

menuToggle.addEventListener("click", () => {
    const isExpanded = menuToggle.getAttribute("aria-expanded") === "true";
    menuToggle.setAttribute("aria-expanded", String(!isExpanded));
    menuToggle.setAttribute("aria-label", isExpanded ? "Open navigation" : "Close navigation");
    primaryNav.classList.toggle("is-open", !isExpanded);
});

primaryNav.querySelectorAll("a").forEach(link => {
    link.addEventListener("click", () => {
        menuToggle.setAttribute("aria-expanded", "false");
        menuToggle.setAttribute("aria-label", "Open navigation");
        primaryNav.classList.remove("is-open");
    });
});

const contactForm = document.getElementById("contactForm");

contactForm.addEventListener("submit", event => {
    event.preventDefault();

    const recipient = "hello@example.com";
    const name = document.getElementById("contactName").value.trim();
    const email = document.getElementById("contactEmail").value.trim();
    const message = document.getElementById("contactMessage").value.trim();
    const status = document.getElementById("contactStatus");

    if (!name || !email || !message) {
        status.textContent = "Please complete each field before sending.";
        return;
    }

    const subject = encodeURIComponent(`Portfolio enquiry from ${name}`);
    const body = encodeURIComponent(`${message}\n\nFrom: ${name}\nEmail: ${email}`);
    status.textContent = "Opening your email app with this message. Replace hello@example.com in portfolio.html and portfolio.js with your own address.";
    window.location.href = `mailto:${recipient}?subject=${subject}&body=${body}`;
});
