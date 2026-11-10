import { describe, expect, it } from "vitest";
import { GET, HEAD } from "@/app/api/health/route";

describe("Health Check API (/api/health)", () => {
  it("GET returns 200 with status ok and uptime", async () => {
    const res = await GET();
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.status).toBe("ok");
    expect(data.service).toBe("studiocore");
    expect(data.database).toBe("ok");
    expect(typeof data.uptimeSeconds).toBe("number");
    expect(typeof data.responseTimeMs).toBe("number");
  });

  it("HEAD returns 200 with empty body", async () => {
    const res = await HEAD();
    expect(res.status).toBe(200);
  });
});
