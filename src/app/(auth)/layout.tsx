import Link from "next/link";
import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto grid min-h-screen w-full max-w-[1280px] lg:grid-cols-[1.05fr_0.95fr]">
        <div className="relative hidden overflow-hidden bg-primary p-10 text-primary-foreground lg:flex lg:flex-col lg:justify-between">
          <div>
            <Link href="/" className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 text-lg font-bold">
                S
              </span>
              <div>
                <p className="text-base font-semibold">StudioCore</p>
                <p className="text-xs text-primary-foreground/75">
                  Nền tảng quản lý studio chụp ảnh
                </p>
              </div>
            </Link>

            <div className="mt-20 max-w-md">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-foreground/70">
                Vận hành tập trung
              </p>
              <h1 className="mt-4 text-4xl font-semibold leading-tight">
                Một hệ thống cho khách hàng, lịch chụp, album và tài chính.
              </h1>
              <p className="mt-4 text-sm leading-6 text-primary-foreground/80">
                StudioCore được thiết kế cho studio ảnh Việt Nam: đa chi nhánh,
                phân quyền theo vai trò, dữ liệu tập trung và quy trình từ lead
                đến giao ảnh.
              </p>
            </div>
          </div>

          <div className="grid gap-3 text-sm text-primary-foreground/85">
            <Link href="/register" className="font-semibold underline">
              Đăng ký dùng thử StudioCore
            </Link>
            <p className="flex items-center gap-3">
              <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />
              Multi-tenant và đa chi nhánh
            </p>
            <p className="flex items-center gap-3">
              <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />
              Phân quyền chi tiết, kiểm tra ở server
            </p>
            <p className="flex items-center gap-3">
              <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />
              Dữ liệu demo thuần Việt, chạy local-first
            </p>
          </div>
        </div>

        <div className="flex min-h-screen min-w-0 flex-col justify-center px-4 py-10 sm:px-8 lg:px-12">
          <div className="mx-auto w-full min-w-0 max-w-md">
            <div className="mb-8 flex items-center gap-3 lg:hidden">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-lg font-bold text-primary-foreground">
                S
              </span>
              <div>
                <p className="text-base font-semibold text-foreground">StudioCore</p>
                <p className="text-xs text-muted-foreground">
                  Nền tảng quản lý studio chụp ảnh
                </p>
              </div>
            </div>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
