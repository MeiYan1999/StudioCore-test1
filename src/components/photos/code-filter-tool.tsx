"use client";

import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import JSZip from "jszip";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Copy,
  Download,
  FileArchive,
  FileText,
  FolderArchive,
  FolderCheck,
  FolderOpen,
  FolderSearch,
  Info,
  Loader2,
  Play,
  RefreshCw,
  Scissors,
  Search,
  Sparkles,
  Square,
  Upload,
  X,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  getAlbumFilterSourceAction,
  savePhotoFilterJobAction,
} from "@/lib/actions/filter-actions";
import {
  basenameOf,
  buildManifestCsv,
  buildMissingText,
  fileCategory,
  fileMatchesType,
  isOutputOrIgnoredDirectory,
  matchCodesToFiles,
  parseCustomerCodes,
  sanitizeFolderName,
  stripExtension,
  suggestSimilarAlbumCodes,
  type CodeMatchItem,
  type CodeMatchMode,
  type FileTypeFilter,
  type FilterFileEntry,
  type MatchStatus,
} from "@/lib/photos/filter-codes";
import { copyToClipboard } from "@/lib/utils/clipboard";

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
  queryPermission?: (options: {
    mode: "read" | "readwrite";
  }) => Promise<"granted" | "denied" | "prompt">;
  requestPermission?: (options: {
    mode: "read" | "readwrite";
  }) => Promise<"granted" | "denied" | "prompt">;
  removeEntry?: (
    name: string,
    options?: { recursive?: boolean },
  ) => Promise<void>;
};

type FileHandleLike = {
  name: string;
  kind: "file";
  getFile(): Promise<File>;
  createWritable?(options?: { keepExistingData?: boolean }): Promise<{
    write(data: Blob): Promise<void>;
    close(): Promise<void>;
    abort?(): Promise<void>;
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

function pickerAvailable(): boolean {
  if (typeof window === "undefined") return false;
  return typeof (window as DirectoryPickerWindow).showDirectoryPicker === "function";
}

function subscribeNoop(): () => void {
  return () => {};
}

async function scanDirectory(
  root: DirectoryHandleLike,
  onProgress?: (count: number) => void,
  ignoredSubfolder?: string,
): Promise<FilterFileEntry[]> {
  const entries: FilterFileEntry[] = [];
  let scannedCount = 0;

  async function walk(
    directory: DirectoryHandleLike,
    parentPath: string,
  ): Promise<void> {
    for await (const [name, handle] of directory.entries()) {
      if (name.startsWith(".")) continue;
      if (handle.kind === "directory") {
        if (isOutputOrIgnoredDirectory(name, ignoredSubfolder)) {
          continue;
        }
        const relativePath = parentPath ? `${parentPath}/${name}` : name;
        await walk(handle as DirectoryHandleLike, relativePath);
      } else if (handle.kind === "file") {
        const category = fileCategory(name);
        if (!category) continue;
        try {
          const file = await (handle as FileHandleLike).getFile();
          const relativePath = parentPath ? `${parentPath}/${name}` : name;
          entries.push({
            name,
            relativePath,
            size: file.size,
            lastModified: file.lastModified,
            category,
            file,
            fileHandle: handle as FileHandleLike,
          });
          scannedCount += 1;
          if (scannedCount % 50 === 0 && onProgress) {
            onProgress(scannedCount);
          }
        } catch {
          // Skip inaccessible file
        }
      }
    }
  }

  await walk(root, "");
  return entries.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

async function readFileFromDirectory(
  root: DirectoryHandleLike,
  relativePath: string,
): Promise<File> {
  const normalizedPath = relativePath.replace(/\\/g, "/");
  const segments = normalizedPath.split("/").filter(Boolean);
  const filename = segments.pop() ?? normalizedPath;
  let directory = root;
  for (const segment of segments) {
    try {
      directory = await directory.getDirectoryHandle(segment);
    } catch {
      // Tìm kiếm không phân biệt hoa thường
      let found: DirectoryHandleLike | null = null;
      const lower = segment.toLowerCase();
      for await (const [name, handle] of directory.entries()) {
        if (handle.kind === "directory" && name.toLowerCase() === lower) {
          found = handle as DirectoryHandleLike;
          break;
        }
      }
      if (!found) {
        throw new Error(`Không tìm thấy thư mục con "${segment}".`);
      }
      directory = found;
    }
  }

  try {
    const handle = await directory.getFileHandle(filename);
    return await handle.getFile();
  } catch {
    // Tìm kiếm file không phân biệt hoa thường
    const lowerFilename = filename.toLowerCase();
    for await (const [name, handle] of directory.entries()) {
      if (handle.kind === "file" && name.toLowerCase() === lowerFilename) {
        return await (handle as FileHandleLike).getFile();
      }
    }
    throw new Error(`Không tìm thấy file "${filename}" trong thư mục.`);
  }
}

async function readSourceFileBlob(
  root: DirectoryHandleLike,
  sourceFile: FilterFileEntry,
): Promise<Blob> {
  // Chiến lược 1: Lấy File snapshot tươi mới ngay tại thời điểm copy từ fileHandle và nạp ngay vào RAM
  if (
    sourceFile.fileHandle &&
    typeof (sourceFile.fileHandle as FileHandleLike).getFile === "function"
  ) {
    try {
      const freshFile = await (sourceFile.fileHandle as FileHandleLike).getFile();
      const buffer = await freshFile.arrayBuffer();
      return new Blob([buffer], {
        type: freshFile.type || "application/octet-stream",
      });
    } catch {
      // Snapshot của fileHandle có thể bị stale hoặc metadata APFS thay đổi, chuyển sang chiến lược 2
    }
  }

  // Chiến lược 2: Duyệt lại từ root directory handle theo đường dẫn tương đối
  try {
    const file = await readFileFromDirectory(root, sourceFile.relativePath);
    const buffer = await file.arrayBuffer();
    return new Blob([buffer], {
      type: file.type || "application/octet-stream",
    });
  } catch {
    // Chuyển sang chiến lược 3
  }

  // Chiến lược 3: Tìm kiếm trực tiếp ở thư mục gốc nếu đường dẫn tương đối có thay đổi
  if (sourceFile.name !== sourceFile.relativePath) {
    try {
      const file = await readFileFromDirectory(root, sourceFile.name);
      const buffer = await file.arrayBuffer();
      return new Blob([buffer], {
        type: file.type || "application/octet-stream",
      });
    } catch {
      // Chuyển sang chiến lược 4
    }
  }

  // Chiến lược 4: Dùng File snapshot lưu lúc quét ban đầu nếu vẫn đọc được
  if (sourceFile.file) {
    try {
      const buffer = await sourceFile.file.arrayBuffer();
      return new Blob([buffer], {
        type: sourceFile.file.type || "application/octet-stream",
      });
    } catch {
      // Không đọc được
    }
  }

  throw new Error(`Không thể đọc file "${sourceFile.name}" từ thư mục gốc.`);
}

async function entryExists(
  directory: DirectoryHandleLike,
  name: string,
): Promise<boolean> {
  try {
    await directory.getFileHandle(name);
    return true;
  } catch (err: unknown) {
    if (
      err instanceof DOMException &&
      (err.name === "TypeMismatchError" || err.name === "PathExistsError")
    ) {
      return true;
    }
  }
  try {
    await directory.getDirectoryHandle(name);
    return true;
  } catch {
    return false;
  }
}

async function getOrCreateDirectoryHandle(
  parent: DirectoryHandleLike,
  name: string,
): Promise<{ handle: DirectoryHandleLike; finalName: string }> {
  // 1. Thử mở thư mục đã có mà không cần tạo mới (tránh PathExistsError trên Chrome)
  try {
    const existing = await parent.getDirectoryHandle(name, { create: false });
    return { handle: existing, finalName: name };
  } catch {
    // Không tìm thấy thư mục, tiến hành tạo mới
  }

  // 2. Thử tạo mới thư mục
  try {
    const created = await parent.getDirectoryHandle(name, { create: true });
    return { handle: created, finalName: name };
  } catch (createErr: unknown) {
    // 3. Nếu gặp PathExistsError / TypeMismatchError ("An attempt was made to create a file or directory where an element already exists.")
    // Thử lại lần nữa mở trực tiếp hoặc dùng tên biến thể (1), (2)...
    try {
      const fallbackOpen = await parent.getDirectoryHandle(name);
      return { handle: fallbackOpen, finalName: name };
    } catch {
      for (let i = 1; i <= 20; i += 1) {
        const candidateName = `${name} (${i})`;
        try {
          try {
            const candDir = await parent.getDirectoryHandle(candidateName, { create: false });
            return { handle: candDir, finalName: candidateName };
          } catch {
            // Không có sẵn, thử tạo
          }
          const candCreated = await parent.getDirectoryHandle(candidateName, { create: true });
          return { handle: candCreated, finalName: candidateName };
        } catch {
          // thử tên tiếp theo
        }
      }
      throw createErr;
    }
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
    (directory ? await entryExists(directory, filename) : false) ||
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
      (directory ? await entryExists(directory, candidate) : false) ||
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
  if (handle.queryPermission) {
    try {
      const current = await handle.queryPermission({ mode: "readwrite" });
      if (current === "granted") return;
    } catch {
      // Proceed to requestPermission
    }
  }
  if (!handle.requestPermission) return;
  const state = await handle.requestPermission({ mode: "readwrite" });
  if (state !== "granted") {
    throw new Error(
      "Chưa được cấp quyền ghi thư mục. Vui lòng cho phép quyền chỉnh sửa (Edit/Save) trên trình duyệt.",
    );
  }
}

async function writeBlob(
  directory: DirectoryHandleLike,
  filename: string,
  blob: Blob,
): Promise<void> {
  let handle: FileHandleLike;
  try {
    handle = await directory.getFileHandle(filename, { create: true });
  } catch (err: unknown) {
    // Nếu bị trùng với thư mục hoặc gặp PathExistsError, đặt tên an toàn
    const { stem, extension } = splitFilename(filename);
    let idx = 1;
    while (true) {
      try {
        handle = await directory.getFileHandle(`${stem}_${idx}${extension}`, { create: true });
        break;
      } catch {
        idx += 1;
        if (idx > 50) throw err;
      }
    }
  }
  if (!handle.createWritable) {
    throw new Error("Trình duyệt không hỗ trợ ghi file vào thư mục.");
  }
  const writable = await handle.createWritable({ keepExistingData: false });
  try {
    await writable.write(blob);
    await writable.close();
  } catch (writeErr: unknown) {
    try {
      if (writable.abort) {
        await writable.abort();
      }
    } catch {
      // Bỏ qua lỗi abort
    }
    throw writeErr;
  }
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

export type AlbumOptionItem = {
  id: string;
  title: string;
  customerName?: string | null;
  orderCode?: string | null;
};

export type SelectedCodeItem = {
  code: string;
  filename: string;
  note: string | null;
  thumbnailKey?: string | null;
  previewKey?: string | null;
};

export type CodeFilterToolProps = {
  albumId?: string | null;
  albumTitle?: string | null;
  albumFiles?: { code: string; filename: string }[];
  initialCodes?: SelectedCodeItem[];
  albumsList?: AlbumOptionItem[];
  onJobSaved?: (jobId: string) => void;
};

export function CodeFilterTool({
  albumId: propAlbumId,
  albumTitle: propAlbumTitle,
  albumFiles: propAlbumFiles = [],
  initialCodes: propInitialCodes = [],
  albumsList = [],
  onJobSaved,
}: CodeFilterToolProps) {
  const pickerSupported = useSyncExternalStore(
    subscribeNoop,
    pickerAvailable,
    () => false,
  );

  // Album selection state
  const [selectedAlbumId, setSelectedAlbumId] = useState<string>(
    propAlbumId || (albumsList.length > 0 ? albumsList[0]?.id || "" : ""),
  );
  const [currentAlbumTitle, setCurrentAlbumTitle] = useState<string>(
    propAlbumTitle || (albumsList.length > 0 ? albumsList[0]?.title || "" : ""),
  );
  const [currentAlbumFiles, setCurrentAlbumFiles] = useState<{ code: string; filename: string }[]>(
    propAlbumFiles,
  );
  const [currentSelectedCodes, setCurrentSelectedCodes] = useState<SelectedCodeItem[]>(
    propInitialCodes,
  );
  const [isLoadingAlbum, setIsLoadingAlbum] = useState<boolean>(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const [albumSearchText, setAlbumSearchText] = useState<string>("");

  // Input codes and filter configuration
  const initialText = useMemo(() => {
    if (propInitialCodes.length > 0) {
      return propInitialCodes.map((item) => item.code).join("\n");
    }
    return "";
  }, [propInitialCodes]);

  const [text, setText] = useState<string>(initialText);
  const [mode, setMode] = useState<CodeMatchMode>("alphanumeric");
  const [fileType, setFileType] = useState<FileTypeFilter>("all");
  const [createSubfolder, setCreateSubfolder] = useState<boolean>(true);
  const [subfolderName, setSubfolderName] = useState<string>("Ảnh Khách Chọn");
  const [conflictPolicy, setConflictPolicy] = useState<"rename" | "overwrite" | "skip">("rename");

  // Modals state
  const [isNotesModalOpen, setIsNotesModalOpen] = useState<boolean>(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState<boolean>(false);

  // File System Access API & Scanning state
  const [inputHandle, setInputHandle] = useState<DirectoryHandleLike | null>(null);
  const [inputFolderName, setInputFolderName] = useState<string>("");
  const [outputHandle, setOutputHandle] = useState<DirectoryHandleLike | null>(null);
  const [outputFolderName, setOutputFolderName] = useState<string>("");
  const [filterAction, setFilterAction] = useState<"copy" | "move">("copy");
  const [fallbackFiles, setFallbackFiles] = useState<FilterFileEntry[]>([]);
  const [scannedFiles, setScannedFiles] = useState<FilterFileEntry[]>([]);
  const [isScanning, setIsScanning] = useState<boolean>(false);

  // Execution state
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [progress, setProgress] = useState<FilterProgress>(EMPTY_PROGRESS);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [rows, setRows] = useState<FilterRow[]>([]);
  const [filterDone, setFilterDone] = useState<boolean>(false);
  const [lastJobId, setLastJobId] = useState<string | null>(null);

  const abortRef = useRef<boolean>(false);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // Parse codes from textarea
  const parsed = useMemo(() => parseCustomerCodes(text, mode), [text, mode]);

  // Filtered albums list for combobox
  const filteredAlbums = useMemo(() => {
    if (!albumSearchText.trim()) return albumsList;
    const q = albumSearchText.toLowerCase();
    return albumsList.filter((album) => {
      return (
        album.title.toLowerCase().includes(q) ||
        (album.customerName && album.customerName.toLowerCase().includes(q)) ||
        (album.orderCode && album.orderCode.toLowerCase().includes(q))
      );
    });
  }, [albumsList, albumSearchText]);

  // Handle switching albums
  const handleSelectAlbum = async (album: AlbumOptionItem) => {
    setSelectedAlbumId(album.id);
    setCurrentAlbumTitle(album.title);
    setIsDropdownOpen(false);
    setIsLoadingAlbum(true);

    try {
      const res = await getAlbumFilterSourceAction(album.id);
      if (res.ok) {
        setCurrentAlbumFiles(res.source.albumFiles);
        setCurrentSelectedCodes(res.source.selectedCodes);
        if (res.source.selectedCodes.length > 0) {
          const codesText = res.source.selectedCodes.map((item) => item.code).join("\n");
          setText(codesText);
          toast.success(
            `Đã nạp ${res.source.selectedCodes.length} mã ảnh từ album "${album.title}"!`,
          );
        } else {
          toast.info(`Album "${album.title}" chưa có mã ảnh nào được khách chọn.`);
        }
        // Update URL cleanly
        if (typeof window !== "undefined") {
          const url = new URL(window.location.href);
          url.searchParams.set("albumId", album.id);
          window.history.replaceState(null, "", url.toString());
        }
      } else {
        toast.error(res.error || "Không thể tải dữ liệu album.");
      }
    } catch {
      toast.error("Lỗi khi tải thông tin album.");
    } finally {
      setIsLoadingAlbum(false);
    }
  };

  // 1-Touch Copy Buttons
  const handleCopyNewline = async () => {
    if (parsed.valid.length === 0) {
      toast.error("Chưa có mã hợp lệ để copy.");
      return;
    }
    const content = parsed.valid.map((item) => item.raw).join("\n");
    const ok = await copyToClipboard(content);
    if (ok) {
      toast.success(`Đã sao chép ${parsed.valid.length} mã (dạng xuống dòng) vào Clipboard!`);
    } else {
      toast.error("Không thể tự động sao chép.");
    }
  };

  const handleCopyComma = async () => {
    if (parsed.valid.length === 0) {
      toast.error("Chưa có mã hợp lệ để copy.");
      return;
    }
    const content = parsed.valid.map((item) => item.raw).join(", ");
    const ok = await copyToClipboard(content);
    if (ok) {
      toast.success(`Đã sao chép ${parsed.valid.length} mã (phân cách bằng dấu phẩy) vào Clipboard!`);
    } else {
      toast.error("Không thể tự động sao chép.");
    }
  };

  const handleCopySpace = async () => {
    if (parsed.valid.length === 0) {
      toast.error("Chưa có mã hợp lệ để copy.");
      return;
    }
    const content = parsed.valid.map((item) => item.raw).join(" ");
    const ok = await copyToClipboard(content);
    if (ok) {
      toast.success(`Đã sao chép ${parsed.valid.length} mã (phân cách bằng dấu cách) vào Clipboard!`);
    } else {
      toast.error("Không thể tự động sao chép.");
    }
  };

  const handleCopyWithExtension = async () => {
    if (parsed.valid.length === 0) {
      toast.error("Chưa có mã hợp lệ để copy.");
      return;
    }
    // Determine extension or default to .jpg
    const content = parsed.valid
      .map((item) => {
        const raw = item.raw;
        return raw.includes(".") ? raw : `${raw}.jpg`;
      })
      .join("\n");
    const ok = await copyToClipboard(content);
    if (ok) {
      toast.success(`Đã sao chép ${parsed.valid.length} mã (kèm đuôi file .jpg) vào Clipboard!`);
    } else {
      toast.error("Không thể tự động sao chép.");
    }
  };

  // Folder picking logic
  const chooseInputDirectory = async () => {
    if (!pickerSupported) {
      folderInputRef.current?.click();
      return;
    }
    try {
      const pickerWin = window as DirectoryPickerWindow;
      if (!pickerWin.showDirectoryPicker) {
        folderInputRef.current?.click();
        return;
      }
      let handle: DirectoryHandleLike;
      try {
        handle = await pickerWin.showDirectoryPicker({ mode: "readwrite" });
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }
        // Thử lại với chế độ read nếu trình duyệt không hỗ trợ trực tiếp mode readwrite lúc pick
        handle = await pickerWin.showDirectoryPicker({ mode: "read" });
      }
      setInputHandle(handle);
      setInputFolderName(handle.name);
      setIsScanning(true);
      toast.info(`Đang quét ảnh trong thư mục "${handle.name}"...`);

      const scanned = await scanDirectory(
        handle,
        (count) => {
          setStatusMessage(`Đang quét file trên máy tính: ${count} ảnh...`);
        },
        subfolderName,
      );

      setScannedFiles(scanned);
      setIsScanning(false);
      setStatusMessage("");
      toast.success(`Đã quét xong: tìm thấy ${scanned.length} file ảnh trong "${handle.name}"!`);
    } catch (err: unknown) {
      setIsScanning(false);
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }
      toast.error("Không mở được thư mục trên máy tính.");
    }
  };

  // Chọn thư mục đích riêng (chuẩn s2.io.vn)
  const chooseOutputDirectory = async () => {
    if (!pickerSupported) {
      toast.error("Trình duyệt không hỗ trợ chọn thư mục đích trực tiếp.");
      return;
    }
    try {
      const pickerWin = window as DirectoryPickerWindow;
      if (!pickerWin.showDirectoryPicker) {
        toast.error("Trình duyệt không hỗ trợ chọn thư mục.");
        return;
      }
      let handle: DirectoryHandleLike;
      try {
        handle = await pickerWin.showDirectoryPicker({ mode: "readwrite" });
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }
        handle = await pickerWin.showDirectoryPicker();
      }
      setOutputHandle(handle);
      setOutputFolderName(handle.name);
      toast.success(`Đã chọn thư mục đích: "${handle.name}"`);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }
      toast.error("Không mở được thư mục đích.");
    }
  };

  const clearOutputDirectory = () => {
    setOutputHandle(null);
    setOutputFolderName("");
  };

  const handleFallbackFolderChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files;
    if (!fileList || fileList.length === 0) return;
    const entries: FilterFileEntry[] = [];
    for (let i = 0; i < fileList.length; i += 1) {
      const file = fileList[i];
      if (!file) continue;
      const relativePath = file.webkitRelativePath || file.name;
      const pathParts = relativePath.split("/");
      if (pathParts.length > 1) {
        const dirParts = pathParts.slice(0, -1);
        if (dirParts.some((p) => isOutputOrIgnoredDirectory(p, subfolderName))) {
          continue;
        }
      }
      const category = fileCategory(file.name);
      if (!category) continue;
      entries.push({
        name: file.name,
        relativePath,
        size: file.size,
        lastModified: file.lastModified,
        category,
        file,
      });
    }
    setFallbackFiles(entries);
    setScannedFiles(entries);
    const firstPath = fileList[0]?.webkitRelativePath || "";
    const folderName = firstPath ? firstPath.split("/")[0] || "Thư mục máy tính" : "Thư mục máy tính";
    setInputFolderName(folderName);
    toast.success(`Đã quét được ${entries.length} file từ thư mục "${folderName}"!`);
  };

  // Run filter logic
  const handleStartFiltering = async () => {
    if (parsed.valid.length === 0) {
      toast.error("Vui lòng dán hoặc chọn ít nhất 1 mã ảnh để lọc.");
      return;
    }

    if (!inputHandle && fallbackFiles.length === 0) {
      // Trigger directory selection directly
      toast.info("Vui lòng chọn thư mục ảnh gốc trên máy tính trước!");
      await chooseInputDirectory();
      return;
    }

    const availableFiles = scannedFiles.filter((file) => {
      const parts = file.relativePath.split("/");
      if (parts.length > 1) {
        const dirParts = parts.slice(0, -1);
        if (dirParts.some((part) => isOutputOrIgnoredDirectory(part, subfolderName))) {
          return false;
        }
      }
      return fileMatchesType(file, fileType);
    });

    if (availableFiles.length === 0) {
      toast.error(
        `Không tìm thấy file phù hợp với bộ lọc định dạng "${fileType === "raw" ? "Chỉ RAW" : fileType === "standard" ? "Chỉ JPG/PNG" : "Tất cả"}".`,
      );
      return;
    }

    setIsRunning(true);
    setFilterDone(false);
    abortRef.current = false;
    setProgress(EMPTY_PROGRESS);
    setStatusMessage("Đang chuẩn bị so khớp mã...");

    // Perform match
    const matchResult = matchCodesToFiles(parsed.valid, availableFiles, mode);

    type CopyTask = {
      parsed: typeof parsed.valid[0];
      sourceFile: FilterFileEntry;
      resolutionNote?: string;
    };

    const tasksToCopy: CopyTask[] = [];
    const missingItems: CodeMatchItem[] = [];

    for (const item of matchResult.items) {
      if (item.status === "matched" && item.matchedFile) {
        tasksToCopy.push({
          parsed: item.parsed,
          sourceFile: item.matchedFile,
        });
      } else if (item.status === "ambiguous" && item.candidates.length > 0) {
        if (fileType === "all") {
          // Khi chọn tất cả (RAW & JPG): lấy mọi định dạng ảnh của mã này
          const seenNames = new Set<string>();
          for (const cand of item.candidates) {
            if (!seenNames.has(cand.name.toLowerCase())) {
              seenNames.add(cand.name.toLowerCase());
              tasksToCopy.push({
                parsed: item.parsed,
                sourceFile: cand,
                resolutionNote: item.candidates.length > 1 ? "Đã lọc cả RAW & JPG" : undefined,
              });
            }
          }
        } else {
          // Ưu tiên theo định dạng đã chọn (raw hoặc standard), hoặc file nông nhất
          const preferred =
            item.candidates.find((c) =>
              fileType === "raw" ? c.category === "raw" : c.category === "standard",
            ) ?? item.candidates[0]!;
          tasksToCopy.push({
            parsed: item.parsed,
            sourceFile: preferred,
            resolutionNote: `Trùng mã: đã lấy ${preferred.name}`,
          });
        }
      } else {
        missingItems.push(item);
      }
    }

    setProgress({
      scanned: availableFiles.length,
      matched: tasksToCopy.length,
      copied: 0,
      missing: missingItems.length,
      errors: 0,
    });

    const executionRows: FilterRow[] = [];
    const usedNames = new Set<string>();

    if (inputHandle && pickerSupported) {
      // Direct local filesystem copy using File System Access API
      try {
        let targetDir: DirectoryHandleLike;
        let actualTargetFolderName: string;

        if (outputHandle) {
          // Ưu tiên 1 (Chuẩn s2.io.vn): Sử dụng thư mục đích riêng đã chọn
          await ensureWritePermission(outputHandle);
          targetDir = outputHandle;
          actualTargetFolderName = outputHandle.name;
        } else if (createSubfolder) {
          // Ưu tiên 2: Tự động tạo thư mục con trong thư mục nguồn
          await ensureWritePermission(inputHandle);
          const folderName = sanitizeFolderName(subfolderName.trim()) || "Ảnh Khách Chọn";
          const res = await getOrCreateDirectoryHandle(inputHandle, folderName);
          targetDir = res.handle;
          actualTargetFolderName = res.finalName;
          await ensureWritePermission(targetDir);
        } else {
          await ensureWritePermission(inputHandle);
          targetDir = inputHandle;
          actualTargetFolderName = inputHandle.name;
        }

        let copiedCount = 0;
        let errorCount = 0;

        for (const task of tasksToCopy) {
          if (abortRef.current) {
            setStatusMessage("Đã dừng quá trình lọc ảnh.");
            break;
          }
          const sourceFile = task.sourceFile;
          try {
            setStatusMessage(`Đang ${filterAction === "move" ? "chuyển" : "chép"} file: ${sourceFile.name}...`);

            const { name: destName, skip } = await resolveDestinationName(
              targetDir,
              usedNames,
              sourceFile.name,
              conflictPolicy,
            );

            if (!skip) {
              // A. LẤY FILE NGUỒN VÀ NẠP THẲNG VÀO BỘ ĐỆM RAM (TRÁNH LỖI NOTFOUNDERROR CỦA CHROMIUM)
              let fileObj: File | null = null;
              try {
                if (sourceFile.relativePath && sourceFile.relativePath !== sourceFile.name) {
                  fileObj = await readFileFromDirectory(inputHandle, sourceFile.relativePath);
                } else {
                  const fh = await inputHandle.getFileHandle(sourceFile.name);
                  fileObj = await fh.getFile();
                }
              } catch {
                if (
                  sourceFile.fileHandle &&
                  typeof (sourceFile.fileHandle as FileHandleLike).getFile === "function"
                ) {
                  try {
                    fileObj = await (sourceFile.fileHandle as FileHandleLike).getFile();
                  } catch {
                    fileObj = null;
                  }
                }
              }

              if (!fileObj) {
                try {
                  fileObj = await readFileFromDirectory(inputHandle, sourceFile.name);
                } catch {
                  fileObj = sourceFile.file ?? null;
                }
              }

              if (!fileObj) {
                throw new Error(`Không tìm thấy file nguồn "${sourceFile.name}".`);
              }

              // Nạp dữ liệu vào RAM -> độc lập 100% với file trên ổ đĩa
              const arrayBuffer = await fileObj.arrayBuffer();
              const memBlob = new Blob([arrayBuffer], {
                type: fileObj.type || "application/octet-stream",
              });

              // B. MỞ THƯ MỤC ĐÍCH TƯƠI MỚI VÀ GHI FILE
              let activeDestDir = targetDir;
              if (!outputHandle) {
                try {
                  activeDestDir = await inputHandle.getDirectoryHandle(
                    sanitizeFolderName(subfolderName.trim()) || "Ảnh Khách Chọn",
                    { create: true },
                  );
                } catch {
                  activeDestDir = targetDir;
                }
              }

              let destFileHandle: FileHandleLike;
              try {
                destFileHandle = await activeDestDir.getFileHandle(destName, { create: true });
              } catch {
                const { stem, extension } = splitFilename(destName);
                destFileHandle = await activeDestDir.getFileHandle(`${stem}_copy${extension}`, { create: true });
              }

              if (!destFileHandle.createWritable) {
                throw new Error("Trình duyệt không hỗ trợ ghi file vào thư mục đích.");
              }
              const writable = await destFileHandle.createWritable({ keepExistingData: false });

              try {
                await writable.write(memBlob);
                await writable.close();

                // Nếu chọn chế độ Chuyển (Move)
                if (filterAction === "move" && inputHandle.removeEntry) {
                  try {
                    await inputHandle.removeEntry(sourceFile.name);
                  } catch {
                    // Không chặn nếu thư mục không cho xoá
                  }
                }

                copiedCount += 1;
                executionRows.push({
                  inputCode: task.parsed.raw,
                  filename: destName,
                  relativePath: sourceFile.relativePath,
                  status: "matched",
                  message: task.resolutionNote || (filterAction === "move" ? "Đã chuyển" : "Đã lọc"),
                });
              } catch (writeErr: unknown) {
                try {
                  if (writable.abort) await writable.abort();
                } catch {
                  // ignore
                }
                throw writeErr;
              }

              // Khoảng nghỉ nhẹ 10ms giữa các file
              await new Promise((resolve) => setTimeout(resolve, 10));
            } else {
              executionRows.push({
                inputCode: task.parsed.raw,
                filename: sourceFile.name,
                relativePath: sourceFile.relativePath,
                status: "skipped",
                message: "Bỏ qua do trùng tên",
              });
            }
          } catch (err: unknown) {
            errorCount += 1;
            executionRows.push({
              inputCode: task.parsed.raw,
              filename: sourceFile.name,
              relativePath: sourceFile.relativePath,
              status: "error",
              message: err instanceof Error ? err.message : "Lỗi ghi file",
            });
          }

          setProgress((prev) => ({
            ...prev,
            copied: copiedCount,
            errors: errorCount,
          }));
        }

        // Add missing entries
        for (const item of missingItems) {
          executionRows.push({
            inputCode: item.parsed.raw,
            filename: "",
            relativePath: "",
            status: item.status,
            message:
              item.status === "ambiguous"
                ? "Tìm thấy nhiều file trùng mã"
                : "Không tìm thấy trong thư mục",
          });
        }

        setRows(executionRows);
        setFilterDone(true);
        setStatusMessage(
          `Hoàn tất! Đã ${filterAction === "move" ? "chuyển" : "chép"} ${copiedCount}/${tasksToCopy.length} file vào thư mục "${actualTargetFolderName}".`,
        );
        toast.success(
          `Đã ${filterAction === "move" ? "chuyển" : "chép"} thành công ${copiedCount} ảnh vào thư mục "${actualTargetFolderName}"!`,
        );

        // Auto-save filter job history to database
        try {
          const res = await savePhotoFilterJobAction({
            albumId: selectedAlbumId || null,
            mode,
            inputCodesText: text,
            parsedCount: parsed.valid.length,
            matchedCount: tasksToCopy.length,
            missingCount: missingItems.length,
            ambiguousCount: matchResult.ambiguousCount,
            duplicateCount: parsed.duplicateCount,
            outputMode: outputHandle ? "separate" : createSubfolder ? "subfolder" : "separate",
            outputFolderName: actualTargetFolderName,
            fileType,
            status: "completed",
            items: executionRows.map((r) => ({
              inputCode: r.inputCode,
              matchedFilename: r.filename,
              status: r.status,
              message: r.message,
            })),
          });
          if (res.ok) {
            setLastJobId(res.jobId);
            onJobSaved?.(res.jobId);
          }
        } catch {
          // Ignore audit logging error
        }
      } catch (err: unknown) {
        toast.error(
          err instanceof Error
            ? err.message
            : "Lỗi trong quá trình ghi file trên máy tính.",
        );
      } finally {
        setIsRunning(false);
      }
    } else {
      // Fallback for browsers without File System Access API: generate ZIP file download
      try {
        setStatusMessage("Đang nén file đã lọc thành file ZIP...");
        const zip = new JSZip();
        const folder = createSubfolder ? zip.folder(subfolderName) || zip : zip;
        let copiedCount = 0;

        for (const task of tasksToCopy) {
          if (abortRef.current) break;
          const source = task.sourceFile;
          let fileData: Blob | File | null = source.file ?? null;
          if (!fileData) {
            const fileInput = folderInputRef.current;
            if (fileInput?.files) {
              for (let i = 0; i < fileInput.files.length; i += 1) {
                const f = fileInput.files[i];
                if (f && (f.webkitRelativePath === source.relativePath || f.name === source.name)) {
                  fileData = f;
                  break;
                }
              }
            }
          }
          if (fileData) {
            folder.file(source.name, fileData);
            copiedCount += 1;
            executionRows.push({
              inputCode: task.parsed.raw,
              filename: source.name,
              relativePath: source.relativePath,
              status: "matched",
              message: task.resolutionNote,
            });
          }
          setProgress((prev) => ({ ...prev, copied: copiedCount }));
        }

        for (const item of missingItems) {
          executionRows.push({
            inputCode: item.parsed.raw,
            filename: "",
            relativePath: "",
            status: item.status,
            message:
              item.status === "ambiguous"
                ? "Tìm thấy nhiều file trùng mã"
                : "Không tìm thấy trong thư mục",
          });
        }

        const zipBlob = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${subfolderName || "Anh_Khach_Chon"}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        setRows(executionRows);
        setFilterDone(true);
        setStatusMessage(`Đã tải xuống file ZIP gồm ${copiedCount} ảnh được lọc!`);
        toast.success(`Đã xuất ${copiedCount} file vào file ZIP!`);
      } catch {
        toast.error("Không thể tạo file ZIP cho các ảnh đã lọc.");
      } finally {
        setIsRunning(false);
      }
    }
  };

  const handleCancelFiltering = () => {
    abortRef.current = true;
    setIsRunning(false);
    toast.info("Đã yêu cầu dừng quá trình lọc.");
  };

  // Export Manifest & Missing
  const handleDownloadCsv = () => {
    const csv = buildManifestCsv(
      rows.map((r) => ({
        inputCode: r.inputCode,
        filename: r.filename,
        relativePath: r.relativePath,
        status: r.status as MatchStatus,
        message: r.message,
      })),
    );
    downloadText(`manifest-loc-anh-${new Date().toISOString().slice(0, 10)}.csv`, csv);
    toast.success("Đã tải xuống báo cáo Manifest CSV.");
  };

  const handleCopyMissing = async () => {
    const missing = rows.filter((r) => r.status === "missing" || r.status === "ambiguous");
    if (missing.length === 0) {
      toast.info("Không có ảnh thiếu nào.");
      return;
    }
    const missingText = missing.map((r) => r.inputCode).join("\n");
    const ok = await copyToClipboard(missingText);
    if (ok) {
      toast.success(`Đã sao chép ${missing.length} mã ảnh thiếu vào Clipboard!`);
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Header matching media_1794239274827_a35b6fc7.jpg */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/manage/photos"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-surface text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="Quay lại danh sách album"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
            <FolderArchive className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground md:text-2xl">
              Phần Mềm Lọc Ảnh
            </h1>
            <p className="text-xs text-muted-foreground md:text-sm">
              Chọn album để tự động lấy mã và lọc file gốc trên máy tính.
            </p>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setIsNotesModalOpen(true)}
          className="rounded-xl border-border bg-surface hover:bg-muted text-xs sm:text-sm font-medium shadow-2xs gap-2 self-start sm:self-auto"
        >
          <FileText className="h-4 w-4 text-amber-500" />
          <span>Xem Ghi Chú & Mã Ảnh</span>
        </Button>
      </div>

      {/* Free Tier Limit Banner matching media_1794239274827_a35b6fc7.jpg */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-blue-200/70 bg-gradient-to-r from-blue-50/80 via-sky-50/50 to-indigo-50/60 p-4 md:p-5 dark:border-blue-900/50 dark:from-blue-950/30 dark:via-sky-950/20 dark:to-indigo-950/30">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-500/15 text-blue-600 dark:text-blue-400">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-foreground md:text-sm">
                Hạn Mức Lọc Ảnh PC (Gói Miễn Phí):
              </span>
              <span className="inline-flex items-center rounded-full bg-blue-100/90 px-2.5 py-0.5 text-xs font-bold text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                0 / 5 album đã dùng
              </span>
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                (Còn lại 5 lượt)
              </span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground md:text-xs">
              Áp dụng tự do khi lọc từ album khách hoặc dán mã bất kỳ. Tự động hồi 5 lượt vào 00:00 ngày 01/12/2026.
            </p>
          </div>
        </div>

        <Button
          type="button"
          size="sm"
          onClick={() => setIsUpgradeModalOpen(true)}
          className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 shrink-0 self-start sm:self-auto gap-1"
        >
          <span>Nâng Cấp Lọc Không Giới Hạn</span>
          <span>→</span>
        </Button>
      </div>

      {/* Main 2-Column Grid matching media_1794239274827_a35b6fc7.jpg */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 items-start">
        {/* Card 1: Mã Ảnh Khách Chọn Để Lọc */}
        <div className="rounded-2xl border border-border bg-surface p-5 md:p-6 shadow-2xs space-y-4">
          {/* Card 1 Header */}
          <div className="flex items-center justify-between pb-1 border-b border-border/50">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[11px] font-bold text-white">
                1
              </span>
              <h2 className="text-sm font-bold text-foreground md:text-base">
                Mã Ảnh Khách Chọn Để Lọc
              </h2>
            </div>
            <Badge tone={parsed.valid.length > 0 ? "success" : "neutral"} className="text-xs font-medium">
              {parsed.valid.length} mã hợp lệ
            </Badge>
          </div>

          {/* Combobox Chọn Nguồn Khách Hàng / Album / Hợp Đồng */}
          <div className="space-y-1.5 relative">
            <Label className="text-xs font-semibold text-foreground">
              Chọn Nguồn Khách Hàng / Album / Hợp Đồng:
            </Label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex w-full items-center justify-between rounded-xl border border-border/90 bg-background px-3.5 py-2.5 text-left text-xs transition-colors hover:border-blue-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
              >
                <div className="flex items-center gap-2 truncate text-muted-foreground">
                  <Search className="h-3.5 w-3.5 shrink-0" />
                  <span className={currentAlbumTitle ? "font-medium text-foreground truncate" : "truncate"}>
                    {isLoadingAlbum
                      ? "Đang nạp mã album..."
                      : currentAlbumTitle
                        ? `${currentAlbumTitle} (Đang chọn)`
                        : "Gõ tìm mã HĐ, tên album, tên khách để lấy mã..."}
                  </span>
                </div>
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>

              {/* Combobox Dropdown Popover */}
              {isDropdownOpen && (
                <div className="absolute top-full left-0 right-0 z-30 mt-1 max-h-64 overflow-y-auto rounded-xl border border-border bg-surface p-1.5 shadow-xl">
                  <div className="p-1 pb-1.5">
                    <Input
                      type="text"
                      placeholder="Tìm kiếm album, tên khách, số điện thoại..."
                      value={albumSearchText}
                      onChange={(e) => setAlbumSearchText(e.target.value)}
                      className="h-8 text-xs"
                      autoFocus
                    />
                  </div>
                  <div className="divide-y divide-border/40 text-xs">
                    {filteredAlbums.length === 0 ? (
                      <div className="py-3 text-center text-muted-foreground text-xs">
                        Không tìm thấy album nào phù hợp
                      </div>
                    ) : (
                      filteredAlbums.map((album) => (
                        <button
                          key={album.id}
                          type="button"
                          onClick={() => void handleSelectAlbum(album)}
                          className={`flex w-full items-center justify-between px-3 py-2 text-left rounded-lg transition-colors hover:bg-muted ${
                            selectedAlbumId === album.id ? "bg-blue-50 font-semibold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300" : ""
                          }`}
                        >
                          <div className="truncate">
                            <p className="truncate font-medium">{album.title}</p>
                            <p className="text-[11px] text-muted-foreground truncate">
                              {album.customerName ? `Khách: ${album.customerName}` : ""}
                              {album.orderCode ? ` · Đơn: ${album.orderCode}` : ""}
                            </p>
                          </div>
                          {selectedAlbumId === album.id && (
                            <Check className="h-3.5 w-3.5 text-blue-600 shrink-0 ml-2" />
                          )}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Mode Switcher: Chế độ lựa chọn */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-foreground">Chế độ lựa chọn:</span>
              <div className="inline-flex rounded-xl bg-muted/60 p-0.5 border border-border/60">
                <button
                  type="button"
                  onClick={() => setMode("alphanumeric")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    mode === "alphanumeric"
                      ? "bg-blue-600 text-white shadow-2xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <FileText className="h-3.5 w-3.5" />
                  Chữ và số
                </button>
                <button
                  type="button"
                  onClick={() => setMode("numeric")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    mode === "numeric"
                      ? "bg-blue-600 text-white shadow-2xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <span>🔢</span>
                  Chỉ lấy số
                </button>
              </div>
            </div>
            <span className="text-[11px] text-muted-foreground">
              Tự động nhận diện với file gốc
            </span>
          </div>

          {/* 4 instant 1-touch copy buttons */}
          <div className="space-y-1.5 pt-1">
            <Label className="text-xs font-semibold text-foreground">
              4 định dạng sao chép tức thì (1 chạm):
            </Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <button
                type="button"
                onClick={() => void handleCopyNewline()}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-border/80 bg-background px-2.5 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted hover:border-blue-400"
              >
                <Copy className="h-3 w-3 text-muted-foreground" />
                <span>Xuống dòng</span>
              </button>
              <button
                type="button"
                onClick={() => void handleCopyComma()}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-border/80 bg-background px-2.5 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted hover:border-blue-400"
              >
                <Copy className="h-3 w-3 text-muted-foreground" />
                <span>Dấu phẩy</span>
              </button>
              <button
                type="button"
                onClick={() => void handleCopySpace()}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-border/80 bg-background px-2.5 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted hover:border-blue-400"
              >
                <Copy className="h-3 w-3 text-muted-foreground" />
                <span>Dấu cách</span>
              </button>
              <button
                type="button"
                onClick={() => void handleCopyWithExtension()}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-border/80 bg-background px-2.5 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted hover:border-blue-400"
              >
                <Copy className="h-3 w-3 text-muted-foreground" />
                <span>Có đuôi file</span>
              </button>
            </div>
          </div>

          {/* Large Monospace Textarea */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground">
              Danh Sách Mã Cần Lọc:
            </Label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={9}
              placeholder="Dán mã vào đây hoặc chọn Album ở trên (hỗ trợ mọi định dạng: Excel, Zalo, xuống dòng, dấu phẩy, dấu cách, có/không đuôi .jpg, .cr3, số thứ tự...)"
              className="w-full rounded-xl border border-border/80 bg-background p-3.5 font-mono text-xs leading-relaxed text-foreground placeholder:text-muted-foreground focus:border-blue-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {/* Footer note */}
          <p className="text-[11px] text-muted-foreground italic flex items-start gap-1.5">
            <span>💡</span>
            <span>
              Hệ thống tự động so khớp thông minh bất kể bạn dán mã dạng chữ+số hay chỉ số, có hay không đuôi file.
            </span>
          </p>
        </div>

        {/* Card 2: Cấu Hình Thư Mục Trên Máy Tính */}
        <div className="rounded-2xl border border-border bg-surface p-5 md:p-6 shadow-2xs space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            {/* Card 2 Header */}
            <div className="flex items-center justify-between pb-1 border-b border-border/50">
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-[11px] font-bold text-white">
                  2
                </span>
                <h2 className="text-sm font-bold text-foreground md:text-base">
                  Cấu Hình Thư Mục Trên Máy Tính
                </h2>
              </div>
            </div>

            {/* Hidden fallback file input for Safari or non-Chromium */}
            <input
              ref={folderInputRef}
              type="file"
              // @ts-expect-error webkitdirectory is standard in HTML5 for folder selection
              webkitdirectory=""
              directory=""
              multiple
              onChange={handleFallbackFolderChange}
              className="hidden"
            />

            {/* Box: THƯ MỤC ẢNH VÀ ĐÍCH ĐẾN (1-CLICK TỰ ĐỘNG) */}
            <div className="rounded-xl border border-border/80 bg-muted/20 p-4 space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase flex items-center gap-1.5">
                  <span>THƯ MỤC ẢNH TRÊN MÁY TÍNH</span>
                </div>
                {inputFolderName && (
                  <Badge tone="info" className="text-[10px]">
                    {scannedFiles.length} file ảnh
                  </Badge>
                )}
              </div>

              {/* Nút chọn thư mục duy nhất */}
              <div className="space-y-2">
                <Button
                  type="button"
                  size="default"
                  onClick={() => void chooseInputDirectory()}
                  className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs md:text-sm font-semibold px-4 py-2.5 gap-2 shadow-2xs w-full sm:w-auto"
                >
                  <FolderOpen className="h-4 w-4" />
                  <span>{inputFolderName ? "Đổi thư mục ảnh khác" : "Chọn thư mục ảnh từ máy tính"}</span>
                </Button>

                <p className="text-xs text-muted-foreground truncate">
                  {isScanning ? (
                    <span className="text-blue-600 dark:text-blue-400 font-medium animate-pulse">
                      {statusMessage || "Đang quét ảnh..."}
                    </span>
                  ) : inputFolderName ? (
                    <span className="font-medium text-foreground">
                      📁 Thư mục đang chọn: <span className="text-blue-600 dark:text-blue-400 font-semibold">{inputFolderName}</span> ({scannedFiles.length} file)
                    </span>
                  ) : (
                    "Chưa chọn thư mục nào. Bấm nút trên để chọn thư mục ảnh chụp từ thẻ nhớ hoặc ổ cứng."
                  )}
                </p>
              </div>

              {/* Tự động 1-click tạo folder và gom ảnh */}
              <div className="pt-2.5 border-t border-border/50 space-y-1.5 text-xs">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                  <span className="text-muted-foreground">Tự động tạo folder và lưu vào:</span>
                  <span className="font-semibold text-foreground bg-background px-2.5 py-0.5 rounded-md border border-border/80 font-mono text-[11px] text-emerald-700 dark:text-emerald-400">
                    📁 {subfolderName || "Ảnh Khách Chọn"}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  (Hệ thống tự động tạo folder này bên trong thư mục ảnh, không cần bạn phải tạo hay trỏ tay)
                </p>
              </div>
            </div>

            {/* Box 3: Định dạng file cần lọc */}
            <div className="space-y-1.5 pt-1">
              <Label className="text-xs font-semibold text-foreground">
                Định dạng file cần lọc:
              </Label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setFileType("all")}
                  className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                    fileType === "all"
                      ? "bg-blue-600 text-white shadow-2xs"
                      : "border border-border bg-background text-foreground hover:bg-muted"
                  }`}
                >
                  Tất cả (RAW & JPG)
                </button>
                <button
                  type="button"
                  onClick={() => setFileType("raw")}
                  className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                    fileType === "raw"
                      ? "bg-blue-600 text-white shadow-2xs"
                      : "border border-border bg-background text-foreground hover:bg-muted"
                  }`}
                >
                  Chỉ lấy RAW
                </button>
                <button
                  type="button"
                  onClick={() => setFileType("standard")}
                  className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                    fileType === "standard"
                      ? "bg-blue-600 text-white shadow-2xs"
                      : "border border-border bg-background text-foreground hover:bg-muted"
                  }`}
                >
                  Chỉ lấy JPG/PNG
                </button>
              </div>
            </div>
          </div>

          {/* Main Big CTA Button */}
          <div className="pt-4">
            {isRunning ? (
              <div className="space-y-2">
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-blue-600 transition-all duration-300"
                    style={{
                      width: `${
                        progress.matched > 0
                          ? Math.round((progress.copied / progress.matched) * 100)
                          : 0
                      }%`,
                    }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{statusMessage}</span>
                  <span>
                    {progress.copied} / {progress.matched} file
                  </span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancelFiltering}
                  className="w-full text-xs font-semibold text-red-600 hover:bg-red-50"
                >
                  Dừng lọc ảnh
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                onClick={() => void handleStartFiltering()}
                disabled={parsed.valid.length === 0}
                className="w-full rounded-xl py-3.5 md:py-4 text-sm md:text-base font-bold text-white shadow-md bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 dark:disabled:bg-slate-800 dark:disabled:text-slate-600 gap-2 cursor-pointer transition-all"
              >
                <Play className="h-4 w-4 fill-current" />
                <span>BẮT ĐẦU LỌC ẢNH VÀO FOLDER "ẢNH KHÁCH CHỌN"</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Results View when filtering finishes */}
      {filterDone && rows.length > 0 && (
        <div className="rounded-2xl border border-border bg-surface p-5 md:p-6 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              <h3 className="text-base font-bold text-foreground">
                Kết Quả Lọc Ảnh ({progress.copied} / {parsed.valid.length} file)
              </h3>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDownloadCsv}
                className="text-xs font-medium gap-1.5 rounded-lg"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Tải Báo Cáo CSV</span>
              </Button>
              {progress.missing > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void handleCopyMissing()}
                  className="text-xs font-medium gap-1.5 rounded-lg text-amber-600 hover:bg-amber-50"
                >
                  <Copy className="h-3.5 w-3.5" />
                  <span>Copy {progress.missing} Ảnh Thiếu</span>
                </Button>
              )}
            </div>
          </div>

          <div className="max-h-60 overflow-y-auto rounded-xl border border-border divide-y divide-border text-xs">
            {rows.map((row, idx) => (
              <div key={idx} className="flex items-center justify-between p-2.5 hover:bg-muted/30">
                <div className="flex items-center gap-2 truncate">
                  <span className="font-mono font-semibold">{row.inputCode}</span>
                  {row.filename && <span className="text-muted-foreground truncate">→ {row.filename}</span>}
                  {row.message && (
                    <span className="text-[11px] text-amber-600 dark:text-amber-400 shrink-0">
                      ({row.message})
                    </span>
                  )}
                </div>
                <div>
                  {row.status === "matched" ? (
                    <Badge tone="success">Đã lọc</Badge>
                  ) : row.status === "missing" ? (
                    <Badge tone="warning">Không tìm thấy</Badge>
                  ) : row.status === "ambiguous" ? (
                    <Badge tone="warning">Trùng mã</Badge>
                  ) : (
                    <Badge tone="neutral">{row.status}</Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal: Xem Ghi Chú & Mã Ảnh */}
      <Dialog open={isNotesModalOpen} onOpenChange={setIsNotesModalOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <FileText className="h-5 w-5 text-amber-500" />
              <span>Ghi Chú & Mã Ảnh Khách Chọn</span>
            </DialogTitle>
            <DialogDescription>
              Album: {currentAlbumTitle || "Chưa chọn album"} · {currentSelectedCodes.length} ảnh khách đã chọn
            </DialogDescription>
          </DialogHeader>

          {/* Quick Copy in Modal */}
          <div className="flex flex-wrap items-center gap-2 py-2 border-y border-border/60">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={async () => {
                if (currentSelectedCodes.length === 0) return;
                const codes = currentSelectedCodes.map((c) => c.code).join("\n");
                await copyToClipboard(codes);
                toast.success(`Đã copy ${currentSelectedCodes.length} mã ảnh!`);
              }}
              className="text-xs gap-1.5"
            >
              <Copy className="h-3.5 w-3.5" />
              <span>Copy toàn bộ mã</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={async () => {
                const notes = currentSelectedCodes
                  .filter((c) => c.note && c.note.trim())
                  .map((c) => `${c.code}: ${c.note?.trim()}`)
                  .join("\n");
                if (!notes) {
                  toast.info("Album này chưa có ghi chú nào.");
                  return;
                }
                await copyToClipboard(notes);
                toast.success("Đã copy toàn bộ ghi chú của khách!");
              }}
              className="text-xs gap-1.5"
            >
              <Copy className="h-3.5 w-3.5" />
              <span>Copy toàn bộ ghi chú</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const lines = currentSelectedCodes.map((c) =>
                  c.note?.trim() ? `${c.code}\t${c.note.trim()}` : c.code,
                );
                downloadText(
                  `ghi-chu-album-${sanitizeFolderName(currentAlbumTitle || "album")}.txt`,
                  lines.join("\n"),
                );
                toast.success("Đã tải file TXT ghi chú.");
              }}
              className="text-xs gap-1.5"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Tải file TXT</span>
            </Button>
          </div>

          {/* Notes & Photos List */}
          <div className="flex-1 overflow-y-auto max-h-[50vh] space-y-3 py-2 pr-1">
            {currentSelectedCodes.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-sm">
                Chưa có ảnh nào được khách chọn trong album này.
              </div>
            ) : (
              currentSelectedCodes.map((item, index) => (
                <div
                  key={index}
                  className="flex items-start gap-3 rounded-xl border border-border/70 p-3 bg-muted/15"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-surface border border-border text-muted-foreground overflow-hidden">
                    {item.thumbnailKey ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={
                          item.thumbnailKey.startsWith("http://") ||
                          item.thumbnailKey.startsWith("https://")
                            ? item.thumbnailKey
                            : `/api/files/${encodeURIComponent(item.thumbnailKey)}`
                        }
                        alt={item.code}
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          // Fallback to icon
                          (e.target as HTMLElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <span className="text-[10px] font-mono font-bold">IMG</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-foreground">
                        {item.code}
                      </span>
                      <span className="text-[11px] text-muted-foreground truncate">
                        {item.filename}
                      </span>
                    </div>
                    {item.note && item.note.trim() ? (
                      <div className="mt-1.5 rounded-lg bg-amber-500/10 p-2 text-xs text-amber-900 dark:text-amber-200 border border-amber-500/20">
                        <span className="font-semibold">Ghi chú sửa:</span> {item.note.trim()}
                      </div>
                    ) : (
                      <p className="mt-1 text-[11px] text-muted-foreground italic">
                        Không có ghi chú thêm
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsNotesModalOpen(false)}
            >
              Đóng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Upgrade to Pro */}
      <Dialog open={isUpgradeModalOpen} onOpenChange={setIsUpgradeModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="h-5 w-5 text-blue-600" />
              <span>Nâng Cấp StudioCore Pro</span>
            </DialogTitle>
            <DialogDescription>
              Lọc file RAW và ảnh gốc trên PC không giới hạn số lượng và dung lượng.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs text-foreground">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>Lọc không giới hạn lượt album mỗi tháng.</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>Hỗ trợ mọi định dạng file RAW (CR2, CR3, ARW, NEF, RAF, DNG).</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>Tốc độ quét đa luồng siêu tốc trực tiếp trên máy tính.</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>Đồng bộ 2 chiều với StudioCore Drive và hợp đồng khách hàng.</span>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsUpgradeModalOpen(false)}
            >
              Để sau
            </Button>
            <Button
              type="button"
              className="bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => {
                setIsUpgradeModalOpen(false);
                toast.success("Vui lòng liên hệ Hotline 0976 181 859 để kích hoạt gói Pro!");
              }}
            >
              Liên hệ kích hoạt ngay
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
