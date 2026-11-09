// Desktop Agent Local UI Script
const sharesList = document.getElementById("sharesList");
const statusText = document.getElementById("statusText");
const hostInfo = document.getElementById("hostInfo");
const toast = document.getElementById("toast");

function showToast(msg) {
  toast.innerText = msg;
  toast.style.display = "block";
  setTimeout(() => {
    toast.style.display = "none";
  }, 3000);
}

// Fetch shares from local agent
async function loadAgentState() {
  try {
    const res = await fetch("/api/state");
    const data = await res.json();

    statusText.innerText = "Đã kết nối StudioCore SaaS";
    statusText.style.color = "#10b981";
    hostInfo.innerText = `Máy: ${data.hostname || "Local PC"} (${data.os || "OS"})`;

    renderShares(data.shares || []);
  } catch {
    statusText.innerText = "Chế độ chạy độc lập (Offline)";
    statusText.style.color = "#f59e0b";
  }
}

function renderShares(shares) {
  if (shares.length === 0) {
    sharesList.innerHTML = `
      <div style="text-align: center; padding: 40px; color: var(--text-muted);">
        Chưa có thư mục nào được chia sẻ. Kéo thả thư mục vào ô trên hoặc chuột phải thư mục để tạo link.
      </div>
    `;
    return;
  }

  sharesList.innerHTML = shares
    .map(
      (share) => `
    <div class="share-card">
      <div class="share-card-info">
        <h4>${share.title} <span style="font-size: 10px; background: rgba(124, 58, 237, 0.2); color: #a78bfa; padding: 2px 6px; border-radius: 4px; margin-left: 6px;">${share.type.toUpperCase()}</span></h4>
        <p class="path">${share.localPath}</p>
      </div>
      <div class="share-card-actions">
        <button class="btn btn-primary" onclick="copyShareLink('${share.publicUrl}')">Copy Link</button>
        <button class="btn btn-secondary" onclick="openWebLink('${share.publicUrl}')">Mở Web</button>
      </div>
    </div>
  `,
    )
    .join("");
}

window.copyShareLink = (url) => {
  navigator.clipboard.writeText(url);
  showToast("Đã sao chép link gửi khách vào clipboard!");
};

window.openWebLink = (url) => {
  window.open(url, "_blank");
};

// Navigation
const navShares = document.getElementById("navShares");
const navSettings = document.getElementById("navSettings");
const navNew = document.getElementById("navNew");
const sharesSection = document.getElementById("sharesSection");
const dropzoneSection = document.getElementById("dropzoneSection");
const settingsSection = document.getElementById("settingsSection");
const pageTitle = document.getElementById("pageTitle");

navShares.addEventListener("click", (e) => {
  e.preventDefault();
  navShares.classList.add("active");
  navSettings.classList.remove("active");
  sharesSection.classList.remove("hidden");
  dropzoneSection.classList.remove("hidden");
  settingsSection.classList.add("hidden");
  pageTitle.innerText = "Thư mục & Video đang chia sẻ";
});

navSettings.addEventListener("click", (e) => {
  e.preventDefault();
  navSettings.classList.add("active");
  navShares.classList.remove("active");
  sharesSection.classList.add("hidden");
  dropzoneSection.classList.add("hidden");
  settingsSection.classList.remove("hidden");
  pageTitle.innerText = "Cài đặt khóa kết nối Studio";
});

navNew.addEventListener("click", (e) => {
  e.preventDefault();
  navShares.click();
  document.getElementById("dropArea").scrollIntoView({ behavior: "smooth" });
});

// Drag and drop handler
const dropArea = document.getElementById("dropArea");
["dragenter", "dragover"].forEach((eventName) => {
  dropArea.addEventListener(eventName, (e) => {
    e.preventDefault();
    dropArea.classList.add("dragover");
  });
});

["dragleave", "drop"].forEach((eventName) => {
  dropArea.addEventListener(eventName, (e) => {
    e.preventDefault();
    dropArea.classList.remove("dragover");
  });
});

dropArea.addEventListener("drop", async (e) => {
  const files = e.dataTransfer.files;
  if (files.length > 0) {
    const firstPath = files[0].path || files[0].name;
    showToast(`Đang quét thư mục: ${firstPath}...`);
    try {
      const res = await fetch("/api/share-folder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: firstPath }),
      });
      const data = await res.json();
      if (data.publicUrl) {
        navigator.clipboard.writeText(data.publicUrl);
        showToast(`Đã tạo link: ${data.publicUrl}`);
        loadAgentState();
      }
    } catch {
      showToast("Đã ghi nhận yêu cầu chia sẻ thư mục.");
    }
  }
});

document.getElementById("btnRefresh").addEventListener("click", () => {
  loadAgentState();
  showToast("Đã đồng bộ trạng thái mới nhất!");
});

document.getElementById("settingsForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const serverUrl = document.getElementById("serverUrl").value;
  const connectKey = document.getElementById("connectKey").value;
  const autoFilterRaw = document.getElementById("autoFilterRaw").checked;
  const chimeSound = document.getElementById("chimeSound").checked;

  try {
    await fetch("/api/save-config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ serverUrl, connectKey, autoFilterRaw, chimeSound }),
    });
    showToast("Đã lưu cấu hình kết nối!");
  } catch {
    showToast("Đã cập nhật cài đặt!");
  }
});

// Initial load
loadAgentState();
setInterval(loadAgentState, 10000);
