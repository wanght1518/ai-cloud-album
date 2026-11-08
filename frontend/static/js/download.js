let photos = [];
const BASE_URL = (localStorage.getItem("API_BASE_URL") || "http://localhost:5000").replace(/\/+$/, "");
let searchTimer = null;
let searchController = null;
let searchVersion = 0;
let renderVersion = 0;
let visiblePhotos = [];

window.onload = async function() {
    if (!localStorage.getItem("token")) {
        location.href = "login.html";
        return;
    }

    const username = localStorage.getItem("username") || "User";
    document.getElementById("userName").innerText = "Hello, " + username;
    localStorage.removeItem("photos");

    await loadImageList();
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

async function loadImageList() {
    try {
        const res = await fetch(BASE_URL + "/api/images", {
            headers: {
                "Authorization": "Bearer " + localStorage.getItem("token")
            }
        });
        const data = await res.json();

        if (data.success) {
            photos = data.data;
            if (!document.getElementById("searchInput").value.trim()) {
                await renderImageGrid(photos);
            }
        }
    } catch (err) {
        console.error("Load images error", err);
        alert("Failed to load image");
    }
}

async function renderImageGrid(photos) {
    const version = ++renderVersion;
    visiblePhotos = photos;
    const grid = document.getElementById("imageGrid");
    grid.innerHTML = "";

    for (const photo of photos) {
        const card = document.createElement("div");
        const imgUrl = await getPresignedUrl(photo.s3_key);
        if (version !== renderVersion) return;

        card.className = "image-card";
        card.innerHTML = `
            <input
                type="checkbox"
                class="download-checkbox"
                value="${photo.image_id}"
                style="position:absolute; top:8px; right:8px; width:22px; height:22px; z-index:10;">
            <img src="${imgUrl}" alt="photo" style="width:100%; height:100%; object-fit:cover;">
        `;

        grid.appendChild(card);
    }
}

function invalidateSearch() {
    clearTimeout(searchTimer);
    if (searchController) searchController.abort();
    searchController = null;
    ++renderVersion;
    return ++searchVersion;
}

function showSearchMessage(message) {
    const grid = document.getElementById("imageGrid");
    grid.replaceChildren();
    const notice = document.createElement("p");
    notice.textContent = message;
    grid.appendChild(notice);
}

function searchPhotos() {
    const version = invalidateSearch();
    const query = document.getElementById("searchInput").value.trim();

    if (!query) {
        renderImageGrid(photos);
        return;
    }

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

        await renderImageGrid(data.data);
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

function getSelectedPhotos() {
    const selected = [];

    document.querySelectorAll(".download-checkbox:checked").forEach(cb => {
        selected.push(cb.value);
    });

    return selected;
}

async function createDownloadJob(imageIds) {
    const token = localStorage.getItem("token");
    const res = await fetch(`${BASE_URL}/api/images/download`, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            image_ids: imageIds
        })
    });
    const data = await res.json();

    if (!data.success) throw new Error(data.message);
    return data.data.job_id;
}

async function pollDownloadStatus(jobId) {
    const token = localStorage.getItem("token");
    const pollInterval = 1000;
    const maxRetries = 900;

    for (let i = 0; i < maxRetries; i++) {
        const res = await fetch(`${BASE_URL}/api/jobs/${jobId}`, {
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });
        const data = await res.json();

        if (!res.ok || !data.success || !data.data) {
            throw new Error(data.message || "Failed to retrieve download status");
        }

        if (data.data.status === "complete") {
            const res_s3_key = data.data.result_s3_key;
            if (!res_s3_key) {
                throw new Error("Download result is missing");
            }

            const zipUrl = await getPresignedUrl(res_s3_key);
            if (!zipUrl) {
                throw new Error("Failed to retrieve download URL");
            }

            return zipUrl;
        }

        if (data.data.status === "failed") {
            throw new Error("Fail to download");
        }

        await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    throw new Error("Download over time limit");
}

function triggerDownload(zipUrl) {
    const a = document.createElement("a");
    a.href = zipUrl;
    a.download = "album_images.zip";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

async function BatchDownload() {
    const selected = getSelectedPhotos();

    if (selected.length === 0) {
        alert("No photo selected!");
        return;
    }

    const btn = document.getElementById("downloadBtn");
    btn.disabled = true;
    btn.innerText = "Downloading ...";

    console.log("selected", selected);

    const token = localStorage.getItem("token");

    try {
        const jobId = await createDownloadJob(selected);
        const zipUrl = await pollDownloadStatus(jobId);
        triggerDownload(zipUrl);
    } catch (err) {
        console.error(err);
        alert("Download failed, please try again.");
    }

    btn.disabled = false;
    btn.innerText = "Download";
}

// Navigation
function goHome() {
    location.href = "index.html";
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

function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    localStorage.removeItem("user_id");
    localStorage.removeItem("photos");
    location.href = "login.html";
}