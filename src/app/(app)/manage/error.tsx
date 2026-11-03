"use client";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/shared/error-state";

export default function ManageError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorState
      title="Không thể tải trang quản trị"
      description="Đã có lỗi khi xử lý yêu cầu. Dữ liệu nhập trước đó có thể vẫn còn trong form. Vui lòng thử lại."
      action={
        <div className="flex flex-col items-center gap-2">
          <Button onClick={reset}>Thử lại</Button>
          {error.digest ? (
            <span className="text-xs text-muted-foreground">
              Mã lỗi: {error.digest}
            </span>
          ) : null}
        </div>
      }
    />
  );
}
