import Link from "next/link";
import { DRIVE_KIND_LABELS } from "@/lib/drive-labels";
import { Download, Monitor, ExternalLink, HardDrive } from "lucide-react";
import { requireActor } from "@/lib/auth/session";
import { assertPermission, hasPermission } from "@/lib/auth/permissions";
import { getDb } from "@/lib/db/client";
import { listDriveDevices, listDriveShares } from "@/lib/services/drive-service";
import { AddDeviceButton, CopyButton, StaffMutation } from "@/components/drive/staff-controls";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function ManageDrivePage() {
  const actor = await requireActor();
  assertPermission(actor, "albums.view");
  const devices = listDriveDevices(getDb(), actor);
  const shares = listDriveShares(getDb(), actor);
  const canManage = hasPermission(actor.permissions, "albums.manage") && !actor.readOnly;
  return (
    <div className="space-y-6">
      <PageHeader
        title="StudioCore Drive"
        description="Chia sẻ thư mục từ máy tính studio, nhận lựa chọn từ khách hàng."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <a href="/downloads/StudioCore-Drive-Windows.zip">
                <Download className="size-4" />
                Windows
              </a>
            </Button>
            <Button asChild variant="outline">
              <a href="/downloads/StudioCore-Drive-macOS.zip">
                <Download className="size-4" />
                macOS
              </a>
            </Button>
          </div>
        }
      />
      <Card className="bg-gradient-to-br from-blue-50 to-surface dark:from-blue-950/30">
        <CardHeader>
          <CardTitle>Kết nối một lần, chia sẻ mọi lúc</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            "Cài Node.js LTS từ nodejs.org, sau đó tải và giải nén gói phù hợp bên trên.",
            "Windows: chạy windows/install.bat. macOS: chạy install.command. Trình cài đặt sẽ mở giao diện trên trình duyệt.",
            "Thêm máy tính bên dưới, sao chép khóa một lần vào Cài đặt → Khóa kết nối trong ứng dụng và lưu.",
            "Chọn Tạo link mới hoặc dùng menu chuột phải / Finder Quick Actions, chọn thư mục và gửi link cho khách. Giữ máy và ứng dụng chạy khi khách xem.",
          ].map((step, i) => (
            <div key={step} className="flex gap-3 text-sm">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                {i + 1}
              </span>
              <p>{step}</p>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3">
          <CardTitle>
            <Monitor className="mr-2 inline size-5" />
            Máy tính của studio
          </CardTitle>
          {canManage && <AddDeviceButton />}
        </CardHeader>
        <CardContent>
          {devices.length === 0 ? (
            <p className="py-6 text-center text-muted-foreground">
              Chưa có máy tính. Thêm máy tính để bắt đầu chia sẻ.
            </p>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {devices.map((device) => (
                <div key={device.id} className="space-y-3 rounded-xl border border-border p-4">
                  <div className="flex items-center justify-between gap-3">
                    <strong>{device.name}</strong>
                    <Badge tone={device.online ? "success" : "neutral"}>
                      {device.revokedAt
                        ? "Đã thu hồi"
                        : device.online
                          ? "Trực tuyến"
                          : "Ngoại tuyến"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {device.os || "Chưa kết nối"} · {device.appVersion || "—"} ·{" "}
                    <code>{device.keyPrefix}…</code>
                  </p>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>
                      Lần cuối:{" "}
                      {device.lastSeenAt ? device.lastSeenAt.toLocaleString("vi-VN") : "Chưa có"}
                    </span>
                    {canManage && !device.revokedAt && (
                      <StaffMutation id={device.id} operation="revokeDevice">
                        Thu hồi
                      </StaffMutation>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      <div className="flex items-center gap-2">
        <HardDrive className="size-5" />
        <h2 className="text-lg font-semibold">Link chia sẻ</h2>
        <Badge>{shares.length}</Badge>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            {[
              "Album / thư mục",
              "Khách hàng",
              "Máy tính",
              "Ngày tạo",
              "Tệp",
              "Lựa chọn",
              "Trạng thái",
              "Thao tác",
            ].map((label) => (
              <TableHead key={label}>{label}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {shares.map((share) => (
            <TableRow key={share.id}>
              <TableCell>
                <div className="space-y-1">
                  <Badge>{DRIVE_KIND_LABELS[share.kind]}</Badge>
                  <Link
                    className="block font-medium hover:underline"
                    href={`/manage/drive/${share.id}`}
                  >
                    {share.title}
                  </Link>
                </div>
              </TableCell>
              <TableCell>{share.customerName || "—"}</TableCell>
              <TableCell>
                {devices.find((device) => device.id === share.deviceId)?.name || "—"}
              </TableCell>
              <TableCell className="whitespace-nowrap">
                {share.createdAt.toLocaleDateString("vi-VN")}
              </TableCell>
              <TableCell>{share.fileCount}</TableCell>
              <TableCell>
                {share.kind === "album" ? (
                  <div>
                    {share.likedCount}/{share.maxSelect}
                    <p className="text-xs text-muted-foreground">
                      {share.selectionStatus === "finalized" ? "Đã chốt" : "Đang chọn"}
                    </p>
                  </div>
                ) : (
                  "—"
                )}
              </TableCell>
              <TableCell>
                <Badge tone={share.status === "active" ? "success" : "warning"}>
                  {share.status === "revoked"
                    ? "Đã thu hồi"
                    : share.expired
                      ? "Hết hạn"
                      : share.status === "paused"
                        ? "Tạm dừng"
                        : "Hoạt động"}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-2">
                  <CopyButton value={share.url}>Link</CopyButton>
                  <Button asChild variant="outline" size="sm">
                    <a href={share.url} target="_blank" rel="noreferrer">
                      <ExternalLink className="size-4" />
                      Mở
                    </a>
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/manage/drive/${share.id}`}>Chi tiết</Link>
                  </Button>
                  {canManage && share.status !== "revoked" && (
                    <>
                      <StaffMutation
                        id={share.id}
                        operation={share.status === "active" ? "paused" : "active"}
                      >
                        {share.status === "active" ? "Tạm dừng" : "Tiếp tục"}
                      </StaffMutation>
                      <StaffMutation id={share.id} operation="revoked">
                        Thu hồi
                      </StaffMutation>
                    </>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
          {shares.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                Chưa có link chia sẻ. Hãy tạo album trong ứng dụng máy tính.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
