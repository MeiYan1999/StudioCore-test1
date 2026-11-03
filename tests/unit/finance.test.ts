import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildVietQrPayload,
  crc16Ccitt,
  sanitizeTransferContent,
  validateVietQrInput,
} from "@/lib/finance/vietqr";
import {
  signWebhookBody,
  verifyWebhookSignature,
} from "@/lib/finance/webhook";

const validInput = {
  bankBin: "970436",
  accountNumber: "0000000000",
  accountName: "STUDIO DEMO",
  amount: 2_500_000,
  content: "Thanh toan DH-20261101-0001",
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("VietQR NAPAS", () => {
  it("validate BIN, tài khoản, số tiền và nội dung", () => {
    expect(validateVietQrInput(validInput)).toEqual([]);
    expect(
      validateVietQrInput({ ...validInput, bankBin: "97A" }),
    ).toContain("Bank BIN phải gồm đúng 6 chữ số.");
    expect(
      validateVietQrInput({ ...validInput, accountNumber: "12" }),
    ).toContain("Số tài khoản phải gồm 6–19 chữ số.");
    expect(validateVietQrInput({ ...validInput, amount: 0 })).toContain(
      "Số tiền VietQR phải là số nguyên dương.",
    );
  });

  it("payload có BIN/tài khoản/số tiền/CRC hợp lệ", () => {
    const result = buildVietQrPayload({
      ...validInput,
      content: "Thanh toán đơn DH-20261101-0001",
    });
    expect(result.content).toContain("THANH TOAN");
    expect(result.payload).toContain("970436");
    expect(result.payload).toContain("0000000000");
    expect(result.payload).toContain("2500000");
    expect(result.payload).toMatch(/6304[0-9A-F]{4}$/);
    expect(crc16Ccitt("123456789")).toHaveLength(4);
    expect(sanitizeTransferContent("Đơn cưới 001")).toBe("DON CUOI 001");
  });
});

describe("Mock webhook signature", () => {
  it("chấp nhận chữ ký đúng, từ chối sai/tampered/hết hạn", () => {
    const now = Date.now();
    const body = JSON.stringify({ eventId: "e1", amount: 1000 });
    const signature = signWebhookBody(body, now, "test-webhook-secret");
    expect(
      verifyWebhookSignature({
        body,
        timestamp: String(now),
        signature,
        now,
        secret: "test-webhook-secret",
      }).ok,
    ).toBe(true);
    expect(
      verifyWebhookSignature({
        body: `${body} `,
        timestamp: String(now),
        signature,
        now,
        secret: "test-webhook-secret",
      }).ok,
    ).toBe(false);
    expect(
      verifyWebhookSignature({
        body,
        timestamp: String(now - 10 * 60 * 1000),
        signature,
        now,
        secret: "test-webhook-secret",
      }).ok,
    ).toBe(false);
  });

  it("mock webhook bị tắt ở production", () => {
    vi.stubEnv("NODE_ENV", "production");
    const result = verifyWebhookSignature({
      body: "{}",
      timestamp: String(Date.now()),
      signature: "00",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("production");
    }
  });
});
