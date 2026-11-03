export type CodeMatchMode = "alphanumeric" | "numeric";
export type FileTypeFilter = "all" | "raw" | "standard";
export type MatchStatus = "matched" | "ambiguous" | "missing";

export const RAW_EXTENSIONS = ["raw", "cr2", "nef", "arw", "dng", "raf"] as const;
export const STANDARD_EXTENSIONS = ["jpg", "jpeg", "png", "webp"] as const;

export type ParsedCodeItem = {
  raw: string;
  normalized: string;
  numericToken: string | null;
  numericTokenCount: number;
  status: "ok" | "duplicate" | "invalid";
  message?: string;
};

export type ParseCodesResult = {
  items: ParsedCodeItem[];
  valid: ParsedCodeItem[];
  totalTokens: number;
  duplicateCount: number;
  invalidCount: number;
  numericAmbiguousCount: number;
};

export type FilterFileEntry = {
  name: string;
  relativePath: string;
  size: number;
  lastModified: number;
  category: "raw" | "standard";
};

export type CodeMatchItem = {
  parsed: ParsedCodeItem;
  status: MatchStatus;
  candidates: FilterFileEntry[];
  matchedFile: FilterFileEntry | null;
};

export type CodeMatchResult = {
  items: CodeMatchItem[];
  matchedCount: number;
  ambiguousCount: number;
  missingCount: number;
  copyableCount: number;
};

export function normalizeCodeToken(value: string): string {
  return value.normalize("NFKC").trim().toLowerCase();
}

export function extensionOf(filename: string): string {
  const index = filename.lastIndexOf(".");
  return index >= 0 ? filename.slice(index + 1).toLowerCase() : "";
}

export function stripExtension(filename: string): string {
  const index = filename.lastIndexOf(".");
  if (index <= 0) {
    return filename;
  }
  const extension = filename.slice(index + 1);
  if (/^[a-z0-9]{1,6}$/i.test(extension)) {
    return filename.slice(0, index);
  }
  return filename;
}

export function basenameOf(value: string): string {
  const normalized = value.replace(/\\/g, "/");
  return normalized.split("/").filter(Boolean).pop() ?? normalized;
}

export function numericTokensOf(value: string): string[] {
  return value.match(/\d+/g) ?? [];
}

export function normalizeNumericToken(token: string): string {
  return token.replace(/^0+(?=\d)/, "");
}

export function fileCategory(filename: string): "raw" | "standard" {
  const extension = extensionOf(filename);
  return (RAW_EXTENSIONS as readonly string[]).includes(extension)
    ? "raw"
    : "standard";
}

export function parseCustomerCodes(
  text: string,
  mode: CodeMatchMode,
): ParseCodesResult {
  const tokens = text
    .split(/[\s,;]+/)
    .map((token) => token.trim())
    .filter(
      (token) =>
        Boolean(token) &&
        !/^\d{1,3}[.)]$/.test(token) &&
        !/^[-•*]+$/.test(token),
    );
  const seen = new Set<string>();
  const items: ParsedCodeItem[] = [];
  let duplicateCount = 0;
  let invalidCount = 0;
  let numericAmbiguousCount = 0;

  for (const token of tokens) {
    let raw = token.replace(/^[\s"'`]+|[\s"'`]+$/g, "");
    raw = raw.replace(/^[-•*]+/, "");
    raw = raw.replace(/^\d{1,3}[.)]\s*/, "");
    const basename = basenameOf(raw);
    const stem = stripExtension(basename);
    const normalized = normalizeCodeToken(stem);

    if (!normalized || normalized.length > 120 || !/[a-z0-9]/.test(normalized)) {
      items.push({
        raw: token,
        normalized,
        numericToken: null,
        numericTokenCount: 0,
        status: "invalid",
        message: "Mã rỗng hoặc không hợp lệ.",
      });
      invalidCount += 1;
      continue;
    }

    let numericToken: string | null = null;
    let numericTokenCount = 0;
    if (mode === "numeric") {
      const tokensInCode = numericTokensOf(stem);
      numericTokenCount = tokensInCode.length;
      numericToken = tokensInCode.at(-1) ?? null;
      if (!numericToken) {
        items.push({
          raw: token,
          normalized,
          numericToken: null,
          numericTokenCount: 0,
          status: "invalid",
          message: "Chế độ chỉ số yêu cầu mã có chữ số.",
        });
        invalidCount += 1;
        continue;
      }
      if (numericTokenCount > 1) {
        numericAmbiguousCount += 1;
      }
    }

    const key =
      mode === "numeric"
        ? `n:${normalizeNumericToken(numericToken ?? "")}`
        : `a:${normalized}`;
    if (seen.has(key)) {
      items.push({
        raw: token,
        normalized,
        numericToken,
        numericTokenCount,
        status: "duplicate",
        message: "Mã trùng, chỉ xử lý một lần.",
      });
      duplicateCount += 1;
      continue;
    }
    seen.add(key);
    items.push({
      raw: token,
      normalized,
      numericToken,
      numericTokenCount,
      status: "ok",
    });
  }

  return {
    items,
    valid: items.filter((item) => item.status === "ok"),
    totalTokens: tokens.length,
    duplicateCount,
    invalidCount,
    numericAmbiguousCount,
  };
}

function fileKey(file: FilterFileEntry, mode: CodeMatchMode): string | null {
  const stem = stripExtension(file.name);
  if (mode === "numeric") {
    const token = numericTokensOf(stem).at(-1);
    return token ? `n:${normalizeNumericToken(token)}` : null;
  }
  const normalized = normalizeCodeToken(stem);
  return normalized ? `a:${normalized}` : null;
}

export function matchCodesToFiles(
  parsed: ParsedCodeItem[],
  files: FilterFileEntry[],
  mode: CodeMatchMode,
): CodeMatchResult {
  const index = new Map<string, FilterFileEntry[]>();
  for (const file of files) {
    const key = fileKey(file, mode);
    if (!key) continue;
    const list = index.get(key) ?? [];
    list.push(file);
    index.set(key, list);
  }

  const items: CodeMatchItem[] = parsed
    .filter((item) => item.status === "ok")
    .map((item) => {
      const key =
        mode === "numeric" && item.numericToken
          ? `n:${normalizeNumericToken(item.numericToken)}`
          : `a:${item.normalized}`;
      const candidates = index.get(key) ?? [];
      if (candidates.length === 1) {
        return {
          parsed: item,
          status: "matched" as const,
          candidates,
          matchedFile: candidates[0] ?? null,
        };
      }
      if (candidates.length > 1) {
        return {
          parsed: item,
          status: "ambiguous" as const,
          candidates,
          matchedFile: null,
        };
      }
      return {
        parsed: item,
        status: "missing" as const,
        candidates: [],
        matchedFile: null,
      };
    });

  const matchedCount = items.filter((item) => item.status === "matched").length;
  const ambiguousCount = items.filter((item) => item.status === "ambiguous").length;
  const missingCount = items.filter((item) => item.status === "missing").length;
  return {
    items,
    matchedCount,
    ambiguousCount,
    missingCount,
    copyableCount: matchedCount,
  };
}

export function fileMatchesType(
  file: FilterFileEntry,
  filter: FileTypeFilter,
): boolean {
  if (filter === "all") return true;
  if (filter === "raw") return file.category === "raw";
  return file.category === "standard";
}

export function validAlbumCodeCount(
  parsed: ParsedCodeItem[],
  albumFiles: { code: string; filename: string }[],
  mode: CodeMatchMode,
): number {
  const entries: FilterFileEntry[] = albumFiles.map((item) => ({
    name: item.filename,
    relativePath: item.filename,
    size: 0,
    lastModified: 0,
    category: fileCategory(item.filename),
  }));
  const result = matchCodesToFiles(parsed, entries, mode);
  return result.matchedCount + result.ambiguousCount;
}

export function sanitizeFolderName(value: string): string {
  const cleaned = value
    .normalize("NFKC")
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\.+$/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  return cleaned || "Ảnh khách chọn";
}

export function buildManifestCsv(
  rows: {
    inputCode: string;
    filename: string;
    relativePath: string;
    status: string;
    message?: string;
  }[],
): string {
  const escape = (value: string) =>
    /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
  const lines = ["input_code,filename,relative_path,status,message"];
  for (const row of rows) {
    lines.push(
      [
        escape(row.inputCode),
        escape(row.filename),
        escape(row.relativePath),
        escape(row.status),
        escape(row.message ?? ""),
      ].join(","),
    );
  }
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

export function buildMissingText(
  rows: { inputCode: string; message?: string }[],
): string {
  return rows
    .map((row) => (row.message ? `${row.inputCode}\t${row.message}` : row.inputCode))
    .join("\n");
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const insert = (current[j - 1] ?? 0) + 1;
      const remove = (previous[j] ?? 0) + 1;
      const substitute = (previous[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1);
      current[j] = Math.min(insert, remove, substitute);
    }
    previous = current;
  }
  return previous[b.length] ?? Math.max(a.length, b.length);
}

export function suggestSimilarAlbumCodes(
  inputCode: string,
  albumFiles: { code: string; filename: string }[],
  limit = 3,
): { code: string; filename: string; distance: number }[] {
  const normalizedInput = normalizeCodeToken(stripExtension(basenameOf(inputCode)));
  if (!normalizedInput) return [];
  return albumFiles
    .map((item) => {
      const target = normalizeCodeToken(stripExtension(item.filename));
      return {
        code: item.code,
        filename: item.filename,
        distance: levenshtein(normalizedInput, target),
      };
    })
    .filter((item) => item.distance <= 3)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit);
}
