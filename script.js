/* =========================================
   CIVICFIX COMMUNITY PROJECT
   JavaScript
========================================= */


/* =========================================
   STORAGE
========================================= */

const STORAGE_KEY = "civicfix_complaints";
const SOCIETY_COMPLAINTS_KEY = "civicfix_society_complaints";
const SOCIETIES_KEY = "civicfix_societies";
let activeComplaintType = "government";
let selectedSocietyId = "";


/* Get complaints from browser */

const getComplaints = () => {

    return JSON.parse(
        localStorage.getItem(STORAGE_KEY) || "[]"
    );

};


/* Save complaints */

const saveComplaints = (items) => {

    localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(items)
    );

    localStorage.setItem(
        "complaints",
        JSON.stringify(items)
    );

};

function getSocietyComplaints() {

    try {

        const items = JSON.parse(
            localStorage.getItem(SOCIETY_COMPLAINTS_KEY) || "[]"
        );

        return Array.isArray(items) ? items : [];

    } catch (error) {

        return [];

    }

}

function saveSocietyComplaints(items) {

    localStorage.setItem(SOCIETY_COMPLAINTS_KEY, JSON.stringify(items));

}

function getRegisteredSocieties() {

    try {

        const storedSocieties = JSON.parse(localStorage.getItem(SOCIETIES_KEY) || "[]");
        const societies = Array.isArray(storedSocieties) ? storedSocieties : [];
        const knownIds = new Set(societies.map(society => society.id));
        const missingDemoSocieties = (window.CIVICFIX_DEMO_SOCIETIES || [])
            .filter(society => !knownIds.has(society.id));

        if (missingDemoSocieties.length) {
            societies.push(...missingDemoSocieties);
            localStorage.setItem(SOCIETIES_KEY, JSON.stringify(societies));
        }

        return societies.sort((first, second) =>
            String(first.state || first.name).localeCompare(String(second.state || second.name))
        );

    } catch (error) {

        return [];

    }

}


/* =========================================
   SHORTCUT FOR HTML ELEMENTS
========================================= */

const $ = (id) => {

    return document.getElementById(id);

};


/* =========================================
   GENERATE COMPLAINT ID
========================================= */

function makeId() {

    return "CF-" +
        Date.now()
        .toString()
        .slice(-8);

}


/* =========================================
   TOAST MESSAGE
========================================= */

function showToast(message) {

    const toast = $("toast");

    toast.textContent = message;

    toast.classList.add("show");

    setTimeout(() => {

        toast.classList.remove("show");

    }, 2500);

}


/* =========================================
   PAGE NAVIGATION
========================================= */

function showView(viewId) {

    const activeSession = getPortalSession();

    if (viewId === "admin" && activeSession?.role !== "admin") {
        showToast("Admin access is required to open this page.");
        viewId = "home";

    }

    if (viewId === "societyManager" && activeSession?.role !== "society_manager") {
        showToast("Only the manager of this society can open its workspace.");
        viewId = "home";

    }

    /* Hide all pages */

    document
        .querySelectorAll(".view")
        .forEach(v => {

            v.classList.remove("active");

        });


    /* Show selected page */

    $(viewId).classList.add("active");


    /* Update navigation button */

    document
        .querySelectorAll(".nav-btn")
        .forEach(btn => {

            btn.classList.toggle(
                "active",
                btn.dataset.view === viewId
            );

        });

    window.dispatchEvent(
        new CustomEvent("civicfix:viewchange", { detail: { viewId } })
    );

    /* Update page content */

    if (viewId === "home") {

        updateStats();

    }


    if (viewId === "track") {

        renderComplaints();

    }


    if (viewId === "admin") {

        renderAdmin();
        renderSocietyApprovals();

    }

    if (viewId === "societyManager") {

        renderSocietyManager();

    }


    /* Scroll to top */

    window.scrollTo({

        top: 0,

        behavior: "smooth"

    });

}


/* =========================================
   NAVIGATION BUTTONS
========================================= */

document
    .querySelectorAll("[data-view]")
    .forEach(btn => {

        btn.addEventListener(
            "click",
            () => {

                showView(
                    btn.dataset.view
                );

            }
        );

    });


/* =========================================
   HOME BUTTON
========================================= */

document
    .querySelectorAll("[data-go]")
    .forEach(btn => {

        btn.addEventListener(
            "click",
            () => {

                showView(
                    btn.dataset.go
                );

            }
        );

    });


/* =========================================
   IMAGE UPLOAD
========================================= */

$("photo").addEventListener(
    "change",
    function () {

        const file = this.files[0];


        if (!file) {

            $("preview")
                .classList
                .add("hidden");

            return;

        }


        const reader =
            new FileReader();


        reader.onload = e => {

            $("preview").src =
                e.target.result;

            $("preview")
                .classList
                .remove("hidden");

        };


        reader.readAsDataURL(file);

    }
);


/* =========================================
   GPS LOCATION
========================================= */

const locationMapState = {
    provider: null,
    map: null,
    marker: null,
    googleGeocoder: null,
    latitude: null,
    longitude: null,
    confirmed: false,
    reverseGeocodeTimer: null,
    leafletReady: null,
    googleReady: null
};

function formatCoordinates(latitude, longitude) {

    return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;

}

function setMapAddressStatus(message) {

    $("mapAddressStatus").textContent = message;

}

function loadGoogleMaps() {

    if (window.google?.maps) {
        return Promise.resolve(true);

    }

    const apiKey = window.CIVICFIX_GOOGLE_MAPS_API_KEY?.trim();

    if (!apiKey) {
        return Promise.resolve(false);

    }

    if (!locationMapState.googleReady) {

        locationMapState.googleReady = new Promise(resolve => {

            const callbackName = "civicFixGoogleMapsReady";
            const timeout = window.setTimeout(() => resolve(false), 12000);

            window[callbackName] = () => {
                window.clearTimeout(timeout);
                resolve(Boolean(window.google?.maps));
                delete window[callbackName];
            };

            const script = document.createElement("script");
            script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&callback=${callbackName}&v=weekly`;
            script.async = true;
            script.onerror = () => {
                window.clearTimeout(timeout);
                resolve(false);
            };
            document.head.appendChild(script);

        });

    }

    return locationMapState.googleReady;

}

function loadLeaflet() {

    if (window.L) {
        return Promise.resolve(true);

    }

    if (!locationMapState.leafletReady) {

        locationMapState.leafletReady = new Promise(resolve => {

            if (!document.querySelector("link[data-leaflet-css]")) {
                const stylesheet = document.createElement("link");
                stylesheet.rel = "stylesheet";
                stylesheet.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
                stylesheet.dataset.leafletCss = "true";
                document.head.appendChild(stylesheet);
            }

            const script = document.createElement("script");
            script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
            script.async = true;
            script.onload = () => resolve(Boolean(window.L));
            script.onerror = () => resolve(false);
            document.head.appendChild(script);

        });

    }

    return locationMapState.leafletReady;

}

function initGoogleMap(latitude, longitude) {

    const center = { lat: latitude, lng: longitude };

    if (!locationMapState.map) {

        locationMapState.map = new google.maps.Map($("locationMap"), {
            center,
            zoom: 17,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: true,
            gestureHandling: "cooperative"
        });

        locationMapState.marker = new google.maps.Marker({
            position: center,
            map: locationMapState.map,
            draggable: true,
            title: "Reported problem location",
            animation: google.maps.Animation.DROP
        });

        locationMapState.googleGeocoder = new google.maps.Geocoder();

        locationMapState.marker.addListener("dragend", event => {
            updateSelectedLocation(event.latLng.lat(), event.latLng.lng());
        });

        locationMapState.map.addListener("click", event => {
            locationMapState.marker.setPosition(event.latLng);
            updateSelectedLocation(event.latLng.lat(), event.latLng.lng());
        });

    } else {

        locationMapState.map.setCenter(center);
        locationMapState.map.setZoom(17);
        locationMapState.marker.setPosition(center);

    }

    google.maps.event.trigger(locationMapState.map, "resize");

}

function initOpenStreetMap(latitude, longitude) {

    const center = [latitude, longitude];

    if (!locationMapState.map) {

        locationMapState.map = L.map("locationMap", {
            zoomControl: true,
            scrollWheelZoom: false
        }).setView(center, 17);

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            maxZoom: 19,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'
        }).addTo(locationMapState.map);

        locationMapState.marker = L.marker(center, { draggable: true }).addTo(locationMapState.map);

        locationMapState.marker.on("dragend", event => {
            const point = event.target.getLatLng();
            updateSelectedLocation(point.lat, point.lng);
        });

        locationMapState.map.on("click", event => {
            locationMapState.marker.setLatLng(event.latlng);
            updateSelectedLocation(event.latlng.lat, event.latlng.lng);
        });

    } else {

        locationMapState.map.setView(center, 17);
        locationMapState.marker.setLatLng(center);

    }

    window.setTimeout(() => locationMapState.map.invalidateSize(), 100);

}

async function initializeLocationMap(latitude, longitude) {

    $("locationMapPanel").classList.remove("hidden");
    $("confirmLocationBtn").disabled = true;
    $("mapProviderBadge").textContent = "Loading map";

    const googleReady = await loadGoogleMaps();

    if (googleReady) {
        locationMapState.provider = "google";
        $("mapProviderBadge").textContent = "Google Maps";
        initGoogleMap(latitude, longitude);
        return;
    }

    const leafletReady = await loadLeaflet();

    if (!leafletReady) {
        $("mapProviderBadge").textContent = "Map unavailable";
        setMapAddressStatus("Could not load the map. Check your internet connection and try again.");
        $("mapHelp").textContent = "You can still enter an address manually, but a map location cannot be confirmed right now.";
        return;
    }

    locationMapState.provider = "osm";
    $("mapProviderBadge").textContent = "OpenStreetMap";
    $("mapHelp").textContent = "Google Maps API key is not configured. Drag the marker or click the map to adjust the pin.";
    initOpenStreetMap(latitude, longitude);

}

async function reverseGeocode(latitude, longitude) {

    if (locationMapState.provider === "google" && locationMapState.googleGeocoder) {

        try {

            const result = await locationMapState.googleGeocoder.geocode({
                location: { lat: latitude, lng: longitude }
            });

            if (result.results?.length) {
                return result.results[0].formatted_address;
            }

        } catch (error) {

            console.warn("Google Maps reverse geocoding failed.", error);

        }

        return "";

    }

    try {

        const url = new URL("https://nominatim.openstreetmap.org/reverse");
        url.searchParams.set("format", "jsonv2");
        url.searchParams.set("lat", latitude);
        url.searchParams.set("lon", longitude);
        url.searchParams.set("zoom", "18");

        const response = await fetch(url, {
            headers: { "Accept-Language": navigator.language || "en" }
        });

        if (!response.ok) {
            return "";
        }

        const data = await response.json();
        return data.display_name || "";

    } catch (error) {

        console.warn("Reverse geocoding failed.", error);
        return "";

    }

}

function updateSelectedLocation(latitude, longitude) {

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return;

    }

    locationMapState.latitude = latitude;
    locationMapState.longitude = longitude;
    locationMapState.confirmed = false;

    $("locationLatitude").value = "";
    $("locationLongitude").value = "";
    $("locationConfirmed").value = "false";
    $("locationValidation").textContent = "";
    $("confirmLocationBtn").disabled = false;
    $("gpsStatus").classList.remove("gps-confirmed");
    $("gpsStatus").textContent = "Location detected — confirm the pin below";
    $("mapCoordinates").textContent = `Lat ${latitude.toFixed(6)}  ·  Lng ${longitude.toFixed(6)}`;
    setMapAddressStatus("Finding the nearest address…");

    if (locationMapState.reverseGeocodeTimer) {
        window.clearTimeout(locationMapState.reverseGeocodeTimer);
    }

    locationMapState.reverseGeocodeTimer = window.setTimeout(async () => {

        const address = await reverseGeocode(latitude, longitude);

        if (
            locationMapState.latitude !== latitude ||
            locationMapState.longitude !== longitude
        ) {
            return;
        }

        if (address) {
            $("location").value = address;
            setMapAddressStatus(address);
        } else {
            const coordinates = formatCoordinates(latitude, longitude);
            $("location").value = coordinates;
            setMapAddressStatus("Address lookup unavailable; coordinates can still be confirmed.");
        }

    }, 750);

}

$("confirmLocationBtn").addEventListener("click", () => {

    if (locationMapState.latitude === null || locationMapState.longitude === null) {
        return;

    }

    if (!$("location").value.trim()) {
        $("location").value = formatCoordinates(
            locationMapState.latitude,
            locationMapState.longitude
        );
    }

    locationMapState.confirmed = true;
    $("locationLatitude").value = locationMapState.latitude.toFixed(6);
    $("locationLongitude").value = locationMapState.longitude.toFixed(6);
    $("locationConfirmed").value = "true";
    $("gpsStatus").textContent = `Location confirmed · ${formatCoordinates(locationMapState.latitude, locationMapState.longitude)}`;
    $("gpsStatus").classList.add("gps-confirmed");
    $("confirmLocationBtn").disabled = true;
    $("locationValidation").textContent = "";

});

$("gpsBtn").addEventListener(
    "click",
    () => {

        /* Check browser support */

        if (!navigator.geolocation) {

            $("gpsStatus").textContent =
                "Geolocation is not supported.";

            $("locationMapPanel").classList.remove("hidden");
            setMapAddressStatus("This browser does not support location access. Enter your address manually.");

            return;

        }


        $("gpsStatus").textContent = "Requesting location permission…";
        $("locationMapPanel").classList.remove("hidden");
        $("mapProviderBadge").textContent = "Finding location";
        setMapAddressStatus("Allow CivicFix to access your location in the browser prompt.");


        /* Get location */

        navigator.geolocation.getCurrentPosition(

            async position => {

                const { latitude, longitude } = position.coords;

                locationMapState.latitude = latitude;
                locationMapState.longitude = longitude;
                $("mapCoordinates").textContent = `Lat ${latitude.toFixed(6)}  ·  Lng ${longitude.toFixed(6)}`;
                setMapAddressStatus("Loading map and finding your address…");

                await initializeLocationMap(latitude, longitude);
                updateSelectedLocation(latitude, longitude);

            },

            error => {

                const messages = {
                    1: "Location permission was denied. Allow access or enter the address manually.",
                    2: "Your location could not be determined. Try again or enter the address manually.",
                    3: "Location request timed out. Try again or enter the address manually."
                };

                $("gpsStatus").textContent = messages[error.code] || "Could not get location. Enter it manually.";
                $("mapProviderBadge").textContent = "Location needed";
                setMapAddressStatus("Allow location access, retry, or enter a street/landmark manually.");

            },

            { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }

        );

    }
);


/* =========================================
   SUBMIT COMPLAINT
========================================= */

$("issueForm").addEventListener(
    "submit",
    (event) => {

        /* Prevent page refresh */

        event.preventDefault();


        const file =
            $("photo").files[0];


        /* Create complaint */

        const createComplaint =
            (photoData = "") => {

                const activeUser = getPortalSession();

                if (activeComplaintType === "society" && !selectedSocietyId) {
                    $("locationValidation").textContent =
                        "Choose your society before submitting this private community report.";
                    return;

                }

                if (
                    locationMapState.latitude !== null &&
                    locationMapState.longitude !== null &&
                    !locationMapState.confirmed
                ) {

                    $("locationValidation").textContent =
                        "Please confirm the selected map location before submitting.";
                    $("confirmLocationBtn").focus();
                    return;

                }

                const complaint = {

                    id: makeId(),

                    name:
                        $("name")
                        .value
                        .trim(),

                    email:
                        $("email")
                        .value
                        .trim(),

                    category:
                        $("category")
                        .value,

                    type: activeComplaintType,

                    societyId:
                        activeComplaintType === "society"
                            ? selectedSocietyId
                            : "",

                    societyName:
                        activeComplaintType === "society"
                            ? getRegisteredSocieties().find(society => society.id === selectedSocietyId)?.name || ""
                            : "",

                    building:
                        activeComplaintType === "society"
                            ? $("societyBuilding").value.trim()
                            : "",

                    unit:
                        activeComplaintType === "society"
                            ? $("societyUnit").value.trim()
                            : "",

                    location:
                        $("location")
                        .value
                        .trim(),

                    latitude:
                        locationMapState.confirmed
                            ? locationMapState.latitude
                            : null,

                    longitude:
                        locationMapState.confirmed
                            ? locationMapState.longitude
                            : null,

                    description:
                        $("description")
                        .value
                        .trim(),

                    photo:
                        photoData,

                    status:
                        "Reported",

                    feedback:
                        "",

                    createdAt:
                        new Date()
                        .toLocaleString()

                };


                /* Get existing complaints */

                const complaints =
                    activeComplaintType === "society"
                        ? getSocietyComplaints()
                        : getComplaints();


                /* Add new complaint */

                complaints.unshift(
                    complaint
                );


                /* Save */

                if (activeComplaintType === "society") {
                    saveSocietyComplaints(complaints);
                } else {
                    saveComplaints(complaints);
                }


                /* Reset form */

                event.target.reset();


                $("preview")
                    .classList
                    .add("hidden");


                $("gpsStatus").textContent =
                    "GPS not selected";

                $("gpsStatus").classList.remove("gps-confirmed");
                $("locationLatitude").value = "";
                $("locationLongitude").value = "";
                $("locationConfirmed").value = "false";
                $("locationValidation").textContent = "";
                $("locationMapPanel").classList.add("hidden");
                locationMapState.latitude = null;
                locationMapState.longitude = null;
                locationMapState.confirmed = false;
                $("societyBuilding").value = "";
                $("societyUnit").value = "";
                $("societyReportDetails").classList.add("hidden");


                /* Message */

                showToast(
                    `Complaint ${complaint.id} submitted successfully!`
                );


                /* Open complaint page */

                showView("track");

            };


        /* If photo exists */

        if (file) {

            const reader =
                new FileReader();


            reader.onload = e => {

                createComplaint(
                    e.target.result
                );

            };


            reader.readAsDataURL(file);

        }

        else {

            createComplaint();

        }

    }
);


/* =========================================
   STATUS CSS CLASS
========================================= */

function statusClass(status) {

    if (
        status === "In Progress"
    ) {

        return "progress";

    }


    if (
        status === "Resolved"
    ) {

        return "resolved";

    }


    return "reported";

}


/* =========================================
   COMPLAINT TIMELINE
========================================= */

function timeline(status) {

    const states = [

        "Reported",

        "In Progress",

        "Resolved"

    ];


    const current =
        states.indexOf(status);


    return `

        <div class="timeline">

            ${states.map(
                (s, i) => `

                <div
                    class="step
                    ${i <= current ? "done" : ""}">

                    ${s}

                </div>

            `
            ).join("")}

        </div>

    `;

}


/* =========================================
   DISPLAY CITIZEN COMPLAINTS
========================================= */

function renderComplaints() {

    const user = getPortalSession();
    const allComplaints = [
        ...getComplaints().map(complaint => ({
            ...complaint,
            type: complaint.type || "government"
        })),
        ...getSocietyComplaints().map(complaint => ({
            ...complaint,
            type: "society"
        }))
    ];

    const complaints = user?.email
        ? allComplaints.filter(complaint =>
            String(complaint.email).toLowerCase() === String(user.email).toLowerCase()
        )
        : allComplaints;


    const list =
        $("complaintsList");


    /* No complaints */

    if (!complaints.length) {

        list.innerHTML = `

            <div class="empty">

                <h3>
                    No complaints yet
                </h3>

                <p>
                    Go to “Report Issue”
                    to create your first complaint.
                </p>

            </div>

        `;

        return;

    }


    /* Display complaints */

    list.innerHTML =

        complaints.map(c => `

            <article
                class="complaint-card">


                <div class="card-top">

                    <div>

                        <h3>
                            ${escapeHtml(c.category)}
                        </h3>

                        <span class="complaint-type-tag ${c.type === "society" ? "society-tag" : "government-tag"}">
                            ${c.type === "society" ? `Society · ${escapeHtml(c.societyName || "Community")}` : "Government service"}
                        </span>


                        <div class="meta">

                            Complaint ID:

                            <b>
                                ${escapeHtml(c.id)}
                            </b>

                        </div>

                        ${c.type === "society" && (c.building || c.unit)
                            ? `<div class="meta">${escapeHtml([c.building, c.unit].filter(Boolean).join(" · "))}</div>`
                            : ""}


                        <div class="meta">

                            📍
                            ${escapeHtml(c.location)}

                        </div>

                        ${
                            c.latitude !== null && c.latitude !== "" &&
                            c.longitude !== null && c.longitude !== "" &&
                            Number.isFinite(Number(c.latitude)) &&
                            Number.isFinite(Number(c.longitude))
                                ? `<p class="complaint-coordinates">Coordinates: ${Number(c.latitude).toFixed(6)}, ${Number(c.longitude).toFixed(6)}</p>`
                                : ""
                        }


                        <div class="meta">

                            Submitted:
                            ${escapeHtml(c.createdAt)}

                        </div>

                    </div>


                    <span
                        class="status
                        ${statusClass(c.status)}">

                        ${escapeHtml(c.status)}

                    </span>

                </div>


                <p
                    style="margin-top:12px">

                    ${escapeHtml(
                        c.description
                    )}

                </p>

                ${c.type === "society" && c.managerNote
                    ? `<p class="manager-note"><strong>Society manager update:</strong> ${escapeHtml(c.managerNote)}</p>`
                    : ""}


                ${
                    c.photo

                    ?

                    `<img
                        class="preview"
                        src="${c.photo}"
                        alt="Complaint photo">`

                    :

                    ""
                }


                ${timeline(c.status)}


                ${
                    c.status === "Resolved"

                    ?

                    `

                    <label>

                        Feedback

                        <textarea
                            class="feedback-input"
                            data-id="${c.id}"
                            rows="2"
                            placeholder="How was the resolution?">

                            ${escapeHtml(
                                c.feedback || ""
                            )}

                        </textarea>

                    </label>


                    <button
                        class="primary feedback-btn"
                        data-id="${c.id}">

                        Save Feedback

                    </button>

                    `

                    :

                    ""
                }

            </article>

        `).join("");


    /* Feedback buttons */

    document
        .querySelectorAll(".feedback-btn")
        .forEach(btn => {

            btn.addEventListener(
                "click",
                () => {

                    const complaints =
                        getComplaints();


                    const item =
                        complaints.find(
                            c =>
                                c.id ===
                                btn.dataset.id
                        );


                    const input =
                        document.querySelector(
                            `.feedback-input[data-id="${btn.dataset.id}"]`
                        );


                    if (
                        item &&
                        input
                    ) {

                        item.feedback =
                            input.value.trim();


                        saveComplaints(
                            complaints
                        );


                        showToast(
                            "Feedback saved."
                        );

                    }

                }
            );

        });

}


/* =========================================
   ADMIN DASHBOARD
========================================= */

function renderAdmin() {

    const query =
        $("adminSearch")
        .value
        .toLowerCase();


    const filter =
        $("adminFilter")
        .value;


    let complaints =
        getComplaints();


    /* Search */

    complaints =
        complaints.filter(c => {


            const matchesSearch = [

                c.name,

                c.category,

                c.location,

                c.id

            ].some(value =>

                String(value)
                    .toLowerCase()
                    .includes(query)

            );


            const matchesFilter =
                filter === "All" ||
                c.status === filter;


            return (
                matchesSearch &&
                matchesFilter
            );

        });


    const list =
        $("adminList");


    /* No results */

    if (!complaints.length) {

        list.innerHTML = `

            <div class="empty">

                <h3>
                    No matching complaints
                </h3>

                <p>
                    Reports submitted by citizens
                    will appear here.
                </p>

            </div>

        `;

        return;

    }


    /* Display complaints */

    list.innerHTML =

        complaints.map(c => `

            <article
                class="admin-card">


                <div>

                    <div class="card-top">

                        <div>

                            <h3>

                                ${escapeHtml(c.id)}

                                —

                                ${escapeHtml(c.category)}

                            </h3>


                            <div class="meta">

                                Citizen:

                                ${escapeHtml(c.name)}

                                •

                                ${escapeHtml(c.email)}

                            </div>


                            <div class="meta">

                                📍
                                ${escapeHtml(c.location)}

                            </div>

                        </div>


                        <span
                            class="status
                            ${statusClass(c.status)}">

                            ${escapeHtml(c.status)}

                        </span>

                    </div>


                    <p
                        style="margin-top:10px">

                        ${escapeHtml(
                            c.description
                        )}

                    </p>


                    ${
                        c.photo

                        ?

                        `<img
                            class="preview"
                            src="${c.photo}"
                            alt="Issue photo">`

                        :

                        ""
                    }

                </div>


                <div
                    class="admin-actions">


                    <button
                        data-status="Reported"
                        data-id="${c.id}">

                        Reported

                    </button>


                    <button
                        data-status="In Progress"
                        data-id="${c.id}">

                        In Progress

                    </button>


                    <button
                        data-status="Resolved"
                        data-id="${c.id}">

                        Resolved

                    </button>


                </div>

            </article>

        `).join("");


    /* Status buttons */

    document
        .querySelectorAll(
            ".admin-actions button"
        )
        .forEach(btn => {

            btn.addEventListener(
                "click",
                () => {

                    updateStatus(

                        btn.dataset.id,

                        btn.dataset.status

                    );

                }
            );

        });

}


function renderSocietyApprovals() {

    const list = $("societyApprovalList");
    if (!list) {
        return;
    }

    const pending = getRegisteredSocieties().filter(society =>
        society.status === "Pending verification"
    );

    if (!pending.length) {
        list.innerHTML = '<p class="approval-empty">No society registrations are waiting for review.</p>';
        return;
    }

    list.innerHTML = pending.map(society => `
        <article class="society-approval-item">
            <div>
                <strong>${escapeHtml(society.name)}</strong>
                <p>${escapeHtml(society.address)}</p>
                <small>Manager: ${escapeHtml(society.managerEmail)}</small>
            </div>
            <button class="primary approve-society-button" type="button" data-approve-society="${escapeHtml(society.id)}">Verify society</button>
        </article>
    `).join("");

    list.querySelectorAll("[data-approve-society]").forEach(button => {

        button.addEventListener("click", () => {

            if (getPortalSession()?.role !== "admin") {
                showToast("Only a government administrator can verify a society.");
                return;
            }

            const societies = getRegisteredSocieties();
            const society = societies.find(item => item.id === button.dataset.approveSociety);

            if (!society) {
                return;
            }

            society.status = "Verified";
            society.verifiedAt = new Date().toISOString();
            localStorage.setItem(SOCIETIES_KEY, JSON.stringify(societies));
            renderSocietyApprovals();
            showToast(`${society.name} is verified and available to residents.`);

        });

    });

}


/* =========================================
   SOCIETY MANAGER WORKSPACE
========================================= */

function renderSocietyManager() {

    const manager = getPortalSession();

    if (!manager || manager.role !== "society_manager" || !manager.societyId) {
        showToast("Society manager access is required.");
        showView("home");
        return;
    }

    const society = getRegisteredSocieties().find(item => item.id === manager.societyId);
    const query = $("societyManagerSearch").value.trim().toLowerCase();
    const filter = $("societyManagerFilter").value;
    const allItems = getSocietyComplaints().filter(item => item.societyId === manager.societyId);
    const items = allItems.filter(item => {

        const matchesQuery = [item.id, item.category, item.name, item.location, item.building, item.unit]
            .some(value => String(value || "").toLowerCase().includes(query));
        const matchesStatus = filter === "All" || item.status === filter;
        return matchesQuery && matchesStatus;

    });

    $("societyManagerTitle").textContent = society?.name || "Society Manager";
    $("societyManagerSubtitle").textContent = society
        ? `${society.address} · Private society workspace`
        : "Only complaints assigned to your registered society appear here.";
    $("societyTotalCount").textContent = allItems.length;
    $("societyOpenCount").textContent = allItems.filter(item => item.status !== "Resolved").length;
    $("societyResolvedCount").textContent = allItems.filter(item => item.status === "Resolved").length;

    if (!items.length) {
        $("societyManagerList").innerHTML = `
            <div class="empty">
                <h3>${allItems.length ? "No matching reports" : "No society complaints yet"}</h3>
                <p>Private reports from residents of ${escapeHtml(society?.name || "your society")} will appear here.</p>
            </div>
        `;
        return;
    }

    $("societyManagerList").innerHTML = items.map(item => `
        <article class="admin-card society-manager-card">
            <div class="society-complaint-content">
                <div class="card-top">
                    <div>
                        <span class="complaint-type-tag society-tag">Private society report</span>
                        <h3>${escapeHtml(item.category)} <span class="complaint-id">· ${escapeHtml(item.id)}</span></h3>
                        <p class="meta">Resident: ${escapeHtml(item.name)} · ${escapeHtml(item.email)}</p>
                        <p class="meta">📍 ${escapeHtml(item.location)}</p>
                        ${item.building || item.unit ? `<p class="meta">${escapeHtml([item.building, item.unit].filter(Boolean).join(" · "))}</p>` : ""}
                    </div>
                    <span class="status ${statusClass(item.status)}">${escapeHtml(item.status)}</span>
                </div>
                <p class="society-complaint-description">${escapeHtml(item.description)}</p>
                ${item.photo ? `<img class="preview" src="${item.photo}" alt="Photo attached to ${escapeHtml(item.id)}">` : ""}
                ${item.managerNote ? `<p class="manager-note"><strong>Manager update:</strong> ${escapeHtml(item.managerNote)}</p>` : ""}
            </div>
            <div class="society-manager-actions">
                <label for="status-${escapeHtml(item.id)}">Update status</label>
                <select class="society-status-select" id="status-${escapeHtml(item.id)}" data-society-complaint="${escapeHtml(item.id)}">
                    <option value="Reported" ${item.status === "Reported" ? "selected" : ""}>Reported</option>
                    <option value="In Progress" ${item.status === "In Progress" ? "selected" : ""}>In Progress</option>
                    <option value="Resolved" ${item.status === "Resolved" ? "selected" : ""}>Resolved</option>
                </select>
                <label for="note-${escapeHtml(item.id)}">Update for resident</label>
                <textarea id="note-${escapeHtml(item.id)}" class="manager-note-input" data-manager-note="${escapeHtml(item.id)}" rows="2" placeholder="Add a short response or maintenance assignment">${escapeHtml(item.managerNote || "")}</textarea>
                <button class="primary save-manager-note" type="button" data-save-note="${escapeHtml(item.id)}">Save update</button>
            </div>
        </article>
    `).join("");

    document.querySelectorAll(".society-status-select").forEach(select => {

        select.addEventListener("change", () => {

            const currentManager = getPortalSession();
            const reports = getSocietyComplaints();
            const report = reports.find(item =>
                item.id === select.dataset.societyComplaint &&
                item.societyId === currentManager?.societyId
            );

            if (!report) {
                return;
            }

            report.status = select.value;
            saveSocietyComplaints(reports);
            renderSocietyManager();
            showToast("Society report status updated.");

        });

    });

    document.querySelectorAll("[data-save-note]").forEach(button => {

        button.addEventListener("click", () => {

            const currentManager = getPortalSession();
            const reports = getSocietyComplaints();
            const report = reports.find(item =>
                item.id === button.dataset.saveNote &&
                item.societyId === currentManager?.societyId
            );
            const note = document.querySelector(`[data-manager-note="${CSS.escape(button.dataset.saveNote)}"]`);

            if (!report || !note) {
                return;
            }

            report.managerNote = note.value.trim();
            saveSocietyComplaints(reports);
            renderSocietyManager();
            showToast("Update saved for the resident.");

        });

    });

}

$("societyManagerSearch").addEventListener("input", renderSocietyManager);
$("societyManagerFilter").addEventListener("change", renderSocietyManager);


/* =========================================
   UPDATE STATUS
========================================= */

function updateStatus(
    id,
    status
) {

    const complaints =
        getComplaints();


    const item =
        complaints.find(
            c => c.id === id
        );


    if (!item) {

        return;

    }


    /* Change status */

    item.status =
        status;


    /* Save */

    saveComplaints(
        complaints
    );


    /* Show message */

    showToast(
        `${id} changed to ${status}.`
    );


    /* Refresh */

    renderAdmin();

    updateStats();

}


/* =========================================
   SEARCH
========================================= */

$("adminSearch")
    .addEventListener(
        "input",
        renderAdmin
    );


/* =========================================
   FILTER
========================================= */

$("adminFilter")
    .addEventListener(
        "change",
        renderAdmin
    );


/* =========================================
   HOME STATISTICS
========================================= */

function updateStats() {

    const complaints =
        getComplaints();


    /* Total */

    $("totalCount").textContent =
        complaints.length;


    /* In Progress */

    $("progressCount").textContent =

        complaints.filter(
            c =>
                c.status ===
                "In Progress"
        ).length;


    /* Resolved */

    $("resolvedCount").textContent =

        complaints.filter(
            c =>
                c.status ===
                "Resolved"
        ).length;

}


/* =========================================
   SECURITY
   Prevent HTML injection
========================================= */

function escapeHtml(value) {

    return String(value)

        .replaceAll(
            "&",
            "&amp;"
        )

        .replaceAll(
            "<",
            "&lt;"
        )

        .replaceAll(
            ">",
            "&gt;"
        )

        .replaceAll(
            '"',
            "&quot;"
        )

        .replaceAll(
            "'",
            "&#039;"
        );

}


/* =========================================
   START APPLICATION
========================================= */

updateStats();

/* =========================================
   LOGIN PAGE SESSION AND ISSUE SHORTCUTS
========================================= */

function getPortalSession() {

    try {

        return JSON.parse(
            sessionStorage.getItem("civicfix_session") || "null"
        );

    } catch (error) {

        sessionStorage.removeItem("civicfix_session");
        return null;

    }

}

function fillCitizenDetails() {

    const user = getPortalSession();

    if (!user || user.role !== "citizen") {
        return;

    }

    $("name").value = user.name || "";
    $("email").value = user.email || "";

}

const governmentCategories = [
    "Garbage / Waste",
    "Damaged Road",
    "Streetlight",
    "Water Leakage",
    "Drainage / Sanitation",
    "Other"
];

const societyCategories = [
    "Water Supply",
    "Lift / Elevator",
    "Electricity / Generator",
    "Parking",
    "Waste Management",
    "Security",
    "Plumbing",
    "Common Area",
    "Cleaning",
    "Garden / Maintenance",
    "Other"
];

function setComplaintCategories(type, selected = "") {

    const categories = type === "society" ? societyCategories : governmentCategories;
    const select = $("category");

    select.innerHTML = [
        '<option value="">Select category</option>',
        ...categories.map(category => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`)
    ].join("");

    select.value = selected;

}

function scrollToSection(element) {

    const headerHeight = document.querySelector(".topbar").getBoundingClientRect().height;
    const top = window.scrollY + element.getBoundingClientRect().top - headerHeight - 16;
    window.scrollTo({ top: Math.max(0, top), behavior: "instant" });

}

function showReportType(type) {

    $("governmentIssuesPanel").classList.toggle("hidden", type !== "government");
    $("societyIssuesPanel").classList.toggle("hidden", type !== "society");

    if (type === "society") {
        populateResidentSocieties();
    }

    const panel = type === "government"
        ? $("governmentIssuesPanel")
        : $("societyIssuesPanel");
    scrollToSection(panel);

}

function populateResidentSocieties() {

    const select = $("residentSocietySelect");
    const activeUser = getPortalSession();
    const allSocieties = getRegisteredSocieties().filter(society =>
        society.status === "Verified" || !society.status
    );
    const societies = activeUser?.role === "society_manager"
        ? allSocieties.filter(society => society.id === activeUser.societyId)
        : allSocieties;

    select.innerHTML = [
        '<option value="">Choose your registered society</option>',
        ...societies.map(society =>
            `<option value="${escapeHtml(society.id)}">${escapeHtml(society.name)} · ${escapeHtml(society.address)}</option>`
        )
    ].join("");

    $("societyEmptyMessage").classList.toggle("hidden", societies.length > 0);
    $("societyCategoryGrid").innerHTML = "";
    selectedSocietyId = "";

}

function renderSocietyCategoryChoices() {

    const selectedSociety = $("residentSocietySelect").value;
    selectedSocietyId = selectedSociety;

    if (!selectedSociety) {
        $("societyCategoryGrid").innerHTML = "";
        return;
    }

    const symbols = {
        "Water Supply": "≋",
        "Lift / Elevator": "↟",
        "Electricity / Generator": "ϟ",
        Parking: "P",
        "Waste Management": "♲",
        Security: "◈",
        Plumbing: "⌁",
        "Common Area": "⌂",
        Cleaning: "✳",
        "Garden / Maintenance": "❋",
        Other: "+"
    };

    $("societyCategoryGrid").innerHTML = societyCategories.map(category => `
        <button class="issue-choice society-issue-choice" type="button" data-society-category="${escapeHtml(category)}">
            <span aria-hidden="true">${symbols[category] || "+"}</span>
            <strong>${escapeHtml(category)}</strong>
            <small>Report to your society manager</small>
        </button>
    `).join("");

    document.querySelectorAll("[data-society-category]").forEach(button => {

        button.addEventListener("click", () => {

            const user = getPortalSession();
            const society = getRegisteredSocieties().find(item => item.id === selectedSocietyId);

            activeComplaintType = "society";
            $("complaintType").value = "society";
            $("complaintSocietyId").value = selectedSocietyId;
            $("societyReportDetails").classList.remove("hidden");
            $("report").querySelector(".section-heading h2").textContent = "Report a Society Problem";
            $("report").querySelector(".section-heading p").textContent =
                `Your report will be shared with the manager of ${society?.name || "your selected society"}, not the government complaint list.`;
            $("name").value = user?.name || "";
            $("email").value = user?.email || "";
            setCategoryOptionsAndSelect("society", button.dataset.societyCategory);
            showView("report");
            $("location").focus({ preventScroll: true });

        });

    });

}

function setCategoryOptionsAndSelect(type, category) {

    activeComplaintType = type;
    $("complaintType").value = type;
    $("complaintSocietyId").value = type === "society" ? selectedSocietyId : "";
    $("societyReportDetails").classList.toggle("hidden", type !== "society");
    $("report").querySelector(".section-heading h2").textContent =
        type === "society" ? "Report a Society Problem" : "Report a Civic Issue";
    $("report").querySelector(".section-heading p").textContent =
        type === "society"
            ? "This private community report goes only to your society manager."
            : "Enter the details below. Reports are stored in your browser for this demo.";
    setComplaintCategories(type, category);

}

document.querySelectorAll("[data-report-type]").forEach(button => {

    button.addEventListener("click", () => {

        const type = button.dataset.reportType;

        if (type === "back") {
            $("governmentIssuesPanel").classList.add("hidden");
            $("societyIssuesPanel").classList.add("hidden");
            scrollToSection(document.querySelector(".report-type-picker"));
            return;
        }

        showReportType(type);

    });

});

$("residentSocietySelect").addEventListener("change", renderSocietyCategoryChoices);

document
    .querySelectorAll(".issue-choice[data-category]")
    .forEach(button => {

        button.addEventListener("click", () => {

            fillCitizenDetails();
            selectedSocietyId = "";
            setCategoryOptionsAndSelect("government", button.dataset.category);
            showView("report");
            $("location").focus({ preventScroll: true });

        });

    });

document
    .querySelectorAll("[data-signout]")
    .forEach(button => {

        button.addEventListener("click", () => {

            sessionStorage.removeItem("civicfix_session");
            window.location.replace("login.html");

        });

    });

const portalSession = getPortalSession();

if (!portalSession) {

    window.location.replace("login.html");

} else {

    const adminNavigation = document.querySelector('[data-view="admin"]');
    const managerNavigation = document.querySelector('[data-view="societyManager"]');

    if (adminNavigation) {
        adminNavigation.hidden = portalSession.role !== "admin";
    }

    if (managerNavigation) {
        managerNavigation.hidden = portalSession.role !== "society_manager";
    }

    fillCitizenDetails();

    if (portalSession.role === "admin") {
        showView("admin");
    } else if (portalSession.role === "society_manager") {
        showView("societyManager");
    }

}
/* =====================================================
   ADMIN LOGIN
===================================================== */

const adminLoginForm =
    document.getElementById("adminLoginForm");

if (adminLoginForm) {

    adminLoginForm.addEventListener("submit", function(event) {

        event.preventDefault();

        const username =
            document.getElementById("adminUsername").value;

        const password =
            document.getElementById("adminPassword").value;

        /*
         * DEMO ADMIN LOGIN
         */

        if (
            username === "admin" &&
            password === "admin123"
        ) {

            document.getElementById(
                "adminLoginPage"
            ).style.display = "none";

            document.getElementById(
                "adminDashboard"
            ).style.display = "flex";

            loadAdminDashboard();

        } else {

            document.getElementById(
                "adminLoginError"
            ).textContent =
                "Invalid username or password.";

        }

    });

}


/* =====================================================
   SHOW CITIZEN PAGE
===================================================== */

function showCitizenPage() {

    document.getElementById(
        "adminLoginPage"
    ).style.display = "none";

    /*
     * Change this to the ID of your
     * existing citizen login page.
     */

    const citizenPage =
        document.getElementById("loginPage");

    if (citizenPage) {

        citizenPage.style.display = "block";

    }

}


/* =====================================================
   ADMIN LOGOUT
===================================================== */

function adminLogout() {

    document.getElementById(
        "adminDashboard"
    ).style.display = "none";

    document.getElementById(
        "adminLoginPage"
    ).style.display = "flex";

    document.getElementById(
        "adminLoginForm"
    ).reset();

}


/* =====================================================
   ADMIN SECTION NAVIGATION
===================================================== */

function showAdminSection(section) {

    document.querySelectorAll(
        ".admin-section"
    ).forEach(function(element) {

        element.classList.add("hidden");

    });


    if (section === "dashboard") {

        document.getElementById(
            "adminDashboardSection"
        ).classList.remove("hidden");

        loadAdminDashboard();

    }


    if (section === "complaints") {

        document.getElementById(
            "adminComplaintsSection"
        ).classList.remove("hidden");

        loadAllComplaints();

    }


    if (section === "citizens") {

        document.getElementById(
            "adminCitizensSection"
        ).classList.remove("hidden");

        loadCitizens();

    }


    if (section === "reports") {

        document.getElementById(
            "adminReportsSection"
        ).classList.remove("hidden");

        loadReports();

    }

}


/* =====================================================
   GET COMPLAINTS
===================================================== */

function getAdminComplaints() {

    /*
     * These complaints come from localStorage.
     * Later we can connect this to MongoDB.
     */

    return JSON.parse(
        localStorage.getItem("complaints")
    ) || [];

}


/* =====================================================
   ADMIN DASHBOARD
===================================================== */

function loadAdminDashboard() {

    const complaints =
        getAdminComplaints();


    const total =
        complaints.length;


    const reported =
        complaints.filter(
            c => c.status === "Reported"
        ).length;


    const progress =
        complaints.filter(
            c => c.status === "In Progress"
        ).length;


    const resolved =
        complaints.filter(
            c => c.status === "Resolved"
        ).length;


    document.getElementById(
        "totalComplaints"
    ).textContent = total;


    document.getElementById(
        "pendingComplaints"
    ).textContent = reported;


    document.getElementById(
        "progressComplaints"
    ).textContent = progress;


    document.getElementById(
        "resolvedComplaints"
    ).textContent = resolved;


    /*
     * Show latest 5 complaints
     */

    const recent =
        complaints.slice(0, 5);


    const container =
        document.getElementById(
            "recentComplaints"
        );


    if (recent.length === 0) {

        container.innerHTML =
            "<p>No complaints have been submitted yet.</p>";

        return;

    }


    container.innerHTML =
        recent.map(
            complaint => createComplaintHTML(
                complaint
            )
        ).join("");

}


/* =====================================================
   CREATE COMPLAINT HTML
===================================================== */

function createComplaintHTML(complaint) {

    return `

        <div class="admin-complaint">

            <div class="admin-complaint-header">

                <div>

                    <h3>
                        ${complaint.category}
                    </h3>

                    <span class="complaint-id">
                        ID: ${complaint.id}
                    </span>

                </div>

                <select
                    class="status-select"
                    onchange="
                        updateComplaintStatus(
                            '${complaint.id}',
                            this.value
                        )
                    "
                >

                    <option
                        ${complaint.status === "Reported"
                            ? "selected"
                            : ""}
                    >
                        Reported
                    </option>

                    <option
                        ${complaint.status === "In Progress"
                            ? "selected"
                            : ""}
                    >
                        In Progress
                    </option>

                    <option
                        ${complaint.status === "Resolved"
                            ? "selected"
                            : ""}
                    >
                        Resolved
                    </option>

                </select>

            </div>


            <div class="complaint-info">

                <p>
                    <strong>Citizen:</strong>
                    ${complaint.name || "Unknown"}
                </p>

                <p>
                    <strong>Location:</strong>
                    ${complaint.location}
                </p>

                <p>
                    <strong>Description:</strong>
                    ${complaint.description}
                </p>

            </div>

        </div>

    `;

}


/* =====================================================
   LOAD ALL COMPLAINTS
===================================================== */

function loadAllComplaints() {

    const complaints =
        getAdminComplaints();


    const container =
        document.getElementById(
            "allComplaints"
        );


    if (complaints.length === 0) {

        container.innerHTML =
            "<p>No complaints available.</p>";

        return;

    }


    container.innerHTML =
        complaints.map(
            complaint =>
                createComplaintHTML(
                    complaint
                )
        ).join("");

}


/* =====================================================
   UPDATE COMPLAINT STATUS
===================================================== */

function updateComplaintStatus(
    complaintId,
    newStatus
) {

    const complaints =
        getAdminComplaints();


    const complaint =
        complaints.find(
            c => c.id === complaintId
        );


    if (!complaint) {

        return;

    }


    complaint.status =
        newStatus;


    localStorage.setItem(
        "complaints",
        JSON.stringify(complaints)
    );


    loadAdminDashboard();

    loadAllComplaints();


    alert(
        "Complaint status updated to " +
        newStatus
    );

}


/* =====================================================
   LOAD CITIZENS
===================================================== */

function loadCitizens() {

    const users =
        JSON.parse(
            localStorage.getItem("users")
        ) || [];


    const citizens =
        users.filter(
            user => user.role !== "admin"
        );


    const container =
        document.getElementById(
            "citizensList"
        );


    if (citizens.length === 0) {

        container.innerHTML =
            "<p>No registered citizens yet.</p>";

        return;

    }


    container.innerHTML =
        citizens.map(
            citizen => `

                <div class="citizen-row">

                    <div>

                        <strong>
                            ${citizen.name}
                        </strong>

                        <p>
                            ${citizen.email}
                        </p>

                    </div>

                    <span>
                        Citizen
                    </span>

                </div>

            `
        ).join("");

}


/* =====================================================
   REPORT STATISTICS
===================================================== */

function loadReports() {

    const complaints =
        getAdminComplaints();


    const total =
        complaints.length;


    const resolved =
        complaints.filter(
            c => c.status === "Resolved"
        ).length;


    const pending =
        total - resolved;


    document.getElementById(
        "reportTotal"
    ).textContent = total;


    document.getElementById(
        "reportResolved"
    ).textContent = resolved;


    document.getElementById(
        "reportPending"
    ).textContent = pending;

}


/* =====================================================
   ADMIN LOGIN BUTTON
===================================================== */

/*
 * If your citizen login page has an
 * "Admin Login" button, use:

 onclick="openAdminLogin()"

 */

function openAdminLogin() {

    const citizenPage =
        document.getElementById("loginPage");

    if (citizenPage) {

        citizenPage.style.display = "none";

    }


    document.getElementById(
        "adminLoginPage"
    ).style.display = "flex";

}
/* =====================================================
   CIVICFIX ADMIN PORTAL JAVASCRIPT
===================================================== */


/* =====================================================
   ADMIN LOGIN
===================================================== */

const adminPortalLoginForm =
    document.getElementById("adminLoginForm");


if (adminPortalLoginForm) {

    adminPortalLoginForm.addEventListener(
        "submit",
        function(event) {

            event.preventDefault();


            const username =
                document.getElementById(
                    "adminUsername"
                ).value.trim();


            const password =
                document.getElementById(
                    "adminPassword"
                ).value;


            /*
               DEMO ADMIN ACCOUNT
            */

            if (
                username === "admin" &&
                password === "admin123"
            ) {

                document.getElementById(
                    "adminLoginPage"
                ).style.display = "none";


                document.getElementById(
                    "adminDashboard"
                ).style.display = "block";


                document.getElementById(
                    "adminLoginMessage"
                ).textContent = "";


                loadAdminDashboard();

            }

            else {

                document.getElementById(
                    "adminLoginMessage"
                ).textContent =
                    "Invalid username or password.";

            }

        }
    );

}


/* =====================================================
   BACK TO CITIZEN
===================================================== */

function backToCitizen() {

    document.getElementById(
        "adminLoginPage"
    ).style.display = "none";


    /*
       Your existing citizen login section
       should have id="loginPage".
    */

    const citizenPage =
        document.getElementById(
            "loginPage"
        );


    if (citizenPage) {

        citizenPage.style.display =
            "block";

    }

}


/* =====================================================
   ADMIN LOGOUT
===================================================== */

function adminLogout() {

    document.getElementById(
        "adminDashboard"
    ).style.display = "none";


    document.getElementById(
        "adminLoginPage"
    ).style.display = "flex";


    document.getElementById(
        "adminLoginForm"
    ).reset();

}


/* =====================================================
   ADMIN NAVIGATION
===================================================== */

function showAdminSection(section) {


    document.querySelectorAll(
        ".admin-section"
    ).forEach(
        function(item) {

            item.classList.add(
                "admin-hidden"
            );

        }
    );


    if (section === "dashboard") {

        document.getElementById(
            "adminDashboardSection"
        ).classList.remove(
            "admin-hidden"
        );


        loadAdminDashboard();

    }


    if (section === "complaints") {

        document.getElementById(
            "adminComplaintsSection"
        ).classList.remove(
            "admin-hidden"
        );


        loadAdminComplaints();

    }


    if (section === "citizens") {

        document.getElementById(
            "adminCitizensSection"
        ).classList.remove(
            "admin-hidden"
        );


        loadAdminCitizens();

    }


    if (section === "reports") {

        document.getElementById(
            "adminReportsSection"
        ).classList.remove(
            "admin-hidden"
        );


        loadAdminReports();

    }

}


/* =====================================================
   GET COMPLAINTS
===================================================== */

function getAdminComplaints() {

    let complaints = [];


    try {

        complaints =
            JSON.parse(
                localStorage.getItem(
                    "complaints"
                )
            ) || [];

    }

    catch(error) {

        complaints = [];

    }


    return complaints;

}


/* =====================================================
   SAVE COMPLAINTS
===================================================== */

function saveAdminComplaints(
    complaints
) {

    localStorage.setItem(
        "complaints",
        JSON.stringify(
            complaints
        )
    );

    localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(complaints)
    );

}


/* =====================================================
   ADMIN DASHBOARD
===================================================== */

function loadAdminDashboard() {

    const complaints =
        getAdminComplaints();


    const total =
        complaints.length;


    const reported =
        complaints.filter(
            function(item) {

                return item.status ===
                    "Reported";

            }
        ).length;


    const progress =
        complaints.filter(
            function(item) {

                return item.status ===
                    "In Progress";

            }
        ).length;


    const resolved =
        complaints.filter(
            function(item) {

                return item.status ===
                    "Resolved";

            }
        ).length;


    document.getElementById(
        "totalComplaints"
    ).textContent = total;


    document.getElementById(
        "reportedComplaints"
    ).textContent = reported;


    document.getElementById(
        "progressComplaints"
    ).textContent = progress;


    document.getElementById(
        "resolvedComplaints"
    ).textContent = resolved;


    /*
       Show recent complaints
    */

    const recent =
        complaints.slice(
            -5
        ).reverse();


    const container =
        document.getElementById(
            "recentComplaints"
        );


    if (!container) {

        return;

    }


    if (recent.length === 0) {

        container.innerHTML = `
            <p class="empty-message">
                No complaints available.
            </p>
        `;

        return;

    }


    container.innerHTML =
        recent.map(
            createAdminComplaint
        ).join("");

}


/* =====================================================
   CREATE COMPLAINT CARD
===================================================== */

function createAdminComplaint(
    complaint
) {

    return `

        <div class="admin-complaint">

            <div class="admin-complaint-header">

                <div>

                    <h3>
                        ${complaint.category}
                    </h3>

                    <span class="complaint-id">

                        ID:
                        ${complaint.id}

                    </span>

                </div>


                <select
                    class="status-select"

                    onchange="
                        changeComplaintStatus(
                            '${complaint.id}',
                            this.value
                        )
                    "
                >

                    <option
                        value="Reported"

                        ${
                            complaint.status ===
                            "Reported"
                            ? "selected"
                            : ""
                        }
                    >
                        Reported
                    </option>


                    <option
                        value="In Progress"

                        ${
                            complaint.status ===
                            "In Progress"
                            ? "selected"
                            : ""
                        }
                    >
                        In Progress
                    </option>


                    <option
                        value="Resolved"

                        ${
                            complaint.status ===
                            "Resolved"
                            ? "selected"
                            : ""
                        }
                    >
                        Resolved
                    </option>

                </select>

            </div>


            <div class="complaint-details">

                <p>
                    <strong>
                        Citizen:
                    </strong>

                    ${
                        complaint.name ||
                        "Unknown"
                    }

                </p>


                <p>
                    <strong>
                        Location:
                    </strong>

                    ${
                        complaint.location ||
                        "Not provided"
                    }

                </p>


                <p>
                    <strong>
                        Description:
                    </strong>

                    ${
                        complaint.description ||
                        "No description"
                    }

                </p>


                <p>
                    <strong>
                        Submitted:
                    </strong>

                    ${
                        complaint.createdAt ||
                        "Unknown"
                    }

                </p>

            </div>

        </div>

    `;

}


/* =====================================================
   LOAD ALL COMPLAINTS
===================================================== */

function loadAdminComplaints() {

    let complaints =
        getAdminComplaints();


    const filter =
        document.getElementById(
            "complaintFilter"
        ).value;


    const search =
        document.getElementById(
            "complaintSearch"
        ).value.toLowerCase();


    /*
       FILTER STATUS
    */

    if (filter !== "All") {

        complaints =
            complaints.filter(
                function(item) {

                    return item.status ===
                        filter;

                }
            );

    }


    /*
       SEARCH
    */

    if (search !== "") {

        complaints =
            complaints.filter(
                function(item) {

                    const text =
                        (
                            item.id +
                            " " +
                            item.name +
                            " " +
                            item.category +
                            " " +
                            item.location
                        ).toLowerCase();


                    return text.includes(
                        search
                    );

                }
            );

    }


    const container =
        document.getElementById(
            "allComplaints"
        );


    if (complaints.length === 0) {

        container.innerHTML = `
            <p class="empty-message">
                No complaints found.
            </p>
        `;

        return;

    }


    container.innerHTML =
        complaints
            .slice()
            .reverse()
            .map(
                createAdminComplaint
            )
            .join("");

}


/* =====================================================
   CHANGE COMPLAINT STATUS
===================================================== */

function changeComplaintStatus(
    complaintId,
    newStatus
) {

    const complaints =
        getAdminComplaints();


    const complaint =
        complaints.find(
            function(item) {

                return item.id ===
                    complaintId;

            }
        );


    if (!complaint) {

        alert(
            "Complaint not found."
        );

        return;

    }


    /*
       UPDATE STATUS
    */

    complaint.status =
        newStatus;


    /*
       SAVE DATA
    */

    saveAdminComplaints(
        complaints
    );


    /*
       REFRESH ADMIN DATA
    */

    loadAdminDashboard();

    loadAdminComplaints();

    loadAdminReports();


    alert(
        "Complaint status changed to " +
        newStatus
    );

}


/* =====================================================
   LOAD CITIZENS
===================================================== */

function loadAdminCitizens() {

    let users = [];


    try {

        users =
            JSON.parse(
                localStorage.getItem(
                    "users"
                )
            ) || [];

    }

    catch(error) {

        users = [];

    }


    const container =
        document.getElementById(
            "citizenList"
        );


    if (users.length === 0) {

        container.innerHTML = `
            <p class="empty-message">
                No citizens registered.
            </p>
        `;

        return;

    }


    container.innerHTML =
        users.map(
            function(user) {

                return `

                    <div class="citizen-row">

                        <div>

                            <strong>
                                ${
                                    user.name ||
                                    "Citizen"
                                }
                            </strong>

                            <p>
                                ${
                                    user.email ||
                                    ""
                                }
                            </p>

                        </div>

                        <span>
                            Citizen
                        </span>

                    </div>

                `;

            }
        ).join("");

}


/* =====================================================
   LOAD REPORTS
===================================================== */

function loadAdminReports() {

    const complaints =
        getAdminComplaints();


    const total =
        complaints.length;


    const resolved =
        complaints.filter(
            function(item) {

                return item.status ===
                    "Resolved";

            }
        ).length;


    const pending =
        total - resolved;


    document.getElementById(
        "reportTotal"
    ).textContent = total;


    document.getElementById(
        "reportResolved"
    ).textContent = resolved;


    document.getElementById(
        "reportPending"
    ).textContent = pending;

}

Object.assign(window, {
    showCitizenPage,
    backToCitizen,
    adminLogout,
    showAdminSection,
    loadAdminComplaints
});
