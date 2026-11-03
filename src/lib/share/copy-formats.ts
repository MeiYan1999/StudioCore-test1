export type CopyFormat = "newline" | "comma" | "space" | "filename";

export type CopyCodeItem = {
  code: string;
  filename: string;
  note?: string | null;
};

export const COPY_FORMAT_LABELS: Record<CopyFormat, string> = {
  newline: "Xuống dòng",
  comma: "Dấu phẩy",
  space: "Dấu cách",
  filename: "Có đuôi file",
};

function extensionOf(filename: string): string {
  const index = filename.lastIndexOf(".");
  return index >= 0 ? filename.slice(index) : "";
}

export function formatPhotoCodes(
  items: CopyCodeItem[],
  format: CopyFormat,
  includeNotes: boolean,
): string {
  const withExtension = format === "filename";
  const values = items.map((item) => {
    const base = withExtension ? `${item.code}${extensionOf(item.filename)}` : item.code;
    const note = item.note?.trim();
    if (!includeNotes || !note) {
      return base;
    }
    return format === "newline" ? `${base}\t${note}` : `${base} [${note}]`;
  });

  if (format === "comma") {
    return values.join(", ");
  }
  if (format === "space") {
    return values.join(" ");
  }
  return values.join("\n");
}
