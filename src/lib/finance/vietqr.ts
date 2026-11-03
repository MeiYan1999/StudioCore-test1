export type VietQrInput = {
  bankBin: string;
  accountNumber: string;
  accountName: string;
  amount: number;
  content: string;
};

export function sanitizeTransferContent(value: string): string {
  return value
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9 ._-]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase()
    .slice(0, 50);
}

export function validateVietQrInput(input: VietQrInput): string[] {
  const errors: string[] = [];
  if (!/^\d{6}$/.test(input.bankBin)) {
    errors.push("Bank BIN phải gồm đúng 6 chữ số.");
  }
  if (!/^\d{6,19}$/.test(input.accountNumber)) {
    errors.push("Số tài khoản phải gồm 6–19 chữ số.");
  }
  if (!input.accountName.trim()) {
    errors.push("Tên chủ tài khoản là bắt buộc.");
  }
  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    errors.push("Số tiền VietQR phải là số nguyên dương.");
  }
  if (!sanitizeTransferContent(input.content)) {
    errors.push("Nội dung chuyển khoản không hợp lệ.");
  }
  return errors;
}

function tlv(id: string, value: string): string {
  return `${id}${String(value.length).padStart(2, "0")}${value}`;
}

export function crc16Ccitt(payload: string): string {
  let crc = 0xffff;
  for (let index = 0; index < payload.length; index += 1) {
    crc ^= payload.charCodeAt(index) << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export function buildVietQrPayload(input: VietQrInput): {
  payload: string;
  content: string;
  imageUrl: string;
} {
  const errors = validateVietQrInput(input);
  if (errors.length > 0) {
    throw new Error(errors.join(" "));
  }
  const content = sanitizeTransferContent(input.content);
  const beneficiary = tlv("00", input.bankBin) + tlv("01", input.accountNumber);
  const consumer = tlv("00", "A000000727") + tlv("01", beneficiary) + tlv("02", "QRIBFTTA");
  let payload =
    tlv("00", "01") +
    tlv("01", "12") +
    tlv("38", consumer) +
    tlv("53", "704") +
    tlv("54", String(input.amount)) +
    tlv("58", "VN") +
    tlv("62", tlv("08", content));
  payload += "6304";
  payload += crc16Ccitt(payload);

  const imageUrl =
    `https://img.vietqr.io/image/${input.bankBin}-${input.accountNumber}-compact2.png` +
    `?amount=${input.amount}&addInfo=${encodeURIComponent(content)}` +
    `&accountName=${encodeURIComponent(input.accountName)}`;

  return { payload, content, imageUrl };
}
