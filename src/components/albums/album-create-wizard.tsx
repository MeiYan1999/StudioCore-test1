"use client";

import { useActionState, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FolderSearch,
  Link2,
  Loader2,
  Upload,
} from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/shared/submit-button";
import { initialActionState } from "@/lib/actions/action-state";
import {
  createAlbumAction,
  previewAlbumSourceAction,
} from "@/lib/actions/album-actions";
import { QUOTA_OPTIONS, type AlbumSourceType } from "@/lib/albums/constants";
import type { AlbumSourcePreview } from "@/lib/services/album-service";
import { cn, formatVnd } from "@/lib/utils";

type BranchOption = { id: string; name: string };
type CustomerOption = { id: string; name: string; phone: string };
type OrderOption = {
  id: string;
  code: string;
  status: string;
  customerId: string;
  branchId: string;
};

const SOURCE_TABS: { key: AlbumSourceType; label: string; icon: typeof Link2 }[] = [
  { key: "drive", label: "Thư mục Drive / NAS", icon: Link2 },
  { key: "multi_link", label: "Dán nhiều link", icon: FolderSearch },
  { key: "upload", label: "Tải thư mục/ZIP", icon: Upload },
];

export function AlbumCreateWizard({
  branches,
  customers,
  orders,
  defaultBranchId,
}: {
  branches: BranchOption[];
  customers: CustomerOption[];
  orders: OrderOption[];
  defaultBranchId: string;
}) {
  const [state, formAction] = useActionState(createAlbumAction, initialActionState);
  const [step, setStep] = useState(1);
  const [sourceType, setSourceType] = useState<AlbumSourceType>("drive");
  const [sourceUrl, setSourceUrl] = useState(
    "https://drive.google.com/drive/folders/demo-folder-1",
  );
  const [sourceUrls, setSourceUrls] = useState("");
  const [albumTitle, setAlbumTitle] = useState(
    state.values?.title ?? "Album Cưới Demo",
  );
  const [branchId, setBranchId] = useState(defaultBranchId);
  const [customerId, setCustomerId] = useState("");
  const [orderId, setOrderId] = useState("");
  const [selectionLimit, setSelectionLimit] = useState(10);
  const [extraPhotoEnabled, setExtraPhotoEnabled] = useState(false);
  const [extraPhotoPrice, setExtraPhotoPrice] = useState("150000");
  const [scanning, setScanning] = useState(false);
  const [preview, setPreview] = useState<AlbumSourcePreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const filteredOrders = useMemo(
    () =>
      orders.filter(
        (order) =>
          (!customerId || order.customerId === customerId) &&
          (!branchId || order.branchId === branchId),
      ),
    [branchId, customerId, orders],
  );

  const handleScan = async () => {
    setScanning(true);
    setPreviewError(null);
    const result = await previewAlbumSourceAction({
      sourceType,
      sourceUrl,
      sourceUrls,
    });
    setScanning(false);
    if (!result.ok) {
      setPreview(null);
      setPreviewError(result.error);
      return;
    }
    setPreview(result.data);
    if (result.data.folders.length > 0) {
      const first = result.data.folders[0]?.name;
      if (first && first !== "Google Drive" && (!albumTitle || albumTitle === "Album Cưới Demo")) {
        setAlbumTitle(first);
      }
    }
  };

  const goNext = () => {
    if (step === 1) {
      if (sourceType !== "upload" && !preview) {
        setPreviewError("Bấm “Quét ảnh” và kiểm tra nguồn trước khi tiếp tục.");
        return;
      }
      setPreviewError(null);
      setStep(2);
      return;
    }
    if (step === 2) {
      if (!albumTitle.trim()) {
        setPreviewError("Nhập tiêu đề album trước khi tiếp tục.");
        return;
      }
      if (!branchId) {
        setPreviewError("Chọn chi nhánh cho album.");
        return;
      }
      setPreviewError(null);
      setStep(3);
    }
  };

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="sourceType" value={sourceType} />
      <input type="hidden" name="branchId" value={branchId} />
      <input type="hidden" name="customerId" value={customerId} />
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="selectionLimit" value={selectionLimit} />
      <input type="hidden" name="sourceUrl" value={sourceUrl} />
      <input type="hidden" name="sourceUrls" value={sourceUrls} />
      <input
        type="hidden"
        name="extraPhotoEnabled"
        value={extraPhotoEnabled ? "on" : "off"}
      />
      <input type="hidden" name="allowFavorites" value="on" />
      <input type="hidden" name="allowNotes" value="on" />
      <input type="hidden" name="allowDownloads" value="on" />

      <ol className="flex flex-wrap items-center gap-2 text-sm">
        {[
          { number: 1, label: "Nguồn ảnh" },
          { number: 2, label: "Thông tin album" },
          { number: 3, label: "Quota & chia sẻ" },
        ].map((item, index) => (
          <li key={item.number} className="flex items-center gap-2">
            <span
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold",
                step === item.number
                  ? "bg-primary text-primary-foreground"
                  : step > item.number
                    ? "bg-emerald-100 text-[var(--success)]"
                    : "bg-surface-muted text-muted-foreground",
              )}
            >
              {step > item.number ? <CheckCircle2 className="h-4 w-4" aria-hidden /> : item.number}
            </span>
            <span className={cn(step === item.number ? "font-medium text-foreground" : "text-muted-foreground")}>
              {item.label}
            </span>
            {index < 2 ? <span className="mx-1 h-px w-6 bg-border" aria-hidden /> : null}
          </li>
        ))}
      </ol>

      <div className={cn("rounded-xl border border-border bg-surface p-4 sm:p-5", step !== 1 && "hidden")}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-foreground">Nguồn ảnh</h2>
          <span className="text-xs text-muted-foreground">
            ⚡ Hoạt động mượt mà với thư mục chứa tới 2000 ảnh
          </span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Hỗ trợ link Google Drive từ <strong>bất kỳ tài khoản nào</strong> (nhiếp ảnh, freelancer, khách hàng...). Chỉ cần thư mục được bật quyền <em>&ldquo;Bất kỳ ai có đường liên kết đều có thể xem&rdquo;</em> (chuẩn giống s2.io.vn).
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {SOURCE_TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => {
                  setSourceType(tab.key);
                  setPreview(null);
                  setPreviewError(null);
                }}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium",
                  sourceType === tab.key
                    ? "border-primary bg-accent text-accent-foreground"
                    : "border-border bg-surface text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" aria-hidden />
                {tab.label}
              </button>
            );
          })}
        </div>

        {sourceType === "drive" ? (
          <div className="mt-4 space-y-3">
            <div>
              <div className="flex items-center justify-between">
                <Label htmlFor="album-source-url">Link thư mục Google Drive</Label>
                <a
                  href="https://support.google.com/drive/answer/2494822"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline"
                >
                  Cách bật quyền xem link trên Drive ↗
                </a>
              </div>
              <Input
                id="album-source-url"
                value={sourceUrl}
                onChange={(event) => setSourceUrl(event.target.value)}
                placeholder="https://drive.google.com/drive/folders/1Y_iq_9JTzaQOIZ_1LxTOnd6aVJWcVjQQ?usp=sharing"
                className="mt-1.5 font-mono text-sm"
              />
              <p className="mt-1.5 text-xs text-muted-foreground">
                Mẹo: Bạn có thể dán toàn bộ đường link trình duyệt hoặc ID thư mục. Thử nghiệm nhanh có sẵn folder <code className="rounded bg-surface-muted px-1">demo-folder-1</code>.
              </p>
            </div>
            <Button type="button" onClick={() => void handleScan()} disabled={scanning} className="w-full sm:w-auto">
              {scanning ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Đang quét ảnh từ Google Drive...
                </>
              ) : (
                <>
                  <FolderSearch className="h-4 w-4" aria-hidden />
                  Quét ảnh
                </>
              )}
            </Button>
          </div>
        ) : null}

        {sourceType === "multi_link" ? (
          <div className="mt-4 space-y-3">
            <div>
              <Label htmlFor="album-source-urls">Mỗi dòng một link thư mục</Label>
              <Textarea
                id="album-source-urls"
                value={sourceUrls}
                onChange={(event) => setSourceUrls(event.target.value)}
                rows={4}
                placeholder={"https://drive.google.com/drive/folders/demo-folder-duoi-ca\nhttps://drive.google.com/drive/folders/demo-folder-truyen-thong"}
                className="mt-1.5 font-mono text-xs"
              />
            </div>
            <Button type="button" onClick={() => void handleScan()} disabled={scanning}>
              {scanning ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <FolderSearch className="h-4 w-4" aria-hidden />
              )}
              Quét tất cả link
            </Button>
          </div>
        ) : null}

        {sourceType === "upload" ? (
          <div className="mt-4 rounded-lg border border-dashed border-border bg-surface-muted px-4 py-5 text-sm text-muted-foreground">
            Album sẽ được tạo ở trạng thái <strong>Chưa upload</strong>. Sau khi
            tạo, bạn tải thư mục hoặc ZIP trực tiếp trong trang album. Chỉ nhận
            JPEG, PNG, WebP; ảnh RAW không được xử lý trong môi trường demo.
          </div>
        ) : null}

        {previewError ? (
          <Alert tone="danger" className="mt-4">
            {previewError}
          </Alert>
        ) : null}

        {preview ? (
          <div className="mt-4 rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-sm dark:border-emerald-900 dark:bg-emerald-950/40">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="success">Quét thành công</Badge>
              <span className="text-[var(--success)]">
                {preview.sourceCount} nguồn · {preview.photoCount} ảnh ·{" "}
                {preview.folders.length} thư mục
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {preview.folders.map((folder, index) => (
                <span
                  key={`${folder.name}-${index}`}
                  className="rounded-full border border-emerald-300 bg-white px-3 py-1 text-xs text-[var(--success)] dark:border-emerald-900 dark:bg-emerald-950/60"
                >
                  {folder.name} ({folder.photoCount})
                </span>
              ))}
            </div>
            <p className="mt-3 text-xs text-[var(--success)]">
              Ví dụ ảnh: {preview.files.map((file) => file.filename).join(", ")}
            </p>
          </div>
        ) : null}
      </div>

      <div className={cn("rounded-xl border border-border bg-surface p-4 sm:p-5", step !== 2 && "hidden")}>
        <h2 className="text-base font-semibold text-foreground">Thông tin khách & album</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label htmlFor="album-title">Tiêu đề album *</Label>
            <Input
              id="album-title"
              name="title"
              value={albumTitle}
              onChange={(e) => setAlbumTitle(e.target.value)}
              placeholder="Ví dụ: Album cưới Tuấn & Lan"
              className="mt-1.5"
              maxLength={160}
            />
          </div>
          <div>
            <Label htmlFor="album-branch">Chi nhánh *</Label>
            <Select
              id="album-branch"
              value={branchId}
              onChange={(event) => {
                setBranchId(event.target.value);
                setOrderId("");
              }}
              className="mt-1.5"
            >
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="album-customer">Khách hàng</Label>
            <Select
              id="album-customer"
              value={customerId}
              onChange={(event) => {
                setCustomerId(event.target.value);
                setOrderId("");
              }}
              className="mt-1.5"
            >
              <option value="">Không gắn khách</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name} · {customer.phone}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="album-order">Đơn hàng / hợp đồng</Label>
            <Select
              id="album-order"
              value={orderId}
              onChange={(event) => setOrderId(event.target.value)}
              disabled={!customerId}
              className="mt-1.5"
            >
              <option value="">Không gắn đơn</option>
              {filteredOrders.map((order) => (
                <option key={order.id} value={order.id}>
                  {order.code}
                </option>
              ))}
            </Select>
            {!customerId ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Chọn khách trước để lọc đơn hàng.
              </p>
            ) : null}
          </div>
          <div>
            <Label htmlFor="album-expires">Link hết hạn</Label>
            <Input
              id="album-expires"
              name="expiresAt"
              type="date"
              className="mt-1.5"
            />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="album-notes">Ghi chú nội bộ</Label>
            <Textarea
              id="album-notes"
              name="notes"
              rows={3}
              maxLength={2000}
              placeholder="Thông tin nội bộ, khách không thấy mục này."
              className="mt-1.5"
            />
          </div>
        </div>
      </div>

      <div className={cn("rounded-xl border border-border bg-surface p-4 sm:p-5", step !== 3 && "hidden")}>
        <h2 className="text-base font-semibold text-foreground">Số lượng chọn & chia sẻ</h2>
        <div className="mt-4 space-y-5">
          <div>
            <Label>Khách được chọn bao nhiêu ảnh? *</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {QUOTA_OPTIONS.map((quota) => (
                <button
                  key={quota}
                  type="button"
                  onClick={() => setSelectionLimit(quota)}
                  className={cn(
                    "h-9 min-w-10 rounded-lg border px-3 text-sm font-medium",
                    selectionLimit === quota
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-surface text-muted-foreground hover:text-foreground",
                  )}
                >
                  {quota}
                </button>
              ))}
              <Input
                type="number"
                min={1}
                max={1000}
                value={selectionLimit}
                onChange={(event) =>
                  setSelectionLimit(
                    Math.min(1000, Math.max(1, Number(event.target.value) || 1)),
                  )
                }
                className="h-9 w-24"
                aria-label="Số ảnh tùy chỉnh"
              />
            </div>
          </div>

          <div className="rounded-lg border border-border p-3">
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={extraPhotoEnabled}
                onChange={(event) => setExtraPhotoEnabled(event.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-border"
              />
              <span>
                <span className="font-medium text-foreground">
                  Thu phí khi khách chọn thêm ảnh
                </span>
                <span className="block text-xs text-muted-foreground">
                  Mặc định tắt để tránh khách hiểu nhầm nếu studio không thu phí.
                </span>
              </span>
            </label>
            {extraPhotoEnabled ? (
              <div className="mt-3">
                <Label htmlFor="album-extra-price">Đơn giá ảnh thêm (VND)</Label>
                <Input
                  id="album-extra-price"
                  name="extraPhotoPrice"
                  type="number"
                  min={0}
                  step={1}
                  value={extraPhotoPrice}
                  onChange={(event) => setExtraPhotoPrice(event.target.value)}
                  className="mt-1.5 max-w-xs"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Ví dụ 5 ảnh vượt quota sẽ ghi nhận{" "}
                  {formatVnd((Number(extraPhotoPrice) || 0) * 5)} vào yêu cầu
                  thanh toán khi khách gửi lựa chọn.
                </p>
              </div>
            ) : (
              <input type="hidden" name="extraPhotoPrice" value="0" />
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="album-download-limit">Giới hạn lượt tải (để trống = không giới hạn)</Label>
              <Input
                id="album-download-limit"
                name="downloadLimit"
                type="number"
                min={1}
                placeholder="Ví dụ: 30"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="album-password">Mật khẩu xem album (tùy chọn)</Label>
              <Input
                id="album-password"
                name="password"
                type="password"
                maxLength={72}
                placeholder="Tối thiểu 4 ký tự nếu đặt"
                className="mt-1.5"
                autoComplete="new-password"
              />
            </div>
          </div>

          <div className="rounded-lg bg-surface-muted p-3 text-xs text-muted-foreground">
            Thả tim và ghi chú ảnh được bật mặc định. Link chia sẻ dùng token khó
            đoán; sau khi tạo album bạn có thể đổi link, đặt mật khẩu, hạn dùng,
            giới hạn tải và thu hồi trong trang quản lý album.
          </div>
        </div>
      </div>

      {state.status === "error" ? (
        <Alert tone="danger">{state.message}</Alert>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => setStep((current) => Math.max(1, current - 1))}
          disabled={step === 1}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Quay lại
        </Button>
        {step < 3 ? (
          <Button type="button" onClick={goNext}>
            Tiếp tục
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Button>
        ) : (
          <SubmitButton pendingLabel="Đang tạo album...">
            <CheckCircle2 className="h-4 w-4" aria-hidden />
            Tạo album
          </SubmitButton>
        )}
      </div>
    </form>
  );
}
