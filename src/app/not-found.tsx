import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
        404
      </p>
      <h1 className="mt-2 text-2xl font-semibold text-foreground">
        Không tìm thấy trang
      </h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        Đường dẫn không tồn tại hoặc bạn không còn quyền truy cập bản ghi này.
      </p>
      <Button asChild className="mt-5">
        <Link href="/manage/dashboard">Về dashboard</Link>
      </Button>
    </div>
  );
}
