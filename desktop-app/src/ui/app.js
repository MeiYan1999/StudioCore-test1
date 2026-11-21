"use strict";
const $ = (id) => document.getElementById(id);
const token = document.querySelector('meta[name="sc-token"]').content;
const labels = { album: "Chọn ảnh", view: "Chỉ xem", video: "Video", folder: "Thư mục" };
let state;
let tab = "shares";
let kind = "all";
let settingsLoaded = false;
let createForce = false;
function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = String(text);
  if (className) node.className = className;
  return node;
}
function button(text, handler, className) {
  const node = element("button", text, className);
  node.type = "button";
  node.addEventListener("click", () => safely(handler));
  return node;
}
let messageTimer;
function message(text) {
  $("message").textContent = String(text);
  $("message").hidden = false;
  clearTimeout(messageTimer);
  messageTimer = setTimeout(() => {
    $("message").hidden = true;
  }, 7000);
}
async function safely(work) {
  try {
    await work();
  } catch (error) {
    message(error.message);
  }
}
async function api(route, body) {
  const response = await fetch(route, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "X-SC-Token": token,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Thao tác không thành công.");
  return result;
}
const date = (value) => (value ? new Date(value).toLocaleString("vi-VN") : "—");
const template = (share) =>
  `Studio gửi bạn album ${share.title || ""}:\n${share.url || ""}${share.pin ? `\nMã PIN: ${share.pin}` : ""}\nBạn mở link để xem và chọn ảnh nhé!`;
async function copy(value) {
  if (!value) throw new Error("Chưa có link. Hãy đồng bộ lại kết nối.");
  await navigator.clipboard.writeText(value);
  message("Đã sao chép.");
}
async function open(value) {
  await api("/api/open", { path: value });
}
function switchTab(value) {
  tab = value;
  for (const name of ["shares", "filter", "logs", "settings"])
    $("tab-" + name).hidden = name !== tab;
  document
    .querySelectorAll("[data-tab]")
    .forEach((node) => node.classList.toggle("active", node.dataset.tab === tab));
  if (tab === "logs") void safely(loadLogs);
  if (tab === "settings" && state) renderSettings();
  if (tab === "filter" && state) filterOptions();
}
function renderShares() {
  const search = $("search").value.toLocaleLowerCase();
  const shares = state.shares.filter(
    (share) =>
      (kind === "all" || share.kind === kind) &&
      [share.title, share.customerName, share.rootPath]
        .join(" ")
        .toLocaleLowerCase()
        .includes(search),
  );
  $("share-list").replaceChildren();
  if (!shares.length)
    $("share-list").append(
      element("div", "Chưa có album phù hợp. Tạo link mới để bắt đầu.", "empty"),
    );
  for (const share of shares) {
    const card = element("article", undefined, "share-card");
    const info = element("div");
    info.append(
      element("span", labels[share.kind], "badge"),
      element(
        "span",
        share.selectionStatus === "finalized" ? "Đã chốt" : "Đang chọn",
        "badge" + (share.selectionStatus === "finalized" ? " finalized" : ""),
      ),
      element(
        "span",
        { active: "Hoạt động", paused: "Tạm dừng", revoked: "Đã xóa" }[share.status],
        "badge",
      ),
    );
    info.append(
      element("h2", share.title || "Album chưa đặt tên"),
      element("p", share.customerName || "Chưa có tên khách"),
      element("p", share.rootPath, "path"),
    );
    const meta = element("div", undefined, "meta");
    for (const text of [
      `${share.fileCount} tệp`,
      `${share.likedCount || 0}/${share.maxSelect || "∞"} đã chọn`,
      `PIN: ${share.pin || (share.pinProtected ? "Đã đặt trên web" : "Không có")}`,
      date(share.createdAt),
    ])
      meta.append(element("span", text));
    info.append(meta);
    const actions = element("div", undefined, "share-actions");
    actions.append(
      button("Sao chép link", () => copy(share.url)),
      button("Sao chép tin nhắn", () => copy(template(share))),
      button("Mở", () => open(share.url)),
      button("Xem ảnh khách chọn", () => selection(share)),
      button("Lọc ảnh", () => filterShare(share)),
    );
    if (share.status !== "revoked") {
      actions.append(
        button(share.status === "paused" ? "Mở lại" : "Tạm dừng", async () => {
          await api("/api/share-action", {
            id: share.id,
            action: share.status === "paused" ? "active" : "paused",
          });
          await refresh();
        }),
      );
      if (share.selectionStatus === "finalized")
        actions.append(
          button("Mở lại cho khách chọn", async () => {
            await api("/api/share-action", { id: share.id, action: "reopen" });
            await refresh();
          }),
        );
      actions.append(
        button("Xóa", async () => {
          if (confirm(`Thu hồi link “${share.title}”? Tệp gốc không bị xóa.`)) {
            await api("/api/share-action", { id: share.id, action: "delete" });
            await refresh();
          }
        }),
      );
    }
    card.append(info, actions);
    $("share-list").append(card);
  }
}
async function selection(share) {
  const response = await api("/api/share-action", { id: share.id, action: "selection" });
  const result = response.selection || response;
  $("selection-list").replaceChildren(element("h3", share.title));
  for (const item of result.items)
    $("selection-list").append(
      element("p", `${item.liked ? "♥ " : ""}${item.code} · ${item.note || "Không có ghi chú"}`),
    );
  $("selection-list").append(
    button("Sao chép mã đã chọn", () =>
      copy(
        result.items
          .filter((item) => item.liked)
          .map((item) => item.code)
          .join(", "),
      ),
    ),
  );
  $("selection-dialog").showModal();
}
function codes(value) {
  return [
    ...new Map(
      String(value)
        .split(/[\s,;|]+/)
        .map((code) => code.replace(/\.[^.]+$/, ""))
        .filter(Boolean)
        .map((code) => [code.toLocaleLowerCase(), code]),
    ).values(),
  ];
}
function filterOptions() {
  const previous = $("filter-share").value;
  $("filter-share").replaceChildren(new Option("Dán mã thủ công", ""));
  for (const share of state.shares.filter((share) => share.kind === "album"))
    $("filter-share").add(new Option(share.title, share.id));
  $("filter-share").value = previous;
}
async function filterShare(share) {
  switchTab("filter");
  $("filter-share").value = share.id;
  $("filter-source").value = share.rootPath;
  await loadSelectionCodes();
}
async function loadSelectionCodes() {
  const id = $("filter-share").value;
  if (!id) {
    $("filter-codes").readOnly = false;
    return;
  }
  const share = state.shares.find((share) => share.id === id);
  $("filter-source").value = share.rootPath;
  const result = await api("/api/share-action", { id, action: "selection" });
  $("filter-codes").value = (result.selection || result).items
    .filter((item) => item.liked)
    .map((item) => item.code)
    .join(", ");
  $("filter-codes").readOnly = true;
  countCodes();
}
function countCodes() {
  $("code-count").textContent = `${codes($("filter-codes").value).length} mã ảnh`;
}
async function filterRun(copyFiles) {
  if (!$("filter-form").reportValidity()) return;
  const result = await api(
    copyFiles ? "/api/filter/copy" : "/api/filter/preview",
    Object.fromEntries(new FormData($("filter-form"))),
  );
  const panel = $("filter-result");
  panel.hidden = false;
  panel.replaceChildren(
    element("h2", copyFiles ? `Đã copy ${result.copied.length} tệp` : "Kết quả xem trước"),
  );
  panel.append(
    element(
      "p",
      `${result.matched} mã khớp · ${result.missing.length} không tìm thấy · ${result.ambiguous.length} mã có nhiều tệp (sẽ copy tất cả)`,
    ),
  );
  for (const item of result.matches)
    panel.append(
      element(
        "p",
        `${item.code}: ${item.files.map((file) => file.relative).join(" · ") || "Không tìm thấy"}`,
      ),
    );
  if (copyFiles)
    panel.append(
      element("pre", result.text),
      button("Mở thư mục", () => open(result.output)),
    );
}
const settingGroups = [
  [
    "Kết nối",
    [
      ["serverUrl", "Máy chủ", "url"],
      ["connectKey", "Khóa kết nối", "password"],
      ["deviceName", "Tên máy tính", "text"],
    ],
  ],
  [
    "Đường truyền",
    [
      ["tunnel.mode", "Chế độ", ["quick", "named"]],
      ["tunnel.namedToken", "Token tunnel riêng", "password"],
      ["tunnel.namedHostname", "Tên miền tunnel riêng", "text"],
      ["tunnel.cloudflaredPath", "Đường dẫn cloudflared tùy chọn", "text"],
    ],
  ],
  [
    "Mặc định link",
    [
      ["defaults.allowOriginals", "Cho tải bản gốc", "checkbox"],
      ["defaults.pin", "PIN mặc định (6 số hoặc trống)", "password"],
      ["defaults.maxSelect", "Số ảnh tối đa", "number"],
      ["defaults.expiresDays", "Số ngày hết hạn (0 = không hết hạn)", "number"],
      ["defaults.rawDownload", "Tải RAW dưới dạng", ["raw", "jpg"]],
    ],
  ],
  [
    "Lọc & thông báo",
    [
      ["filter.notifyOnFinalize", "Thông báo khi khách chốt", "checkbox"],
      ["filter.autoCopyOnFinalize", "Tự copy khi khách chốt", "checkbox"],
      ["filter.mode", "Định dạng lọc", ["raw", "jpg", "both"]],
      ["filter.outputName", "Tên thư mục kết quả", "text"],
    ],
  ],
  [
    "Chạy nền & bộ nhớ đệm",
    [
      ["autoStart", "Khởi động cùng máy tính (Windows/macOS)", "checkbox"],
      ["cache.maxGB", "Dung lượng tối đa (GB)", "number"],
      ["cache.maxAgeDays", "Tuổi cache tối đa (ngày)", "number"],
      ["mediaPort", "Cổng media (0 = ngẫu nhiên)", "number"],
    ],
  ],
];
function renderSettings() {
  if (settingsLoaded) return;
  settingsLoaded = true;
  $("settings-fields").replaceChildren();
  for (const [title, fields] of settingGroups) {
    const panel = element("div", undefined, "panel");
    panel.append(element("h2", title));
    const grid = element("div", undefined, "form-grid");
    for (const [key, title, type] of fields) {
      const label = element("label", title, type === "checkbox" ? "check" : "");
      const input = document.createElement(Array.isArray(type) ? "select" : "input");
      input.name = key;
      if (Array.isArray(type))
        for (const option of type)
          input.add(
            new Option(
              {
                raw: "RAW",
                jpg: "JPG",
                both: "Cả hai",
                quick: "Quick tunnel",
                named: "Tunnel riêng",
              }[option],
              option,
            ),
          );
      else input.type = type;
      const value = key.split(".").reduce((value, key) => value[key], state.config);
      if (type === "checkbox") input.checked = value;
      else input.value = value;
      if (type === "number") {
        input.min = "0";
        input.step = key === "cache.maxGB" ? "0.1" : "1";
      }
      label.append(input);
      grid.append(label);
    }
    panel.append(grid);
    $("settings-fields").append(panel);
  }
}
function settingsValue() {
  const config = structuredClone(state.config);
  for (const input of $("settings-form").querySelectorAll("[name]")) {
    const keys = input.name.split(".");
    const last = keys.pop();
    const target = keys.reduce((object, key) => object[key], config);
    target[last] =
      input.type === "checkbox"
        ? input.checked
        : input.type === "number"
          ? Number(input.value)
          : input.value;
  }
  return config;
}
async function loadLogs() {
  const { entries } = await api("/api/logs");
  $("logs-body").replaceChildren();
  for (const entry of entries) {
    const row = element("tr");
    for (const value of [
      date(entry.time),
      entry.ip,
      entry.title,
      entry.file,
      entry.variant,
      entry.status,
    ])
      row.append(element("td", value ?? "—"));
    $("logs-body").append(row);
  }
}
function setKind(value) {
  $("create-kind").value = value;
  $("max-field").hidden = value !== "album";
  [...$("kind-cards").children].forEach((node) =>
    node.classList.toggle("active", node.dataset.kind === value),
  );
}
function createDialog(prefill = {}) {
  $("create-form").reset();
  createForce = false;
  $("create-form").hidden = false;
  $("create-result").hidden = true;
  $("create-path").value = prefill.path || "";
  $("create-title").value = (prefill.path || "").split(/[\\/]/).filter(Boolean).pop() || "";
  $("create-pin").value = state.config.defaults.pin;
  $("create-max").value = state.config.defaults.maxSelect;
  $("create-days").value = state.config.defaults.expiresDays;
  $("create-originals").checked = state.config.defaults.allowOriginals;
  setKind(labels[prefill.kind] ? prefill.kind : "album");
  if (!$("create-dialog").open) $("create-dialog").showModal();
}
async function createShare() {
  const form = $("create-form");
  const data = Object.fromEntries(new FormData(form));
  Object.assign(data, {
    allowOriginals: $("create-originals").checked,
    maxSelect: Number(data.maxSelect),
    expiresDays: Number(data.expiresDays),
    force: createForce,
  });
  const result = await api("/api/shares", data);
  const box = $("create-result");
  box.hidden = false;
  box.replaceChildren();
  if (result.duplicates) {
    box.append(element("p", "Thư mục và loại này đã được chia sẻ."));
    for (const share of result.duplicates)
      box.append(button(`Sao chép link: ${share.title}`, () => copy(share.url)));
    box.append(
      button(
        "Vẫn tạo link mới",
        async () => {
          createForce = true;
          await createShare();
        },
        "primary",
      ),
    );
    return;
  }
  form.hidden = true;
  const share = { ...result.share, pin: data.pin };
  box.append(
    element("h3", "Link đã sẵn sàng"),
    element("pre", template(share)),
    button("Sao chép link", () => copy(share.url)),
    button("Sao chép tin nhắn", () => copy(template(share))),
    button("Mở album", () => open(share.url)),
  );
  await refresh();
}
async function refresh() {
  state = await api("/api/state");
  $("device-name").textContent = state.config.deviceName;
  $("connection").textContent =
    `Server: ${{ connected: "đã kết nối", unconfigured: "chưa có khóa", connecting: "đang kết nối", error: "lỗi" }[state.connection.status]}${state.connection.message ? " · " + state.connection.message : ""}`;
  $("tunnel-status").textContent =
    `Đường truyền: ${{ connected: "đã kết nối", development: "nội bộ (dev)", starting: "đang kết nối", stopped: "đã dừng", error: "lỗi" }[state.tunnel.status]}${state.tunnel.origin ? " · " + state.tunnel.origin : ""}`;
  if (state.warning) $("tunnel-status").textContent += ` · ${state.warning}`;
  $("unread").textContent = state.notifications.filter((item) => !item.read).length;
  $("component-status").textContent = state.cloudflared
    ? "Cloudflared: đã cài đặt"
    : "Cloudflared: chưa cài đặt";
  $("cache-usage").textContent =
    `Đang dùng ${(state.cacheBytes / 1024 ** 2).toFixed(1)} MB bộ nhớ đệm.`;
  if (tab === "shares") renderShares();
  if (tab === "settings" && !settingsLoaded) renderSettings();
  if (tab === "filter" && $("filter-share").options.length === 1) filterOptions();
}
document
  .querySelectorAll("[data-tab]")
  .forEach((node) => node.addEventListener("click", () => switchTab(node.dataset.tab)));
document
  .querySelectorAll("[data-close]")
  .forEach((node) => node.addEventListener("click", () => $(node.dataset.close).close()));
for (const [value, title] of [["all", "Tất cả"], ...Object.entries(labels)])
  $("kind-filters").append(
    button(
      title,
      () => {
        kind = value;
        [...$("kind-filters").children].forEach((node) =>
          node.classList.toggle("active", node.textContent === title),
        );
        renderShares();
      },
      value === "all" ? "active" : "",
    ),
  );
for (const [value, title] of Object.entries({
  album: "Album chọn ảnh",
  view: "Album chỉ xem",
  video: "Video",
  folder: "Thư mục tải về",
})) {
  const node = button(title, () => setKind(value));
  node.dataset.kind = value;
  $("kind-cards").append(node);
}
for (const value of [5, 10, 15, 20, 25, 30, 40, 50])
  $("max-chips").append(
    button(value, () => {
      $("create-max").value = value;
    }),
  );
$("search").addEventListener("input", renderShares);
$("new-share").addEventListener("click", () => createDialog());
$("create-path").addEventListener("change", () => {
  $("create-title").value = $("create-path").value.split(/[\\/]/).filter(Boolean).pop() || "";
});
$("create-pick").addEventListener("click", () =>
  safely(async () => {
    const result = await api("/api/picker", { kind: $("create-kind").value });
    if (result.path) {
      $("create-path").value = result.path;
      $("create-path").dispatchEvent(new Event("change"));
    }
  }),
);
document.querySelectorAll("[data-pick]").forEach((node) =>
  node.addEventListener("click", () =>
    safely(async () => {
      const result = await api("/api/picker", { kind: "folder" });
      if (result.path) $(node.dataset.pick).value = result.path;
    }),
  ),
);
$("random-pin").addEventListener("click", () => {
  $("create-pin").value = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(
    6,
    "0",
  );
});
$("create-form").addEventListener("submit", (event) => {
  event.preventDefault();
  void safely(createShare);
});
$("filter-share").addEventListener("change", () => safely(loadSelectionCodes));
$("filter-codes").addEventListener("input", countCodes);
$("filter-preview").addEventListener("click", () => safely(() => filterRun(false)));
$("filter-form").addEventListener("submit", (event) => {
  event.preventDefault();
  void safely(() => filterRun(true));
});
$("settings-form").addEventListener("submit", (event) => {
  event.preventDefault();
  void safely(async () => {
    await api("/api/settings", settingsValue());
    message("Đã lưu cài đặt.");
    await refresh();
  });
});
$("test-connection").addEventListener("click", () =>
  safely(async () => {
    const result = await api("/api/test", settingsValue());
    message(`Đã kết nối: ${result.device.tenantName} · ${result.device.name}`);
  }),
);
document.querySelectorAll("[data-tunnel]").forEach((node) =>
  node.addEventListener("click", () =>
    safely(async () => {
      await api("/api/tunnel", { action: node.dataset.tunnel });
      await refresh();
      message("Đã cập nhật đường truyền.");
    }),
  ),
);
$("install-context").addEventListener("click", () =>
  safely(async () => {
    await api("/api/context", { install: true });
    message("Đã cài menu chuột phải.");
  }),
);
$("uninstall-context").addEventListener("click", () =>
  safely(async () => {
    await api("/api/context", { install: false });
    message("Đã gỡ menu chuột phải.");
  }),
);
$("clear-cache").addEventListener("click", () =>
  safely(async () => {
    await api("/api/cache/clear", {});
    await refresh();
    message("Đã dọn bộ nhớ đệm.");
  }),
);
$("bell").addEventListener("click", () =>
  safely(async () => {
    $("notification-list").replaceChildren();
    for (const item of state.notifications)
      $("notification-list").append(
        element("p", `${item.read ? "" : "● "}${item.title} · Khách đã chốt · ${date(item.time)}`),
      );
    if (!state.notifications.length)
      $("notification-list").append(element("p", "Chưa có thông báo."));
    $("notifications-dialog").showModal();
    await api("/api/notifications/read", {});
    await refresh();
  }),
);
function hashCreate() {
  if (location.hash.startsWith("#create?"))
    createDialog(Object.fromEntries(new URLSearchParams(location.hash.slice(8))));
}
window.addEventListener("hashchange", hashCreate);
void safely(async () => {
  await refresh();
  $("filter-mode").value = state.config.filter.mode;
  $("filter-output-name").value = state.config.filter.outputName;
  hashCreate();
});
setInterval(() => {
  if (!document.hidden)
    void safely(async () => {
      await refresh();
      if (tab === "logs") await loadLogs();
    });
}, 5000);
