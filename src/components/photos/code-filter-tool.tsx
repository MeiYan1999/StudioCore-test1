"use client";

import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import JSZip from "jszip";
import {
  CheckCircle2,
  Copy,
  Download,
  FileArchive,
  FolderOpen,
  FolderSearch,
  Loader2,
  Play,
  Square,
  Upload,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CopyCodesMenu } from "@/components/albums/copy-codes-menu";
import { savePhotoFilterJobAction } from "@/lib/actions/filter-actions";
import {
  basenameOf,
  buildManifestCsv,
  buildMissingText,
  fileCategory,
  fileMatchesType,
  matchCodesToFiles,
  parseCustomerCodes,
  sanitizeFolderName,
  stripExtension,
  suggestSimilarAlbumCodes,
  type CodeMatchMode,
  type CodeMatchItem,
  type FileTypeFilter,
  type FilterFileEntry,
  type MatchStatus,
} from "@/lib/photos/filter-codes";

type DirectoryHandleLike = {
  name: string;
  kind: "directory";
  entries(): AsyncIterableIterator<[string, FileHandleLike | DirectoryHandleLike]>;
  getDirectoryHandle(
    name: string,
    options?: { create?: boolean },
  ): Promise<DirectoryHandleLike>;
  getFileHandle(
    name: string,
    options?: { create?: boolean },
  ): Promise<FileHandleLike>;
  requestPermission?: (options: {
    mode: "read" | "readwrite";
  }) => Promise<"granted" | "denied" | "prompt">;
};

type FileHandleLike = {
  name: string;
  kind: "file";
  getFile(): Promise<File>;
  createWritable?(): Promise<{
    write(data: Blob): Promise<void>;
    close(): Promise<void>;
  }>;
};

type DirectoryPickerWindow = Window & {
  showDirectoryPicker?: (options?: {
    mode?: "read" | "readwrite";
  }) => Promise<DirectoryHandleLike>;
};

type FilterProgress = {
  scanned: number;
  matched: number;
  copied: number;
  missing: number;
  errors: number;
};

type FilterRow = {
  inputCode: string;
  filename: string;
  relativePath: string;
  status: MatchStatus | "manual" | "skipped" | "error";
  message?: string;
};

const EMPTY_PROGRESS: FilterProgress = {
  scanned: 0,
  matched: 0,
  copied: 0,
  missing: 0,
  errors: 0,
};

function subscribeNoop(): () => void {
  return () => undefined;
}

function pickerAvailable(): boolean {
  return typeof window !== "undefined" && "showDirectoryPicker" in window;
}

function isImageFile(name: string): boolean {
  const extension = name.split(".").pop()?.toLowerCase() ?? "";
  return [
    "jpg",
    "jpeg",
    "png",
    "webp",
    "raw",
    "cr2",
    "nef",
    "arw",
    "dng",
    "raf",
  ].includes(extension);
}

async function scanDirectoryHandle(
  root: DirectoryHandleLike,
): Promise<FilterFileEntry[]> {
  const entries: FilterFileEntry[] = [];

  async function walk(directory: DirectoryHandleLike, prefix: string) {
    for await (const [name, handle] of directory.entries()) {
      if (name.startsWith(".")) continue;
      const relativePath = prefix ? `${prefix}/${name}` : name;
      if (handle.kind === "directory") {
        await walk(handle as DirectoryHandleLike, relativePath);
        continue;
      }
      if (!isImageFile(name)) continue;
      const file = await (handle as FileHandleLike).getFile();
      entries.push({
        name,
        relativePath,
        size: file.size,
        lastModified: file.lastModified,
        category: fileCategory(name),
      });
    }
  }

  await walk(root, "");
  return entries.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

async function readFileFromDirectory(
  root: DirectoryHandleLike,
  relativePath: string,
): Promise<File> {
  const segments = relativePath.split("/");
  const filename = segments.pop() ?? relativePath;
  let directory = root;
  for (const segment of segments) {
    directory = await directory.getDirectoryHandle(segment);
  }
  const handle = await directory.getFileHandle(filename);
  return handle.getFile();
}

async function fileExists(
  directory: DirectoryHandleLike,
  filename: string,
): Promise<boolean> {
  try {
    await directory.getFileHandle(filename);
    return true;
  } catch {
    return false;
  }
}

function splitFilename(filename: string): { stem: string; extension: string } {
  const index = filename.lastIndexOf(".");
  if (index <= 0) return { stem: filename, extension: "" };
  return { stem: filename.slice(0, index), extension: filename.slice(index) };
}

async function resolveDestinationName(
  directory: DirectoryHandleLike | null,
  usedNames: Set<string>,
  filename: string,
  conflict: "rename" | "overwrite" | "skip",
): Promise<{ name: string; skip: boolean }> {
  const exists =
    (directory ? await fileExists(directory, filename) : false) ||
    usedNames.has(filename);
  if (!exists) {
    usedNames.add(filename);
    return { name: filename, skip: false };
  }
  if (conflict === "skip") {
    return { name: filename, skip: true };
  }
  if (conflict === "overwrite") {
    usedNames.add(filename);
    return { name: filename, skip: false };
  }
  const { stem, extension } = splitFilename(filename);
  let index = 1;
  while (true) {
    const candidate = `${stem}-${index}${extension}`;
    const candidateExists =
      (directory ? await fileExists(directory, candidate) : false) ||
      usedNames.has(candidate);
    if (!candidateExists) {
      usedNames.add(candidate);
      return { name: candidate, skip: false };
    }
    index += 1;
  }
}

async function ensureWritePermission(
  handle: DirectoryHandleLike,
): Promise<void> {
  if (!handle.requestPermission) return;
  const state = await handle.requestPermission({ mode: "readwrite" });
  if (state !== "granted") {
    throw new Error(
      "Chưa được cấp quyền ghi thư mục. Chọn lại thư mục và cho phép chỉnh sửa.",
    );
  }
}

async function writeBlob(
  directory: DirectoryHandleLike,
  filename: string,
  blob: Blob,
): Promise<void> {
  const handle = await directory.getFileHandle(filename, { create: true });
  if (!handle.createWritable) {
    throw new Error("Trình duyệt không hỗ trợ ghi file vào thư mục.");
  }
  const writable = await handle.createWritable();
  await writable.write(blob);
  await writable.close();
}

function downloadText(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function itemKey(item: CodeMatchItem): string {
  return `${item.parsed.raw}::${item.parsed.normalized}`;
}

function resolveMatches(
  matches: CodeMatchItem[],
  choices: Record<string, string>,
): CodeMatchItem[] {
  return matches.map((item) => {
    if (item.status !== "ambiguous") return item;
    const chosen = choices[itemKey(item)];
    if (!chosen) return item;
    const file = item.candidates.find(
      (candidate) => candidate.relativePath === chosen,
    );
    if (!file) return item;
    return {
      ...item,
      status: "matched" as const,
      matchedFile: file,
      candidates: item.candidates,
    };
  });
}

export function CodeFilterTool({
  albumId,
  albumTitle,
  albumFiles,
  initialCodes,
}: {
  albumId: string | null;
  albumTitle: string | null;
  albumFiles: { code: string; filename: string }[];
  initialCodes: { code: string; filename: string; note: string | null }[];
}) {
  const pickerSupported = useSyncExternalStore(
    subscribeNoop,
    pickerAvailable,
    () => false,
  );
  const [mode, setMode] = useState<CodeMatchMode>("alphanumeric");
  const [text, setText] = useState(
    initialCodes.length > 0 ? initialCodes.map((item) => item.code).join("\n") : "",
  );
  const [files, setFiles] = useState<FilterFileEntry[]>([]);
  const [sourceName, setSourceName] = useState<string | null>(null);
  const [sourceReady, setSourceReady] = useState(false);
  const [zipName, setZipName] = useState<string | null>(null);
  const [fileType, setFileType] = useState<FileTypeFilter>("all");
  const [outputMode, setOutputMode] = useState<"subfolder" | "separate">(
    "subfolder",
  );
  const [folderName, setFolderName] = useState("Ảnh khách chọn");
  const [conflict, setConflict] = useState<"rename" | "overwrite" | "skip">(
    "rename",
  );
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [progress, setProgress] = useState<FilterProgress>(EMPTY_PROGRESS);
  const [resultRows, setResultRows] = useState<FilterRow[]>([]);
  const [resultSummary, setResultSummary] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [zipBlobUrl, setZipBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputDirectoryRef = useRef<DirectoryHandleLike | null>(null);
  const outputDirectoryRef = useRef<DirectoryHandleLike | null>(null);
  const fileMapRef = useRef<Map<string, File>>(new Map());
  const zipRef = useRef<JSZip | null>(null);
  const cancelRef = useRef(false);

  const parsed = useMemo(() => parseCustomerCodes(text, mode), [mode, text]);
  const eligibleFiles = useMemo(
    () => files.filter((file) => fileMatchesType(file, fileType)),
    [fileType, files],
  );
  const matches = useMemo(
    () => matchCodesToFiles(parsed.valid, eligibleFiles, mode),
    [eligibleFiles, mode, parsed.valid],
  );
  const resolved = useMemo(
    () => resolveMatches(matches.items, choices),
    [choices, matches.items],
  );
  const matchedCount = resolved.filter((item) => item.status === "matched").length;
  const ambiguousCount = resolved.filter(
    (item) => item.status === "ambiguous",
  ).length;
  const missingCount = resolved.filter((item) => item.status === "missing").length;
  const canStart =
    parsed.valid.length > 0 && Boolean(sourceName) && sourceReady && !busy;
  const albumValidCount = albumFiles.length
    ? parsed.valid.filter((item) => {
        const result = matchCodesToFiles(
          [item],
          albumFiles.map((file) => ({
            name: file.filename,
            relativePath: file.filename,
            size: 0,
            lastModified: 0,
            category: fileCategory(file.filename),
          })),
          mode,
        );
        return result.matchedCount + result.ambiguousCount > 0;
      }).length
    : 0;

  const chooseInputDirectory = async () => {
    const picker = (window as DirectoryPickerWindow).showDirectoryPicker;
    if (!picker) {
      toast.error("Trình duyệt không hỗ trợ File System Access API.");
      return;
    }
    try {
      const directory = await picker({ mode: "readwrite" });
      inputDirectoryRef.current = directory;
      outputDirectoryRef.current = null;
      zipRef.current = null;
      fileMapRef.current.clear();
      setZipName(null);
      const scanned = await scanDirectoryHandle(directory);
      setFiles(scanned);
      setSourceName(directory.name);
      setSourceReady(scanned.length > 0);
      if (scanned.length === 0) {
        toast.error("Không tìm thấy file ảnh trong thư mục đã chọn.");
      } else {
        toast.success(`Đã quét ${scanned.length} file ảnh trong "${directory.name}".`);
      }
    } catch (scanError) {
      if (scanError instanceof DOMException && scanError.name === "AbortError") {
        return;
      }
      setError(
        scanError instanceof Error
          ? scanError.message
          : "Không đọc được thư mục đã chọn.",
      );
    }
  };

  const chooseOutputDirectory = async () => {
    const picker = (window as DirectoryPickerWindow).showDirectoryPicker;
    if (!picker) return;
    try {
      const directory = await picker({ mode: "readwrite" });
      outputDirectoryRef.current = directory;
      toast.success(`Folder đầu ra: ${directory.name}`);
    } catch (errorValue) {
      if (errorValue instanceof DOMException && errorValue.name === "AbortError") {
        return;
      }
      toast.error("Không chọn được folder đầu ra.");
    }
  };

  const chooseFallbackFolder = (selected: FileList | null) => {
    if (!selected || selected.length === 0) return;
    inputDirectoryRef.current = null;
    zipRef.current = null;
    const map = new Map<string, File>();
    const entries: FilterFileEntry[] = [];
    for (const file of Array.from(selected)) {
      if (!isImageFile(file.name)) continue;
      const path =
        (file as File & { webkitRelativePath?: string }).webkitRelativePath ||
        file.name;
      const segments = path.split("/");
      const relativePath =
        segments.length > 1 ? segments.slice(1).join("/") : path;
      map.set(relativePath, file);
      entries.push({
        name: file.name,
        relativePath,
        size: file.size,
        lastModified: file.lastModified,
        category: fileCategory(file.name),
      });
    }
    fileMapRef.current = map;
    setFiles(entries.sort((a, b) => a.relativePath.localeCompare(b.relativePath)));
    setSourceName(`Thư mục tải lên (${entries.length} ảnh)`);
    setSourceReady(entries.length > 0);
    setZipName(null);
  };

  const chooseZip = async (selected: File | null) => {
    if (!selected) return;
    setError(null);
    try {
      const archive = await JSZip.loadAsync(selected);
      const entries: FilterFileEntry[] = [];
      Object.values(archive.files).forEach((entry) => {
        if (entry.dir || !isImageFile(entry.name)) return;
        if (entry.name.includes("..")) return;
        entries.push({
          name: entry.name.split("/").pop() ?? entry.name,
          relativePath: entry.name,
          size: 0,
          lastModified: 0,
          category: fileCategory(entry.name),
        });
      });
      zipRef.current = archive;
      inputDirectoryRef.current = null;
      fileMapRef.current.clear();
      setFiles(entries.sort((a, b) => a.relativePath.localeCompare(b.relativePath)));
      setSourceName(`ZIP: ${selected.name}`);
      setSourceReady(entries.length > 0);
      setZipName(selected.name);
      toast.success(`Đã đọc ${entries.length} ảnh trong ZIP.`);
    } catch {
      setError("Không đọc được ZIP. Kiểm tra file và thử lại.");
    }
  };

  const getSourceBlob = async (relativePath: string): Promise<Blob | null> => {
    if (inputDirectoryRef.current) {
      return readFileFromDirectory(inputDirectoryRef.current, relativePath);
    }
    const file = fileMapRef.current.get(relativePath);
    if (file) return file;
    const zipEntry = zipRef.current?.file(relativePath);
    if (zipEntry) return zipEntry.async("blob");
    return null;
  };

  const stop = () => {
    cancelRef.current = true;
    setCancelled(true);
  };

  const startFilter = async () => {
    if (!canStart) return;
    setBusy(true);
    setCancelled(false);
    cancelRef.current = false;
    setError(null);
    setJobId(null);
    setResultRows([]);
    setResultSummary(null);
    if (zipBlobUrl) {
      URL.revokeObjectURL(zipBlobUrl);
      setZipBlobUrl(null);
    }
    const nextProgress = { ...EMPTY_PROGRESS, scanned: files.length };
    setProgress(nextProgress);

    const rows: FilterRow[] = [];
    const usedNames = new Set<string>();
    const manifestRows: {
      inputCode: string;
      filename: string;
      relativePath: string;
      status: string;
      message?: string;
    }[] = [];
    const missingRows: { inputCode: string; message?: string }[] = [];
    const isFs = Boolean(inputDirectoryRef.current);
    let targetDirectory: DirectoryHandleLike | null = null;
    let zip: JSZip | null = null;
    let zipFolder = "";

    try {
      if (isFs) {
        const inputRoot = inputDirectoryRef.current;
        if (!inputRoot) throw new Error("Chưa chọn thư mục nguồn.");
        await ensureWritePermission(inputRoot);
        if (outputMode === "subfolder") {
          const safeFolder = sanitizeFolderName(folderName);
          targetDirectory = await inputRoot.getDirectoryHandle(safeFolder, {
            create: true,
          });
          zipFolder = safeFolder;
        } else {
          const outputRoot = outputDirectoryRef.current;
          if (!outputRoot) {
            throw new Error(
              "Chưa chọn folder đầu ra. Chọn folder hoặc chuyển về tạo folder con.",
            );
          }
          await ensureWritePermission(outputRoot);
          targetDirectory = outputRoot;
        }
      } else {
        zip = new JSZip();
        zipFolder =
          outputMode === "subfolder" ? sanitizeFolderName(folderName) : "";
      }

      for (const [index, item] of resolved.entries()) {
        if (cancelRef.current) break;
        const base = {
          inputCode: item.parsed.raw,
          filename: item.matchedFile?.name ?? "",
          relativePath: item.matchedFile?.relativePath ?? "",
        };
        if (item.status === "ambiguous") {
          const candidates = item.candidates.map((file) => file.relativePath);
          const message = `Không tự copy: khớp ${candidates.length} file (${candidates
            .slice(0, 3)
            .join(", ")}).`;
          rows.push({ ...base, status: "ambiguous", message });
          missingRows.push({ inputCode: item.parsed.raw, message });
          nextProgress.missing += 1;
          setProgress({ ...nextProgress });
          continue;
        }
        if (item.status === "missing" || !item.matchedFile) {
          const message = "Không tìm thấy file khớp.";
          rows.push({ ...base, status: "missing", message });
          missingRows.push({ inputCode: item.parsed.raw, message });
          nextProgress.missing += 1;
          setProgress({ ...nextProgress });
          continue;
        }

        const sourceFile = item.matchedFile;
        try {
          const blob = await getSourceBlob(sourceFile.relativePath);
          if (!blob) {
            throw new Error("Không đọc được file nguồn.");
          }
          const destination =
            targetDirectory ??
            null;
          const destinationName = await resolveDestinationName(
            destination,
            usedNames,
            sourceFile.name,
            conflict,
          );
          if (destinationName.skip) {
            const message = "File đích đã tồn tại, bỏ qua theo cấu hình.";
            rows.push({ ...base, status: "skipped", message });
            manifestRows.push({ ...base, status: "skipped", message });
            nextProgress.matched += 1;
            setProgress({ ...nextProgress });
            continue;
          }
          if (targetDirectory) {
            await writeBlob(targetDirectory, destinationName.name, blob);
          } else if (zip) {
            const path = zipFolder
              ? `${zipFolder}/${destinationName.name}`
              : destinationName.name;
            zip.file(path, blob);
          }
          const finalRelative = zipFolder
            ? `${zipFolder}/${destinationName.name}`
            : destinationName.name;
          rows.push({
            inputCode: item.parsed.raw,
            filename: destinationName.name,
            relativePath: finalRelative,
            status: "matched",
          });
          manifestRows.push({
            inputCode: item.parsed.raw,
            filename: destinationName.name,
            relativePath: finalRelative,
            status: "matched",
          });
          nextProgress.matched += 1;
          nextProgress.copied += 1;
          setProgress({ ...nextProgress });
        } catch (fileError) {
          const message =
            fileError instanceof Error ? fileError.message : "Lỗi copy file.";
          rows.push({ ...base, status: "error", message });
          manifestRows.push({ ...base, status: "error", message });
          missingRows.push({ inputCode: item.parsed.raw, message });
          nextProgress.errors += 1;
          setProgress({ ...nextProgress });
        }
        if (index % 8 === 0) {
          await new Promise((resolve) => window.setTimeout(resolve, 0));
        }
      }

      const manifest = buildManifestCsv(manifestRows);
      const missingText = buildMissingText(missingRows);
      const summary = cancelRef.current ? "cancelled" : "completed";

      if (targetDirectory) {
        await writeBlob(
          targetDirectory,
          "manifest.csv",
          new Blob([manifest], { type: "text/csv;charset=utf-8" }),
        );
        await writeBlob(
          targetDirectory,
          "missing.txt",
          new Blob([missingText], { type: "text/plain;charset=utf-8" }),
        );
      } else if (zip) {
        zip.file("manifest.csv", manifest);
        zip.file("missing.txt", missingText);
        const blob = await zip.generateAsync({ type: "blob" });
        setZipBlobUrl(URL.createObjectURL(blob));
      }

      setResultRows(rows);
      setResultSummary(
        `${summary === "cancelled" ? "Đã hủy" : "Hoàn tất"}: quét ${nextProgress.scanned}, khớp ${nextProgress.matched}, copy ${nextProgress.copied}, missing ${nextProgress.missing}, lỗi ${nextProgress.errors}.`,
      );
      setProgress({ ...nextProgress });

      const saveResult = await savePhotoFilterJobAction({
        albumId,
        mode,
        inputCodesText: text,
        parsedCount: parsed.totalTokens,
        matchedCount: nextProgress.matched,
        missingCount: nextProgress.missing,
        ambiguousCount,
        duplicateCount: parsed.duplicateCount,
        outputMode,
        outputFolderName: folderName,
        fileType,
        status: summary === "cancelled" ? "cancelled" : "completed",
        items: rows.map((row) => ({
          inputCode: row.inputCode,
          matchedFilename: row.filename,
          status: row.status,
          message: row.message,
        })),
      });
      if (saveResult.ok) {
        setJobId(saveResult.jobId);
      } else {
        toast.error(saveResult.error);
      }
      toast.success(
        summary === "cancelled"
          ? "Đã hủy lọc ảnh; phần đã copy được giữ nguyên."
          : "Đã lọc xong ảnh khách chọn.",
      );
    } catch (startError) {
      const message =
        startError instanceof Error ? startError.message : "Không thể lọc ảnh.";
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
      cancelRef.current = false;
    }
  };

  const renderMatchStatus = (item: CodeMatchItem) => {
    if (item.status === "matched") {
      return <Badge tone="success">Khớp</Badge>;
    }
    if (item.status === "ambiguous") {
      return <Badge tone="warning">Ambiguous</Badge>;
    }
    return <Badge tone="danger">Missing</Badge>;
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-4">
        <section className="rounded-xl border border-border bg-surface p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">
                Bước 1 — Mã ảnh khách đã chọn
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Dán từ Excel/Zalo. Hỗ trợ xuống dòng, dấu phẩy, dấu cách, số thứ
                tự và đuôi file.
              </p>
            </div>
            {albumTitle ? (
              <Badge tone="info">Nguồn: {albumTitle}</Badge>
            ) : (
              <Badge tone="neutral">Không gắn album</Badge>
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg border border-border p-1">
              <button
                type="button"
                onClick={() => setMode("alphanumeric")}
                className={
                  mode === "alphanumeric"
                    ? "rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground"
                    : "rounded-md px-3 py-1.5 text-sm text-muted-foreground"
                }
              >
                Chữ và số
              </button>
              <button
                type="button"
                onClick={() => setMode("numeric")}
                className={
                  mode === "numeric"
                    ? "rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground"
                    : "rounded-md px-3 py-1.5 text-sm text-muted-foreground"
                }
              >
                Chỉ lấy số
              </button>
            </div>
            {parsed.valid.length > 0 ? (
              <Badge tone="success">{parsed.valid.length} mã hợp lệ</Badge>
            ) : null}
            {albumFiles.length > 0 ? (
              <Badge tone={albumValidCount > 0 ? "info" : "warning"}>
                {albumValidCount} mã khớp album
              </Badge>
            ) : null}
            {parsed.duplicateCount > 0 ? (
              <Badge tone="warning">{parsed.duplicateCount} trùng</Badge>
            ) : null}
            {parsed.invalidCount > 0 ? (
              <Badge tone="danger">{parsed.invalidCount} không hợp lệ</Badge>
            ) : null}
            {parsed.numericAmbiguousCount > 0 && mode === "numeric" ? (
              <Badge tone="warning">
                {parsed.numericAmbiguousCount} mã có nhiều cụm số, dùng cụm cuối
              </Badge>
            ) : null}
            <CopyCodesMenu
              items={parsed.valid.map((item) => {
                const basename = basenameOf(item.raw);
                return {
                  code: stripExtension(basename),
                  filename: basename,
                };
              })}
              label="Copy nhanh 4 định dạng"
            />
          </div>

          <Textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={8}
            placeholder={"ANH-001\nANH-002\nANH-003"}
            className="mt-3 font-mono text-xs"
            aria-label="Danh sách mã ảnh khách chọn"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            {parsed.totalTokens} token · {parsed.items.length} mã sau chuẩn hóa.
            Mã trùng chỉ xử lý một lần.
          </p>
        </section>

        <section className="rounded-xl border border-border bg-surface p-4">
          <h2 className="text-base font-semibold text-foreground">
            Bước 2 — Chọn folder ảnh gốc trên máy
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            File System Access API đọc ngay trên máy và chỉ copy file; không tải
            toàn bộ ảnh lên server và không gửi đường dẫn tuyệt đối.
          </p>

          {pickerSupported ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => void chooseInputDirectory()}>
                <FolderOpen className="h-4 w-4" aria-hidden />
                Chọn thư mục ảnh gốc
              </Button>
              {outputMode === "subfolder" ? (
                <span className="self-center text-xs text-muted-foreground">
                  Folder con sẽ tạo trong thư mục gốc sau khi cấp quyền ghi.
                </span>
              ) : (
                <Button variant="outline" onClick={() => void chooseOutputDirectory()}>
                  <FolderSearch className="h-4 w-4" aria-hidden />
                  Chọn folder đầu ra
                </Button>
              )}
            </div>
          ) : (
            <Alert tone="warning" className="mt-3">
              Trình duyệt không hỗ trợ File System Access API. Dùng chọn thư mục
              (webkitdirectory) hoặc ZIP bên dưới; kết quả sẽ tải về dạng ZIP.
              Server không đọc ổ đĩa của bạn.
            </Alert>
          )}

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-border p-3">
              <Label htmlFor="filter-folder-fallback">Hoặc chọn thư mục trên máy</Label>
              <Input
                id="filter-folder-fallback"
                type="file"
                multiple
                className="mt-1.5"
                ref={(element) => {
                  if (element) {
                    element.setAttribute("webkitdirectory", "");
                    element.setAttribute("directory", "");
                  }
                }}
                onChange={(event) => chooseFallbackFolder(event.target.files)}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Fallback không ghi lại được vào folder gốc; tải ZIP kết quả.
              </p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <Label htmlFor="filter-zip">Hoặc chọn file ZIP ảnh</Label>
              <Input
                id="filter-zip"
                type="file"
                accept=".zip,application/zip"
                className="mt-1.5"
                onChange={(event) =>
                  void chooseZip(event.target.files?.[0] ?? null)
                }
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Đọc danh sách file trong ZIP; không upload toàn bộ ZIP lên server.
              </p>
            </div>
          </div>

          {sourceName ? (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-surface-muted px-3 py-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-[var(--success)]" aria-hidden />
              <span className="text-foreground">{sourceName}</span>
              <Badge tone="info">{files.length} file ảnh</Badge>
              {zipName ? <Badge tone="neutral">ZIP fallback</Badge> : null}
            </div>
          ) : null}
        </section>

        <section className="rounded-xl border border-border bg-surface p-4">
          <h2 className="text-base font-semibold text-foreground">
            Bước 3 — Cấu hình đầu ra
          </h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div>
              <Label htmlFor="filter-output-mode">Nơi lưu ảnh đã lọc</Label>
              <Select
                id="filter-output-mode"
                value={outputMode}
                onChange={(event) =>
                  setOutputMode(event.target.value as "subfolder" | "separate")
                }
                className="mt-1.5"
              >
                <option value="subfolder">Tạo folder con trong folder gốc</option>
                <option value="separate">Dùng folder đầu ra riêng</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="filter-folder-name">Tên folder con</Label>
              <Input
                id="filter-folder-name"
                value={folderName}
                onChange={(event) => setFolderName(event.target.value)}
                maxLength={80}
                className="mt-1.5"
                disabled={outputMode === "separate"}
              />
            </div>
            <div>
              <Label htmlFor="filter-file-type">Định dạng file</Label>
              <Select
                id="filter-file-type"
                value={fileType}
                onChange={(event) =>
                  setFileType(event.target.value as FileTypeFilter)
                }
                className="mt-1.5"
              >
                <option value="all">Tất cả (RAW & JPG)</option>
                <option value="raw">Chỉ lấy RAW</option>
                <option value="standard">Chỉ lấy JPG/PNG</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="filter-conflict">Khi file đích tồn tại</Label>
              <Select
                id="filter-conflict"
                value={conflict}
                onChange={(event) =>
                  setConflict(event.target.value as "rename" | "overwrite" | "skip")
                }
                className="mt-1.5"
              >
                <option value="rename">Đổi tên file mới</option>
                <option value="overwrite">Ghi đè</option>
                <option value="skip">Bỏ qua</option>
              </Select>
            </div>
          </div>
          <div className="mt-3 rounded-lg bg-surface-muted p-3 text-xs text-muted-foreground">
            Chỉ copy file, không xóa/di chuyển file gốc. Giữ nguyên extension.
            Với fallback ZIP, file kết quả được đóng gói để tải về.
          </div>
        </section>

        {matches.items.length > 0 ? (
          <section className="rounded-xl border border-border bg-surface p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-foreground">
                Kết quả so khớp
              </h2>
              <div className="flex flex-wrap gap-1.5">
                <Badge tone="success">{matchedCount} khớp</Badge>
                <Badge tone="warning">{ambiguousCount} ambiguous</Badge>
                <Badge tone="danger">{missingCount} missing</Badge>
              </div>
            </div>
            <ul className="mt-3 divide-y divide-border text-sm">
              {resolved.map((item) => (
                <li key={itemKey(item)} className="py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="font-mono text-xs font-semibold">
                        {item.parsed.raw}
                      </span>
                      {renderMatchStatus(item)}
                    </div>
                    {item.status === "matched" ? (
                      <span className="truncate text-xs text-muted-foreground">
                        {item.matchedFile?.relativePath}
                      </span>
                    ) : null}
                  </div>
                  {item.status === "ambiguous" ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Select
                        value={choices[itemKey(item)] ?? ""}
                        onChange={(event) =>
                          setChoices((previous) => ({
                            ...previous,
                            [itemKey(item)]: event.target.value,
                          }))
                        }
                        className="max-w-md"
                        aria-label={`Chọn file cho mã ${item.parsed.raw}`}
                      >
                        <option value="">Chọn file thủ công...</option>
                        {item.candidates.map((candidate) => (
                          <option
                            key={candidate.relativePath}
                            value={candidate.relativePath}
                          >
                            {candidate.relativePath}
                          </option>
                        ))}
                      </Select>
                      <span className="text-xs text-[var(--warning)]">
                        Không tự copy khi chưa xác nhận.
                      </span>
                    </div>
                  ) : null}
                  {item.status === "missing" && albumFiles.length > 0 ? (
                    <MissingSuggestions
                      raw={item.parsed.raw}
                      albumFiles={albumFiles}
                    />
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="rounded-xl border border-border bg-surface p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">
                Bước 4 — Chạy lọc
              </h2>
              <p className="text-sm text-muted-foreground">
                Nút chỉ bật khi có mã hợp lệ và đã chọn nguồn ảnh.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {busy ? (
                <Button variant="outline" onClick={stop}>
                  <Square className="h-4 w-4" aria-hidden />
                  Hủy giữa chừng
                </Button>
              ) : null}
              <Button onClick={() => void startFilter()} disabled={!canStart}>
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Play className="h-4 w-4" aria-hidden />
                )}
                Bắt đầu lọc ảnh từ máy tính
              </Button>
            </div>
          </div>

          {busy || progress.scanned > 0 ? (
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
              <ProgressCell label="Đã quét" value={progress.scanned} />
              <ProgressCell label="Khớp" value={progress.matched} />
              <ProgressCell label="Đã copy" value={progress.copied} />
              <ProgressCell label="Missing" value={progress.missing} />
              <ProgressCell label="Lỗi" value={progress.errors} />
            </div>
          ) : null}

          {cancelled ? (
            <Alert tone="warning" className="mt-3">
              Đang dừng sau file hiện tại. Các file đã copy không bị xóa.
            </Alert>
          ) : null}
          {error ? (
            <Alert tone="danger" className="mt-3">
              {error}
            </Alert>
          ) : null}

          {resultSummary ? (
            <div className="mt-3 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-[var(--success)] dark:border-emerald-900 dark:bg-emerald-950/40">
              <p className="font-medium">{resultSummary}</p>
              {jobId ? (
                <p className="mt-1 text-xs">Đã lưu lịch sử job: {jobId}</p>
              ) : null}
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    downloadText(
                      "manifest.csv",
                      buildManifestCsv(
                        resultRows.map((row) => ({
                          inputCode: row.inputCode,
                          filename: row.filename,
                          relativePath: row.relativePath,
                          status: row.status,
                          message: row.message,
                        })),
                      ),
                    )
                  }
                >
                  <Download className="h-4 w-4" aria-hidden />
                  manifest.csv
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    downloadText(
                      "missing.txt",
                      buildMissingText(
                        resultRows
                          .filter(
                            (row) =>
                              row.status === "missing" ||
                              row.status === "ambiguous" ||
                              row.status === "error",
                          )
                          .map((row) => ({
                            inputCode: row.inputCode,
                            message: row.message,
                          })),
                      ),
                    )
                  }
                >
                  <Download className="h-4 w-4" aria-hidden />
                  missing.txt
                </Button>
                {zipBlobUrl ? (
                  <Button asChild size="sm" variant="outline">
                    <a href={zipBlobUrl} download="anh-khach-chon.zip">
                      <FileArchive className="h-4 w-4" aria-hidden />
                      Tải ZIP kết quả
                    </a>
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}

          {resultRows.length > 0 ? (
            <div className="mt-3 max-h-80 overflow-auto rounded-lg border border-border">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-surface-muted">
                  <tr>
                    <th className="px-2 py-2 text-left">Mã</th>
                    <th className="px-2 py-2 text-left">File đích</th>
                    <th className="px-2 py-2 text-left">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {resultRows.map((row, index) => (
                    <tr key={`${row.inputCode}-${index}`}>
                      <td className="px-2 py-1.5 font-mono">{row.inputCode}</td>
                      <td className="max-w-56 truncate px-2 py-1.5">
                        {row.relativePath || "—"}
                      </td>
                      <td className="px-2 py-1.5">
                        {row.status === "matched" ? (
                          <span className="text-[var(--success)]">Đã copy</span>
                        ) : row.status === "skipped" ? (
                          <span className="text-[var(--warning)]">Bỏ qua</span>
                        ) : row.status === "error" ? (
                          <span className="text-[var(--danger)]">Lỗi</span>
                        ) : (
                          <span className="text-[var(--warning)]">{row.status}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      </div>

      <aside className="space-y-4">
        <section className="rounded-xl border border-border bg-surface p-4 text-sm">
          <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
            <Upload className="h-4 w-4 text-primary" aria-hidden />
            Trạng thái xử lý
          </h2>
          <dl className="mt-2 space-y-1.5 text-xs">
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Mã nhập</dt>
              <dd>{parsed.totalTokens}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Mã hợp lệ</dt>
              <dd>{parsed.valid.length}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">File đã quét</dt>
              <dd>{files.length}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">File phù hợp định dạng</dt>
              <dd>{eligibleFiles.length}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">File sẽ copy</dt>
              <dd>{matchedCount}</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-muted-foreground">
            Mã được so khớp exact basename trước; chế độ chỉ số dùng cụm số cuối.
          </p>
        </section>

        <section className="rounded-xl border border-border bg-surface p-4 text-sm">
          <h2 className="text-base font-semibold text-foreground">An toàn dữ liệu</h2>
          <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
            <li className="flex gap-2">
              <Copy className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              Chỉ copy, không xóa hoặc di chuyển file gốc.
            </li>
            <li className="flex gap-2">
              <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              Không lưu đường dẫn tuyệt đối trên máy khách.
            </li>
            <li className="flex gap-2">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              Ambiguous không tự copy; cần chọn thủ công.
            </li>
          </ul>
        </section>
      </aside>
    </div>
  );
}

function ProgressCell({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border px-2 py-1.5">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function MissingSuggestions({
  raw,
  albumFiles,
}: {
  raw: string;
  albumFiles: { code: string; filename: string }[];
}) {
  const suggestions = suggestSimilarAlbumCodes(raw, albumFiles);
  if (suggestions.length === 0) return null;
  return (
    <p className="mt-1 text-xs text-muted-foreground">
      Gợi ý heuristic (không tự copy):{" "}
      {suggestions
        .map((item) => `${item.code} (${item.filename}, cách ${item.distance})`)
        .join(" · ")}
    </p>
  );
}

