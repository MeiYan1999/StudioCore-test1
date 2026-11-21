class AgentApi {
  constructor(config, options = {}) {
    this.config = config;
    this.fetch = options.fetch || globalThis.fetch;
    this.timeout = options.timeout || 20000;
  }
  async request(route, method = "GET", body) {
    if (!this.config.connectKey)
      throw new Error("Vui lòng dán khóa kết nối vào config.json trước.");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeout);
    try {
      const response = await this.fetch(`${this.config.serverUrl}/api/drive/agent/${route}`, {
        method,
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${this.config.connectKey}`,
          "Content-Type": "application/json",
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      if (response.status === 401)
        throw Object.assign(new Error("Khóa kết nối không hợp lệ hoặc đã bị thu hồi"), {
          status: 401,
        });
      let data;
      try {
        data = await response.json();
      } catch {
        throw new Error("Máy chủ trả về dữ liệu không hợp lệ.");
      }
      if (!response.ok)
        throw new Error(
          typeof data.error === "string" ? data.error : `Máy chủ báo lỗi HTTP ${response.status}.`,
        );
      return data;
    } catch (error) {
      if (error.name === "AbortError")
        throw new Error("Máy chủ phản hồi quá chậm. Vui lòng thử lại.");
      if (error instanceof TypeError)
        throw new Error("Không kết nối được máy chủ. Vui lòng kiểm tra mạng và địa chỉ máy chủ.");
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
  heartbeat(data) {
    return this.request("heartbeat", "POST", data);
  }
  listShares() {
    return this.request("shares");
  }
  createShare(data) {
    return this.request("shares", "POST", data);
  }
  patchShare(id, status) {
    return this.request(`shares/${encodeURIComponent(id)}`, "PATCH", { status });
  }
  deleteShare(id) {
    return this.request(`shares/${encodeURIComponent(id)}`, "DELETE");
  }
  selection(id) {
    return this.request(`shares/${encodeURIComponent(id)}/selection`);
  }
  reopen(id) {
    return this.request(`shares/${encodeURIComponent(id)}/reopen`, "POST");
  }
  mediaSecret(id) {
    return this.request(`shares/${encodeURIComponent(id)}/media-secret`);
  }
}
module.exports = { AgentApi };
