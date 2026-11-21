import Link from "next/link";
import { DRIVE_KIND_LABELS } from "@/lib/drive-labels";
import { notFound } from "next/navigation";
import { requireActor } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { getDb } from "@/lib/db/client";
import {
  getDriveShare,
  getDriveSelection,
  listDriveVideoComments,
} from "@/lib/services/drive-service";
import { NotFoundError } from "@/lib/errors";
import { PageHeader } from "@/components/shared/page-header";
import { CopyButton, StaffMutation } from "@/components/drive/staff-controls";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function DriveDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireActor();
  const { id } = await params;
  const db = getDb();
  let share;
  try {
    share = getDriveShare(db, actor, id);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }
  const selection = getDriveSelection(db, actor, id);
  const comments = listDriveVideoComments(db, actor, id);
  const codes = selection.items.filter((item) => item.liked).map((item) => item.code);
  const canManage = hasPermission(actor.permissions, "albums.manage") && !actor.readOnly;
  return (
    <div className="space-y-6">
      <Link href="/manage/drive" className="text-sm text-muted-foreground hover:underline">
        ← StudioCore Drive
      </Link>
      <PageHeader
        title={share.title}
        description={`${DRIVE_KIND_LABELS[share.kind]} · ${share.fileCount} tệp · ${share.customerName || "Chưa có tên khách"}`}
      />
      <Card>
        <CardHeader>
          <CardTitle>Cấu hình chia sẻ</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <a
              className="break-all text-sm underline"
              href={share.url}
              target="_blank"
              rel="noreferrer"
            >
              {share.url}
            </a>
            <CopyButton value={share.url}>Sao chép link</CopyButton>
          </div>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>PIN: {share.pinProtected ? "Đã thiết lập" : "Không"}</div>
            <div>Tải bản gốc: {share.allowOriginals ? "Cho phép" : "Không"}</div>
            <div>Giới hạn chọn: {share.maxSelect ?? "—"}</div>
            <div>Hết hạn: {share.expiresAt?.toLocaleString("vi-VN") || "Không hết hạn"}</div>
            <div>Thư mục: {share.folderName}</div>
            <div>Trạng thái: {share.status}</div>
          </dl>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>
            Lựa chọn của khách ·{" "}
            {selection.selectionStatus === "finalized" ? "Đã chốt" : "Đang chọn"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <CopyButton value={codes.join(" ")}>Mã cách bằng khoảng trắng</CopyButton>
            <CopyButton value={codes.join(",")}>Mã cách bằng dấu phẩy</CopyButton>
            {canManage &&
              share.status !== "revoked" &&
              selection.selectionStatus === "finalized" && (
                <StaffMutation id={id} operation="reopen">
                  Mở lại lựa chọn
                </StaffMutation>
              )}
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mã ảnh</TableHead>
                <TableHead>Tên tệp</TableHead>
                <TableHead>Đã chọn</TableHead>
                <TableHead>Ghi chú</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {selection.items.map((item) => (
                <TableRow key={item.fileId}>
                  <TableCell>{item.code}</TableCell>
                  <TableCell>{item.name}</TableCell>
                  <TableCell>{item.liked ? "Có" : "Không"}</TableCell>
                  <TableCell className="whitespace-pre-wrap">{item.note || "—"}</TableCell>
                </TableRow>
              ))}
              {selection.items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4}>Chưa có lựa chọn hoặc ghi chú.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Bình luận video</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {comments.length === 0 ? (
            <p className="text-sm text-muted-foreground">Chưa có bình luận.</p>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} className="rounded-lg border border-border p-3 text-sm">
                <strong>{comment.author}</strong> · {comment.seconds.toFixed(1)}s
                <p className="whitespace-pre-wrap">{comment.content}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
