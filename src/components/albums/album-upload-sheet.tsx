"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FolderUp, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

type UploadResult = {
  added: number;
  skipped: { filename: string; reason: string }[];
};

export function AlbumUploadSheet({
  albumId,
  maxUploadMb,
}: {
  albumId: string;
  maxUploadMb: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handlePhotosUpload = async () => {
    if (files.length === 0) {
      setError("Chưa chọn ảnh để tải lên.");
      return;
    }
    setUploading(true);
    setError(null);
    setResult(null);
    try {
      const formData = new FormData();
      formData.set("albumId", albumId);
      for (const file of files) {
        formData.append("files", file);
        const withPath = file as File & { webkitRelativePath?: string };
        formData.append(
          "relativePaths",
          withPath.webkitRelativePath || file.name,
        );
      }
      const response = await fetch("/api/uploads/photos", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as UploadResult & { error?: string };
      if (!response.ok) {
        setError(payload.error ?? "Không thể tải ảnh lên.");
        return;
      }
      setResult(payload);
      setFiles([]);
      toast.success(`Đã thêm ${payload.added} ảnh vào album.`);
      router.refresh();
    } catch {
      setError("Không thể tải ảnh lên. Kiểm tra kết nối và thử lại.");
    } finally {
      setUploading(false);
    }
  };

  const handleZipUpload = async () => {
    if (!zipFile) {
      setError("Chưa chọn file ZIP.");
      return;
    }
    setUploading(true);
    setError(null);
    setResult(null);
    try {
      const formData = new FormData();
      formData.set("albumId", albumId);
      formData.set("zip", zipFile);
      const response = await fetch("/api/uploads/zip", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as UploadResult & { error?: string };
      if (!response.ok) {
        setError(payload.error ?? "Không thể giải nén ZIP.");
        return;
      }
      setResult(payload);
      setZipFile(null);
      toast.success(`Đã thêm ${payload.added} ảnh từ ZIP.`);
      router.refresh();
    } catch {
      setError("Không thể tải ZIP. Kiểm tra file và thử lại.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          <Upload className="h-4 w-4" aria-hidden />
          Tải ảnh lên
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Tải ảnh lên album</SheetTitle>
          <SheetDescription>
            Hỗ trợ JPEG, PNG, WebP tối đa {maxUploadMb}MB/ảnh. Hệ thống tạo
            thumbnail và bản preview có watermark phía server.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5">
          {error ? <Alert tone="danger">{error}</Alert> : null}
          {result ? (
            <Alert tone={result.added > 0 ? "success" : "warning"}>
              Đã thêm {result.added} ảnh.
              {result.skipped.length > 0 ? (
                <span className="mt-1 block text-xs">
                  Bỏ qua {result.skipped.length} file:{" "}
                  {result.skipped
                    .slice(0, 5)
                    .map((item) => `${item.filename} (${item.reason})`)
                    .join("; ")}
                  {result.skipped.length > 5 ? "..." : ""}
                </span>
              ) : null}
            </Alert>
          ) : null}

          <div className="rounded-lg border border-border p-3">
            <Label htmlFor="album-upload-files">Chọn nhiều ảnh</Label>
            <Input
              id="album-upload-files"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="mt-1.5"
              onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              {files.length > 0 ? `Đã chọn ${files.length} ảnh.` : "Chưa chọn ảnh."}
            </p>
            <Button
              className="mt-3"
              size="sm"
              onClick={() => void handlePhotosUpload()}
              disabled={uploading || files.length === 0}
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Upload className="h-4 w-4" aria-hidden />
              )}
              Tải {files.length > 0 ? `${files.length} ảnh` : "ảnh"} lên
            </Button>
          </div>

          <div className="rounded-lg border border-border p-3">
            <Label htmlFor="album-upload-folder">Chọn cả thư mục</Label>
            <Input
              id="album-upload-folder"
              type="file"
              multiple
              className="mt-1.5"
              ref={(element) => {
                if (element) {
                  element.setAttribute("webkitdirectory", "");
                  element.setAttribute("directory", "");
                }
              }}
              onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Trình duyệt sẽ hỏi quyền đọc thư mục. Chỉ các file ảnh được gửi lên
              server; đường dẫn tuyệt đối trên máy không được gửi.
            </p>
            <Button
              className="mt-3"
              size="sm"
              variant="outline"
              onClick={() => void handlePhotosUpload()}
              disabled={uploading || files.length === 0}
            >
              <FolderUp className="h-4 w-4" aria-hidden />
              Tải thư mục đã chọn
            </Button>
          </div>

          <div className="rounded-lg border border-border p-3">
            <Label htmlFor="album-upload-zip">Hoặc tải file ZIP</Label>
            <Input
              id="album-upload-zip"
              type="file"
              accept=".zip,application/zip"
              className="mt-1.5"
              onChange={(event) => setZipFile(event.target.files?.[0] ?? null)}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Tối đa 200 file mỗi ZIP; file không phải ảnh sẽ bị bỏ qua và báo lại.
            </p>
            <Button
              className="mt-3"
              size="sm"
              variant="outline"
              onClick={() => void handleZipUpload()}
              disabled={uploading || !zipFile}
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Upload className="h-4 w-4" aria-hidden />
              )}
              Giải nén & tải lên
            </Button>
          </div>

          <div className="rounded-lg bg-surface-muted p-3 text-xs text-muted-foreground">
            Ảnh RAW chưa được xử lý trong môi trường demo. Ảnh gốc tải lên được
            lưu riêng; PhotoShare chỉ hiển thị bản preview có watermark.
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
