"use strict";

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

/** Chỉ chấp nhận https, hoặc http tới chính máy này (để thử nghiệm). */
function normalizeServerUrl(value) {
  let url;
  try {
    url = new URL(String(value).trim());
  } catch {
    throw new ApiError("Địa chỉ máy chủ không hợp lệ.", 0);
  }
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !(url.protocol === "http:" && local)) {
    throw new ApiError("Địa chỉ máy chủ phải dùng https.", 0);
  }
  return url.origin;
}

class ApiClient {
  constructor({ serverUrl, token, appVersion }) {
    this.serverUrl = normalizeServerUrl(serverUrl);
    this.token = token || null;
    this.appVersion = appVersion || "";
  }

  headers(extra) {
    const headers = { "x-drive-app-version": this.appVersion, ...extra };
    if (this.token) headers.authorization = `Bearer ${this.token}`;
    return headers;
  }

  async json(method, pathname, body, { signal, timeoutMs = 30000 } = {}) {
    const timeout = AbortSignal.timeout(timeoutMs);
    const response = await fetch(`${this.serverUrl}${pathname}`, {
      method,
      headers: this.headers(body === undefined ? {} : { "content-type": "application/json" }),
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      redirect: "error",
    });
    let data = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }
    if (!response.ok) {
      throw new ApiError((data && typeof data.error === "string" && data.error) || `Lỗi máy chủ (${response.status}).`, response.status);
    }
    return data || {};
  }

  pair(input) {
    return this.json("POST", "/api/drive/agent/pair", input);
  }
  poll(since, wait, signal) {
    return this.json("GET", `/api/drive/agent/poll?since=${since}&wait=${wait}`, undefined, { signal, timeoutMs: wait + 15000 });
  }
  listShares() {
    return this.json("GET", "/api/drive/agent/shares");
  }
  createShare(input) {
    return this.json("POST", "/api/drive/agent/shares", input, { timeoutMs: 120000 });
  }
  updateShare(id, patch) {
    return this.json("PATCH", `/api/drive/agent/shares/${encodeURIComponent(id)}`, patch);
  }
  replaceFiles(id, files) {
    return this.json("PUT", `/api/drive/agent/shares/${encodeURIComponent(id)}`, { files }, { timeoutMs: 120000 });
  }
  deleteShare(id) {
    return this.json("DELETE", `/api/drive/agent/shares/${encodeURIComponent(id)}`);
  }
  picks(id) {
    return this.json("GET", `/api/drive/agent/shares/${encodeURIComponent(id)}/picks`);
  }

  /** Đẩy dữ liệu một tệp (Buffer hoặc luồng) cho yêu cầu đang chờ trên máy chủ. */
  async respond(jobId, { status, contentType, length, range, body }) {
    const headers = this.headers({
      "x-drive-status": String(status),
      "content-type": contentType || "application/octet-stream",
    });
    if (length !== undefined && length !== null) headers["x-drive-length"] = String(length);
    if (range) headers["x-drive-range"] = range;
    const init = { method: "POST", headers, redirect: "error" };
    if (body) {
      init.body = body;
      if (!Buffer.isBuffer(body)) init.duplex = "half";
    }
    const response = await fetch(`${this.serverUrl}/api/drive/agent/jobs/${encodeURIComponent(jobId)}`, init);
    await response.arrayBuffer().catch(() => undefined);
    return response.ok;
  }
}

module.exports = { ApiClient, ApiError, normalizeServerUrl };
