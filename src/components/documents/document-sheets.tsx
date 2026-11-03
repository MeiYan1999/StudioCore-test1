"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Link2, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/shared/submit-button";
import { initialActionState } from "@/lib/actions/action-state";
import { createLinkDocumentAction } from "@/lib/actions/operations-actions";
import {
  DOCUMENT_CATEGORIES,
  DOCUMENT_CATEGORY_LABELS,
  DOCUMENT_VISIBILITIES,
  DOCUMENT_VISIBILITY_LABELS,
} from "@/lib/documents/constants";

type BranchOption = { id: string; name: string };

export function DocumentLinkSheet({
  branches,
  defaultBranchId,
}: {
  branches: BranchOption[];
  defaultBranchId: string;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [state, formAction] = useActionState(
    async (previousState: typeof initialActionState, formData: FormData) => {
      const result = await createLinkDocumentAction(previousState, formData);
      if (result.status === "success") {
        toast.success(result.message ?? "Đã thêm tài liệu.");
        setOpen(false);
        router.refresh();
      }
      return result;
    },
    initialActionState,
  );
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          <Link2 className="h-4 w-4" aria-hidden />
          Thêm link
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Thêm tài liệu liên kết</SheetTitle>
          <SheetDescription>
            Link HTTPS hoặc đường dẫn nội bộ; version tăng nếu cùng tên/danh mục.
          </SheetDescription>
        </SheetHeader>
        <form action={formAction} className="space-y-4">
          {state.status === "error" ? <Alert tone="danger">{state.message}</Alert> : null}
          <div>
            <Label htmlFor="doc-name">Tên tài liệu</Label>
            <Input id="doc-name" name="name" required className="mt-1.5" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="doc-category">Danh mục</Label>
              <Select id="doc-category" name="category" defaultValue="other" className="mt-1.5">
                {DOCUMENT_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {DOCUMENT_CATEGORY_LABELS[category]}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="doc-visibility">Phạm vi</Label>
              <Select id="doc-visibility" name="visibility" defaultValue="internal" className="mt-1.5">
                {DOCUMENT_VISIBILITIES.map((visibility) => (
                  <option key={visibility} value={visibility}>
                    {DOCUMENT_VISIBILITY_LABELS[visibility]}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="doc-branch">Chi nhánh</Label>
            <Select id="doc-branch" name="branchId" defaultValue={defaultBranchId} className="mt-1.5">
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="doc-url">Link</Label>
            <Input id="doc-url" name="url" placeholder="https://... hoặc /manage/..." required className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="doc-notes">Ghi chú</Label>
            <Textarea id="doc-notes" name="notes" rows={2} className="mt-1.5" />
          </div>
          <div className="flex justify-end">
            <SubmitButton pendingLabel="Đang lưu...">Thêm tài liệu</SubmitButton>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

export function DocumentUploadSheet({
  branches,
  defaultBranchId,
}: {
  branches: BranchOption[];
  defaultBranchId: string;
}) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const upload = async (formData: FormData) => {
    if (!file) {
      setError("Chưa chọn file.");
      return;
    }
    setBusy(true);
    setError(null);
    formData.set("file", file);
    try {
      const response = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? "Không tải được tài liệu.");
        return;
      }
      toast.success("Đã tải tài liệu.");
      setOpen(false);
      setFile(null);
      router.refresh();
    } catch {
      setError("Không tải được tài liệu.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="sm">
          <Upload className="h-4 w-4" aria-hidden />
          Tải file
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Tải tài liệu</SheetTitle>
          <SheetDescription>
            File lưu ngoài public, tải qua route kiểm tra quyền; tối đa 20MB.
          </SheetDescription>
        </SheetHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void upload(new FormData(event.currentTarget));
          }}
        >
          {error ? <Alert tone="danger">{error}</Alert> : null}
          <div>
            <Label htmlFor="upload-doc-name">Tên tài liệu</Label>
            <Input id="upload-doc-name" name="name" required className="mt-1.5" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="upload-doc-category">Danh mục</Label>
              <Select id="upload-doc-category" name="category" defaultValue="other" className="mt-1.5">
                {DOCUMENT_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {DOCUMENT_CATEGORY_LABELS[category]}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="upload-doc-visibility">Phạm vi</Label>
              <Select id="upload-doc-visibility" name="visibility" defaultValue="internal" className="mt-1.5">
                {DOCUMENT_VISIBILITIES.map((visibility) => (
                  <option key={visibility} value={visibility}>
                    {DOCUMENT_VISIBILITY_LABELS[visibility]}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="upload-doc-branch">Chi nhánh</Label>
            <Select id="upload-doc-branch" name="branchId" defaultValue={defaultBranchId} className="mt-1.5">
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="upload-doc-file">File</Label>
            <Input
              id="upload-doc-file"
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.png,.jpg,.jpeg,.webp"
              className="mt-1.5"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </div>
          <div>
            <Label htmlFor="upload-doc-notes">Ghi chú</Label>
            <Textarea id="upload-doc-notes" name="notes" rows={2} className="mt-1.5" />
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              Tải tài liệu
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
