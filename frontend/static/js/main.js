const BASE_URL = (localStorage.getItem("API_BASE_URL") || "http://localhost:5000").replace(/\/+$/, "");
let photos = [];
let is_Deleting = false;
let searchTimer = null;
let searchController = null;
let searchVersion = 0;
let renderVersion = 0;
let visiblePhotos = [];
let photoRefreshTimer = null;
let photoRefreshErrors = 0;

// Login check
window.onload = async function() {
    if (!localStorage.getItem("token")) {
        location.href = "login.html";
        return;
    }

    const username = localStorage.getItem("username") || "User";
    var node = document.getElementById("userName");
    node.textContent = "Hello, " + username;
    localStorage.removeItem("photos");
    await loadPhotoList();
};

async function getPresignedUrl(s3_key) {
    try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${BASE_URL}/api/utils/presigned-url`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                s3_key: s3_key
            })
        });
        const data = await res.json();
        if (data.success && data.data?.url) {
            return data.data.url;
        }
    } catch (e) {
        console.error("Fail to get photos", e);
    }
    return "";
}

async function loadPhotoList() {
    clearTimeout(photoRefreshTimer);

    if (!localStorage.getItem("token")) return;

    if (is_Deleting) {
        photoRefreshTimer = setTimeout(loadPhotoList, 3000);
        return;
    }

    let shouldRefresh = false;

    try {
        const headers = {
            "Authorization": "Bearer " + localStorage.getItem("token")
        };
        const res = await fetch(BASE_URL + "/api/images", { headers });
        const data = await res.json();

        if (!res.ok || !data.success || !Array.isArray(data.data)) {
            throw new Error(data.message || "Failed to load images");
        }

        shouldRefresh = data.data.some(
            photo => photo.status === "uploaded" || photo.status === "processing"
        );

        if (!is_Deleting) {
            photos = data.data;
            await loadCollections();

            if (is_Deleting) {
                shouldRefresh = true;
            } else if (!document.getElementById("searchInput").value.trim()) {
                await renderCurrentCollection();
            }
        } else {
            shouldRefresh = true;
        }

        const jobRes = await fetch(BASE_URL + "/api/jobs", { headers });
        const jobData = await jobRes.json();

        if (!jobRes.ok || !jobData.success || !Array.isArray(jobData.data)) {
            throw new Error(jobData.message || "Failed to load jobs");
        }

        shouldRefresh = shouldRefresh || jobData.data.some(
            job => job.type === "zip_upload" &&
                (job.status === "uploaded" || job.status === "processing")
        );

        photoRefreshErrors = 0;
    } catch (e) {
        console.error("Load photo error", e);
        photoRefreshErrors += 1;
        shouldRefresh = photoRefreshErrors < 3;
    } finally {
        if (shouldRefresh && localStorage.getItem("token")) {
            photoRefreshTimer = setTimeout(loadPhotoList, 3000);
        }
    }
}

async function renderPhotos(list) {
    const version = ++renderVersion;
    visiblePhotos = list;
    const album = document.getElementById("album");
    album.innerHTML = "";

    for (const p of list) {
        const item = document.createElement("div");
        item.className = "photo-item";
        item.style.position = "relative";

        const checkbox = is_Deleting
            ? `<input type="checkbox" class="delete-checkbox" value="${p.image_id}"
                style="position:absolute; top:5px; right:5px; width:20px; height:20px; z-index:10;">`
            : "";

        const imgUrl = await getPresignedUrl(p.s3_key);
        if (version !== renderVersion) return;

        console.log("Image URL", imgUrl);
        item.innerHTML = `
            ${checkbox}
            <img src="${imgUrl}" alt="photo" style="width:100%; height:100%; object-fit: cover; object-position: center; display: block;">
        `;

        item.onclick = (e) => {
            if (!is_Deleting && !e.target.classList.contains("delete-checkbox")) {
                openDetail(p.image_id);
            }
        };

        album.appendChild(item);
    }
}

// Details
function openDetail(id) {
    localStorage.setItem("currentPhotoId", id);
    window.location.href = "detail.html";
}

// serach
function invalidateSearch() {
    clearTimeout(searchTimer);
    if (searchController) searchController.abort();
    searchController = null;
    ++renderVersion;
    return ++searchVersion;
}

function showSearchMessage(message) {
    const grid = document.getElementById("album");
    grid.replaceChildren();
    const notice = document.createElement("p");
    notice.textContent = message;
    grid.appendChild(notice);
}

function searchPhotos() {
    const version = invalidateSearch();
    const query = document.getElementById("searchInput").value.trim();

    if (!query) {
        renderCurrentCollection();
        return;
    }

    document.getElementById("collectionSelect").value = "";
    visiblePhotos = [];
    showSearchMessage("Searching...");
    searchTimer = setTimeout(() => runSearch(query, version), 300);
}

async function runSearch(query, version) {
    if (version !== searchVersion) return;

    const controller = new AbortController();
    searchController = controller;

    try {
        const response = await fetch(
            `${BASE_URL}/api/images/search?q=${encodeURIComponent(query)}`,
            {
                headers: {
                    "Authorization": "Bearer " + localStorage.getItem("token")
                },
                signal: controller.signal
            }
        );
        const data = await response.json();

        if (version !== searchVersion) return;

        if (!response.ok || !data.success || !Array.isArray(data.data)) {
            throw new Error(data.message || "Search failed");
        }

        if (!data.data.length) {
            visiblePhotos = [];
            showSearchMessage("No matching photos.");
            return;
        }

        await renderPhotos(data.data);
    } catch (error) {
        if (version !== searchVersion || error.name === "AbortError") return;
        console.error("Search failed", error);
        showSearchMessage("Search failed. Please try again.");
    } finally {
        if (searchController === controller) {
            searchController = null;
        }
    }
}

// Main page
function goHome() {
    document.getElementById("searchInput").value = "";
    document.getElementById("collectionSelect").value = "";
    searchPhotos();
}

// Logout
function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    localStorage.removeItem("user_id");
    localStorage.removeItem("photos");
    location.href = "login.html";
}

function goUpload() {
    location.href = "upload.html";
}

function goDownload() {
    location.href = "download.html";
}

function goMapView() {
    location.href = "mapView.html";
}

function enterDeleteMode() {
    is_Deleting = true;
    document.getElementById("deleteBar").style.display = "block";
    document.getElementById("deletemode_btn").style.display = "none";
    renderPhotos(visiblePhotos);
}

function cancelDelete() {
    is_Deleting = false;
    document.getElementById("deleteBar").style.display = "none";
    document.getElementById("deletemode_btn").style.display = "block";
    renderPhotos(visiblePhotos);
}

async function confirmDelete() {
    const selectedIds = [];
    document.querySelectorAll(".delete-checkbox:checked").forEach(cb => {
        selectedIds.push(cb.value);
    });

    if (selectedIds.length === 0) {
        alert("Please select photos to delete!");
        return;
    }

    console.log("Deletequeue", selectedIds);

    if (!confirm("Confirm to delete selected photos?")) return;

    //replace this, uplaod delete request to backend.
    const token = localStorage.getItem("token");
    let allSuccess = true;

    try {
        for (const imageId of selectedIds) {
            const res = await fetch(`${BASE_URL}/api/images/${imageId}`, {
                method: "DELETE",
                headers: {
                    "Authorization": "Bearer " + token
                }
            });

            const response = await res.json();
            if (!response.success) {
                allSuccess = false;
                console.error(`Delete failed for ${imageId}: `, response.message);
            }
        }

        if (allSuccess) {
            alert("Delete Complete");
        } else {
            alert("Some image fail!");
        }

        cancelDelete();
        location.href = "index.html";
    } catch (e) {
        alert("Network error");
    }
}

let collectionGroups = new Map();

async function loadCollections() {
    try {
        const res = await fetch(BASE_URL + "/api/collections", {
            headers: {
                "Authorization": "Bearer " + localStorage.getItem("token")
            }
        });
        const data = await res.json();

        if (!res.ok || !data.success ||
            !Array.isArray(data.data?.by_label) ||
            !Array.isArray(data.data?.by_location)) {
            throw new Error(data.message || "Failed to load collections");
        }

        const select = document.getElementById("collectionSelect");
        const selected = select.value;
        const groups = new Map();
        const fragment = document.createDocumentFragment();
        const all = document.createElement("option");
        all.value = "";
        all.textContent = "All photos";
        fragment.appendChild(all);

        for (const [field, title, property] of [
            ["by_label", "By category", "label"],
            ["by_location", "By location", "location"]
        ]) {
            const optgroup = document.createElement("optgroup");
            optgroup.label = title;

            for (const group of data.data[field]) {
                if (!Array.isArray(group.images)) continue;

                const value = JSON.stringify([field, group[property]]);
                groups.set(
                    value,
                    new Set(group.images.map(image => image.image_id))
                );

                const option = document.createElement("option");
                option.value = value;
                option.textContent =
                    `${group[property]} (${group.images.length})`;
                optgroup.appendChild(option);
            }

            fragment.appendChild(optgroup);
        }

        collectionGroups = groups;
        select.replaceChildren(fragment);
        select.value = groups.has(selected) ? selected : "";
    } catch (e) {
        console.error("Load collections error", e);
    }
}

async function renderCurrentCollection() {
    const selected = document.getElementById("collectionSelect").value;
    const imageIds = collectionGroups.get(selected);
    const list = imageIds
        ? photos.filter(photo => imageIds.has(photo.image_id))
        : photos;

    if (!list.length) {
        ++renderVersion;
        visiblePhotos = [];
        showSearchMessage("No photos in this collection.");
        return;
    }

    await renderPhotos(list);
}

function selectCollection() {
    invalidateSearch();
    document.getElementById("searchInput").value = "";
    renderCurrentCollection();
}