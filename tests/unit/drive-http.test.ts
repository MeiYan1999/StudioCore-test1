import { describe, expect, it } from "vitest";
import { readJsonBody } from "@/lib/drive/http";

describe("readJsonBody", () => {
  it("rejects a streamed body as soon as its byte size exceeds the limit", async () => {
    const request = new Request("http://localhost/api/drive/agent/shares", {
      method: "POST",
      body: JSON.stringify({ value: "ééé" }),
    });

    await expect(readJsonBody(request, 10)).rejects.toThrow("Dữ liệu gửi lên quá lớn.");
  });

  it("parses a valid small request body", async () => {
    const request = new Request("http://localhost/api/drive/agent/shares", {
      method: "POST",
      body: JSON.stringify({ title: "Ảnh" }),
    });

    await expect(readJsonBody(request, 100)).resolves.toEqual({ title: "Ảnh" });
  });

  it("rejects a body early when Content-Length exceeds the limit", async () => {
    const request = new Request("http://localhost/api/drive/agent/shares", {
      method: "POST",
      headers: { "content-length": "100" },
      body: "{}",
    });

    await expect(readJsonBody(request, 10)).rejects.toThrow("Dữ liệu gửi lên quá lớn.");
  });
});
