"use strict";

/* Giao diện chỉ dựng DOM bằng createElement/textContent: tên thư mục, tên tệp, tên khách
   không bao giờ được chèn dưới dạng HTML. */

const $ = (id) => document.getElementById(id);
const bridge = window.drive;
let state = null;
let currentFolder = null;
let currentIncludeAllFiles = false;
let toastTimer = null;
let queuedShareRequest = null;
let shareMessageEdited = false;
let renderedShares = [];
const faceProgress = new Map();

const STATUS_TEXT = {
  idle: "Chưa kết nối",
  online: "Đang trực tuyến",
  offline: "Mất kết nối máy chủ",
  suspended: "Studio đang bị tạm khóa",
  revoked: "Đã bị gỡ kết nối",
};

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = String(text);
  return node;
}

function toast(message) {
  const box = $("toast");
  box.textContent = message;
  box.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (box.hidden = true), 3500);
}

function showError(id, message) {
  const node = $(id);
  node.textContent = message || "";
  node.hidden = !message;
}

async function call(name, payload) {
  const result = await bridge[name](payload);
  if (!result.ok) throw new Error(result.error);
  return result.data;
}

function formatBytes(bytes) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function renderStatus(status) {
  const pill = $("status");
  pill.className = `pill ${status}`;
  pill.textContent = STATUS_TEXT[status] || status;
}

function applyState(next) {
  state = next;
  $("view-pair").hidden = state.paired;
  $("view-main").hidden = !state.paired;
  $("studio").textContent = state.paired ? `${state.studioName || ""} · ${state.deviceName || ""}` : "";
  renderStatus(state.paired ? state.status : state.status === "revoked" ? "revoked" : "idle");
  $("pair-server").value = state.serverUrl;
  $("drop-hint").textContent =
    state.platform === "darwin"
      ? "Kéo thả thư mục vào cửa sổ này; chuột phải thư mục → chọn tác vụ trong “StudioCore Drive” ở mục Dịch vụ, hoặc kéo thư mục vào biểu tượng ứng dụng."
      : "Kéo thả thư mục vào cửa sổ này, hoặc bật menu StudioCore Drive trong Cài đặt.";
  if (state.paired) void refresh();
}

function button(label, onClick, className) {
  const node = el("button", `small ${className || ""}`.trim(), label);
  node.type = "button";
  node.addEventListener("click", async () => {
    node.disabled = true;
    try {
      await onClick();
    } catch (error) {
      toast(error.message);
    } finally {
      node.disabled = false;
    }
  });
  return node;
}

function renderShares(shares) {
  renderedShares = shares;
  const list = $("shares");
  list.replaceChildren();
  $("empty").hidden = shares.length > 0;
  for (const share of shares) {
    const item = el("li", "share");
    const head = el("div", "share-head");
    head.append(el("span", "share-title", share.title));
    head.append(el("span", "tag", share.kind === "select" ? "Chọn ảnh" : "Giao file"));
    if (share.expired) head.append(el("span", "tag bad", "Hết hạn"));
    else if (share.status === "paused") head.append(el("span", "tag warn", "Tạm dừng"));
    else head.append(el("span", "tag ok", "Đang mở"));
    if (share.hasPin) head.append(el("span", "tag", "Có PIN"));
    if (share.submittedAt) head.append(el("span", "tag ok", "Khách đã gửi"));
    item.append(head);

    const meta = [
      share.clientName,
      `${share.fileCount} tệp`,
      formatBytes(share.totalBytes),
      `${share.viewCount} lượt xem`,
      share.kind === "select" ? `đã chọn ${share.pickedCount}${share.maxSelect ? `/${share.maxSelect}` : ""}` : null,
      share.folderName ? `thư mục: ${share.folderName}` : "tạo từ máy khác",
    ].filter(Boolean);
    item.append(el("div", "muted", meta.join(" · ")));
    const progress = faceProgress.get(share.id);
    if (share.faceSearch && progress) {
      item.append(el("div", "muted", `Đang quét khuôn mặt ${progress.done}/${progress.total}`));
    }
    item.append(el("div", "share-url", share.url));
    if (share.submissionNote) item.append(el("div", "muted", `Lời nhắn: ${share.submissionNote}`));

    const actions = el("div", "share-actions");
    actions.append(
      button("Sao chép link", async () => {
        await call("copyText", share.url);
        toast("Đã sao chép link.");
      }),
      button("Mở link", () => call("openLink", share.url)),
    );
    if (share.folder) {
      actions.append(
        button("Mở thư mục", () => call("openFolder", share.id)),
        button(share.faceSearch ? "Tắt tìm khuôn mặt" : "Bật tìm khuôn mặt", async () => {
          await call("updateShare", { id: share.id, faceSearch: !share.faceSearch });
          await refresh();
        }),
        button("Quét lại", async () => {
          const result = await call("rescanShare", share.id);
          toast(`Đã cập nhật ${result.count} tệp.`);
          await refresh();
        }),
      );
      if (share.kind === "select" && share.pickedCount > 0) {
        actions.append(
          button("Lọc ảnh đã chọn", async () => {
            const result = await call("copyPicks", share.id);
            await call("copyText", result.codes.join(", "));
            toast(`Đã chép ${result.copied} tệp. Mã ảnh đã nằm trong bộ nhớ tạm.`);
          }),
        );
      }
    }
    if (share.submittedAt) {
      actions.append(
        button("Cho chọn lại", async () => {
          await call("updateShare", { id: share.id, reopen: true });
          await refresh();
        }),
      );
    }
    actions.append(
      button(share.status === "active" ? "Tạm dừng" : "Mở lại", async () => {
        await call("updateShare", { id: share.id, status: share.status === "active" ? "paused" : "active" });
        await refresh();
      }),
      button(
        "Xóa link",
        async () => {
          if (!window.confirm(`Xóa link “${share.title}”? Ảnh trên máy không bị ảnh hưởng.`)) return;
          await call("deleteShare", share.id);
          await refresh();
        },
        "danger",
      ),
    );
    item.append(actions);
    list.append(item);
  }
}

async function refresh() {
  try {
    renderShares(await call("listShares"));
    showError("main-error", "");
  } catch (error) {
    showError("main-error", error.message);
  }
}

function syncKind() {
  const deliver = document.querySelector('input[name="kind"]:checked').value === "deliver";
  $("row-max").hidden = deliver;
  $("row-original").hidden = deliver;
  if (!shareMessageEdited) {
    $("share-message").value = state.settings.messageShared
      ? state.settings.defaultMessageSelect
      : deliver
        ? state.settings.defaultMessageDeliver
        : state.settings.defaultMessageSelect;
  }
}

async function openShareDialog(request) {
  const options = typeof request === "string" ? { folder: request } : request || {};
  const folder = options.folder;
  const includeAllFiles = options.includeAllFiles === true;
  if (!state || !state.paired) {
    toast("Hãy kết nối với studio trước.");
    return;
  }
  try {
    const info = await call("previewFolder", { folder, includeAllFiles });
    if (info.count === 0) {
      toast(includeAllFiles ? "Thư mục không có tệp nào." : "Thư mục không có ảnh hoặc video nào.");
      return;
    }
    currentFolder = info.folder;
    currentIncludeAllFiles = includeAllFiles;
    $("share-folder").textContent = info.folder;
    const otherSummary = includeAllFiles && info.others ? ` · ${info.others} tệp khác` : "";
    const rawSummaryLabel = includeAllFiles ? "RAW" : "RAW lẻ";
    $("share-summary").textContent =
      `${info.images} ảnh · ${info.raws} ${rawSummaryLabel} · ${info.videos} video${otherSummary} · ${formatBytes(info.bytes)}`;
    $("share-title").value = info.name;
    $("share-client").value = "";
    $("share-pin").value = "";
    $("share-faces").checked = false;
    shareMessageEdited = false;
    $("share-message").value = "";
    showError("share-error", "");
    if (options.kind === "select" || options.kind === "deliver") {
      document.querySelector(`input[name="kind"][value="${options.kind}"]`).checked = true;
    }
    if (typeof options.allowOriginal === "boolean") {
      $("share-original").checked = options.allowOriginal;
    }
    syncKind();
    if (!$("dlg-share").open) $("dlg-share").showModal();
  } catch (error) {
    toast(error.message);
  }
}

function handleShareRequest(request) {
  if (!state) {
    queuedShareRequest = request;
    return;
  }
  void openShareDialog(request);
}

$("pair-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  showError("pair-error", "");
  try {
    applyState(await call("pair", { code: $("pair-code").value, serverUrl: $("pair-server").value }));
    $("pair-code").value = "";
  } catch (error) {
    showError("pair-error", error.message);
  }
});

$("btn-share").addEventListener("click", async () => {
  const folder = await call("pickFolder").catch(() => null);
  if (folder) await openShareDialog(folder);
});
$("btn-refresh").addEventListener("click", refresh);
for (const radio of document.querySelectorAll('input[name="kind"]')) radio.addEventListener("change", syncKind);
$("share-message").addEventListener("input", () => {
  shareMessageEdited = true;
});
$("share-cancel").addEventListener("click", () => $("dlg-share").close());

$("share-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const submit = $("share-submit");
  submit.disabled = true;
  submit.textContent = "Đang tạo…";
  showError("share-error", "");
  try {
    const result = await call("createShare", {
      folder: currentFolder,
      title: $("share-title").value,
      clientName: $("share-client").value,
      message: $("share-message").value,
      kind: document.querySelector('input[name="kind"]:checked').value,
      includeAllFiles: currentIncludeAllFiles,
      pin: $("share-pin").value,
      maxSelect: Number($("share-max").value),
      allowOriginal: $("share-original").checked,
      faceSearch: $("share-faces").checked,
      expiresInDays: Number($("share-days").value),
    });
    $("dlg-share").close();
    toast(`Đã tạo link (${result.count} tệp) và sao chép vào bộ nhớ tạm.`);
    await refresh();
  } catch (error) {
    showError("share-error", error.message);
  } finally {
    submit.disabled = false;
    submit.textContent = "Tạo link";
  }
});

$("btn-settings").addEventListener("click", () => {
  const s = state.settings;
  $("set-autocopy").checked = s.autoCopyPicks;
  $("set-keep-awake").checked = s.keepAwake;
  $("set-folder").value = s.picksFolderName;
  $("set-message-shared").checked = s.messageShared;
  $("set-message-select").value = s.defaultMessageSelect;
  $("set-message-deliver").value = s.defaultMessageDeliver;
  $("row-message-deliver").hidden = s.messageShared;
  $("label-message-select").textContent = s.messageShared ? "Lời nhắn mặc định cho cả hai loại link" : "Lời nhắn mặc định cho link chọn ảnh";
  $("set-login").checked = s.launchAtLogin;
  $("set-context").checked = s.contextMenu;
  $("row-context").hidden = state.platform !== "win32" && state.platform !== "darwin";
  $("mac-hint").hidden = state.platform !== "darwin";
  $("set-device").textContent = `${state.deviceName || ""} · ${state.serverUrl} · v${state.version}`;
  showError("set-error", "");
  $("dlg-settings").showModal();
});

async function saveSetting(patch) {
  try {
    state = await call("setSettings", patch);
    showError("set-error", "");
  } catch (error) {
    showError("set-error", error.message);
  }
}
$("set-autocopy").addEventListener("change", (e) => saveSetting({ autoCopyPicks: e.target.checked }));
$("set-keep-awake").addEventListener("change", (e) => saveSetting({ keepAwake: e.target.checked }));
$("set-login").addEventListener("change", (e) => saveSetting({ launchAtLogin: e.target.checked }));
$("set-context").addEventListener("change", (e) => saveSetting({ contextMenu: e.target.checked }));
$("set-folder").addEventListener("change", async (e) => {
  await saveSetting({ picksFolderName: e.target.value });
  e.target.value = state.settings.picksFolderName;
});
$("set-message-shared").addEventListener("change", (e) => {
  const shared = e.target.checked;
  $("row-message-deliver").hidden = shared;
  $("label-message-select").textContent = shared ? "Lời nhắn mặc định cho cả hai loại link" : "Lời nhắn mặc định cho link chọn ảnh";
  saveSetting({ messageShared: shared });
});
$("set-message-select").addEventListener("change", (e) => saveSetting({ defaultMessageSelect: e.target.value }));
$("set-message-deliver").addEventListener("change", (e) => saveSetting({ defaultMessageDeliver: e.target.value }));
$("set-close").addEventListener("click", () => $("dlg-settings").close());
$("set-unpair").addEventListener("click", async () => {
  if (!window.confirm("Ngắt kết nối máy này khỏi studio? Các link đã tạo sẽ không mở được cho tới khi kết nối lại.")) return;
  $("dlg-settings").close();
  applyState(await call("unpair"));
});

window.addEventListener("dragover", (event) => {
  event.preventDefault();
  document.body.classList.add("dragging");
});
window.addEventListener("dragleave", () => document.body.classList.remove("dragging"));
window.addEventListener("drop", (event) => {
  event.preventDefault();
  document.body.classList.remove("dragging");
  const file = event.dataTransfer && event.dataTransfer.files[0];
  const folder = file ? bridge.pathForFile(file) : null;
  if (folder) void openShareDialog(folder);
});

bridge.on("status", ({ status }) => {
  if (!state) return;
  state.status = status;
  if (status === "revoked") void call("state").then(applyState);
  else renderStatus(status);
});
bridge.on("submission", () => void refresh());
bridge.on("share-request", handleShareRequest);
bridge.on("face-index", ({ shareId, done, total }) => {
  if (done >= total) faceProgress.delete(shareId);
  else faceProgress.set(shareId, { done, total });
  if (done === 0 || done >= total || done % 10 === 0) renderShares(renderedShares);
});

setInterval(() => {
  if (state && state.paired && !document.hidden) void refresh();
}, 30000);

call("state").then((initial) => {
  applyState(initial);
  const request = queuedShareRequest ?? initial.pendingShare;
  queuedShareRequest = null;
  if (request) void openShareDialog(request);
});
