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

function wwwVariant(origin) {
  let url;
  try {
    url = new URL(origin);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  url.hostname = url.hostname.startsWith("www.")
    ? url.hostname.slice(4)
    : `www.${url.hostname}`;
  return url.origin;
}

async function parseResponse(response) {
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

  async json(method, pathname, body, { signal, timeoutMs = 30000, redirect = "error", returnResponse = false } = {}) {
    const timeout = AbortSignal.timeout(timeoutMs);
    const response = await fetch(`${this.serverUrl}${pathname}`, {
      method,
      headers: this.headers(body === undefined ? {} : { "content-type": "application/json" }),
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      redirect,
    });
    return returnResponse ? response : parseResponse(response);
  }

  async pair(input) {
    const pathname = "/api/drive/agent/pair";
    const response = await this.json("POST", pathname, input, { redirect: "manual", returnResponse: true });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      let target = null;
      try {
        if (location) target = new URL(location, `${this.serverUrl}${pathname}`);
      } catch {
        target = null;
      }
      const targetOrigin = target ? target.origin : "không xác định";
      if (
        [301, 302, 303, 307, 308].includes(response.status) &&
        target?.protocol === "https:" &&
        target.origin === wwwVariant(this.serverUrl) &&
        target.pathname === pathname
      ) {
        this.serverUrl = target.origin;
        return this.json("POST", pathname, input, { redirect: "error" });
      }
      throw new ApiError(
        `Máy chủ chuyển hướng tới địa chỉ khác: ${targetOrigin}. Hãy nhập đúng địa chỉ trong mục Nâng cao.`,
        response.status,
      );
    }
    return parseResponse(response);
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

module.exports = { ApiClient, ApiError, normalizeServerUrl, wwwVariant };
