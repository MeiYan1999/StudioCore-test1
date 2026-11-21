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

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function postJson(url, payload = {}) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Lỗi ${res.status}`);
  }
  return data;
}

const CONNECTION_LABELS = {
  online: { text: "Đã kết nối StudioCore SaaS", color: "#10b981" },
  offline: { text: "Không kết nối được máy chủ SaaS (Offline)", color: "#f59e0b" },
  unauthorized: { text: "Khóa kết nối không hợp lệ", color: "#ef4444" },
  unknown: { text: "Đang kiểm tra kết nối SaaS...", color: "#94a3b8" },
};

function setStatusDot(color) {
  const dot = document.querySelector(".pulse-dot");
  if (!dot) return;
  dot.style.background = color;
  dot.style.boxShadow = `0 0 10px ${color}`;
}

let sharesById = new Map();
let settingsHydrated = false;

function hydrateSettings(data) {
  document.getElementById("serverUrl").value = data.serverUrl || "";
  document.getElementById("connectKey").value = data.connectKey || "";
  document.getElementById("autoFilterRaw").checked = data.autoFilterRaw !== false;
  document.getElementById("chimeSound").checked = data.chimeSound !== false;
  settingsHydrated = true;
}

// Fetch shares from local agent
async function loadAgentState() {
  try {
    const res = await fetch("/api/state", { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const conn = (data.connection && data.connection.state) || "unknown";
    const label = CONNECTION_LABELS[conn] || CONNECTION_LABELS.unknown;
    statusText.innerText = label.text;
    statusText.style.color = label.color;
    statusText.title = (data.connection && data.connection.message) || "";
    setStatusDot(label.color);
    hostInfo.innerText = `Máy: ${data.hostname || "Local PC"} (${data.os || "OS"})`;

    if (!settingsHydrated) hydrateSettings(data);
    renderShares(data.shares || []);
    return data;
  } catch {
    statusText.innerText = "Mất kết nối với Desktop Agent";
    statusText.style.color = "#ef4444";
    setStatusDot("#ef4444");
    return null;
  }
}

function renderShares(shares) {
  sharesById = new Map(shares.map((share) => [String(share.id), share]));
  if (shares.length === 0) {
    sharesList.innerHTML = `
      <div style="text-align: center; padding: 40px; color: var(--text-muted);">
        Chưa có thư mục nào được chia sẻ. Kéo thả thư mục vào ô trên hoặc chuột phải thư mục để tạo link.
      </div>
    `;
    return;
  }

  sharesList.innerHTML = shares
    .map((share) => {
      const isPaused = share.status === "paused";
      const id = escapeHtml(share.id);
      return `
    <div class="share-card ${isPaused ? "is-paused" : ""}">
      <div class="share-card-info">
        <div style="display: flex; align-items: center; gap: 8px;">
          <h4>${escapeHtml(share.title)}</h4>
          <span style="font-size: 10px; background: rgba(124, 58, 237, 0.2); color: #a78bfa; padding: 2px 6px; border-radius: 4px;">${escapeHtml(String(share.type || "").toUpperCase())}</span>
          <span class="status-badge ${isPaused ? "badge-paused" : "badge-active"}">
            <span class="dot ${isPaused ? "dot-paused" : "dot-active"}"></span>
            ${isPaused ? "Đã dừng chia sẻ" : "Đang chia sẻ"}
          </span>
        </div>
        <p class="path">${escapeHtml(share.localPath)}</p>
      </div>
      <div class="share-card-actions">
        <button class="btn btn-primary" data-action="copy" data-id="${id}">Copy Link</button>
        <button class="btn btn-secondary" data-action="open" data-id="${id}">Mở Web</button>
        <button class="btn ${isPaused ? "btn-warning" : "btn-outline"}" data-action="toggle" data-id="${id}">
          ${isPaused ? "Tiếp tục chia sẻ" : "Dừng chia sẻ"}
        </button>
        <button class="btn btn-danger" data-action="delete" data-id="${id}">Xóa</button>
      </div>
    </div>
  `;
    })
    .join("");
}

function safeHttpUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.href : null;
  } catch {
    return null;
  }
}

async function toggleShare(share) {
  try {
    const data = await postJson("/api/toggle-share", { shareId: share.id });
    if (data.success) {
      showToast(data.status === "paused" ? "Đã dừng chia sẻ thư mục." : "Đã kích hoạt lại chia sẻ!");
      loadAgentState();
    } else {
      showToast("Không tìm thấy chia sẻ.");
    }
  } catch (err) {
    showToast(`Lỗi khi thay đổi trạng thái chia sẻ: ${err.message}`);
  }
}

async function deleteShare(share) {
  const title = share.title || "";
  const confirmed = window.confirm(
    `Bạn có chắc chắn muốn xóa chia sẻ "${title}"?\nKhách sẽ không thể xem hoặc chọn ảnh qua link này nữa.`
  );
  if (!confirmed) return;

  try {
    const data = await postJson("/api/delete-share", { shareId: share.id });
    if (data.success) {
      showToast(`Đã xóa chia sẻ "${title}"!`);
      loadAgentState();
    } else {
      showToast("Không thể xóa chia sẻ.");
    }
  } catch (err) {
    showToast(`Lỗi khi xóa chia sẻ: ${err.message}`);
  }
}

sharesList.addEventListener("click", (e) => {
  const button = e.target.closest("button[data-action]");
  if (!button) return;
  const share = sharesById.get(button.dataset.id);
  if (!share) return;
  const url = safeHttpUrl(share.publicUrl);

  switch (button.dataset.action) {
    case "copy":
      if (!url) return showToast("Chia sẻ này chưa có link hợp lệ.");
      navigator.clipboard.writeText(url);
      showToast("Đã sao chép link gửi khách vào clipboard!");
      break;
    case "open":
      if (!url) return showToast("Chia sẻ này chưa có link hợp lệ.");
      window.open(url, "_blank", "noopener");
      break;
    case "toggle":
      toggleShare(share);
      break;
    case "delete":
      deleteShare(share);
      break;
  }
});

async function shareFolder(folderPath) {
  showToast(`Đang quét thư mục: ${folderPath}...`);
  try {
    const data = await postJson("/api/share-folder", { path: folderPath });
    if (data.publicUrl) {
      navigator.clipboard.writeText(data.publicUrl).catch(() => {});
      showToast(`Đã tạo link: ${data.publicUrl}`);
    } else {
      showToast("Không thể tạo link chia sẻ cho thư mục này.");
    }
  } catch (err) {
    showToast(`Không thể tạo link: ${err.message}`);
  }
  loadAgentState();
}

async function pickAndShareFolder() {
  try {
    const picked = await postJson("/api/pick-folder");
    if (picked.path) {
      await shareFolder(picked.path);
      return;
    }
    if (!picked.unsupported) return;
  } catch (err) {
    showToast(`Không mở được hộp thoại chọn thư mục: ${err.message}`);
  }
  const typed = window.prompt("Nhập đường dẫn đầy đủ của thư mục cần chia sẻ:");
  if (typed && typed.trim()) await shareFolder(typed.trim());
}

document.getElementById("btnQuickShare").addEventListener("click", pickAndShareFolder);
document.getElementById("btnSelectFolder").addEventListener("click", pickAndShareFolder);

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
  settingsHydrated = false;
  loadAgentState();
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
  if (files.length === 0) return;
  // Chỉ Electron mới có file.path; trình duyệt thường không cho biết đường dẫn thật.
  const droppedPath = files[0].path;
  if (droppedPath) {
    await shareFolder(droppedPath);
    return;
  }
  showToast("Trình duyệt không cho biết đường dẫn thư mục vừa kéo vào. Vui lòng chọn thư mục.");
  await pickAndShareFolder();
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
    await postJson("/api/save-config", { serverUrl, connectKey, autoFilterRaw, chimeSound });
    showToast("Đã lưu cấu hình kết nối!");
    settingsHydrated = false;
    setTimeout(loadAgentState, 1500);
  } catch (err) {
    showToast(`Không lưu được cấu hình: ${err.message}`);
  }
});

// Initial load
loadAgentState();
setInterval(loadAgentState, 10000);
