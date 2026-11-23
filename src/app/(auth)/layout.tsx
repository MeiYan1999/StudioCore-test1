import Link from "next/link";
import type { ReactNode } from "react";
import { Aperture, CalendarCheck2, Phone, TrendingUp } from "lucide-react";

const SHOOT_SLOTS = [
  { time: "08:00", name: "Cưới Minh & Lan", initials: "ML", tone: "from-violet-400 to-indigo-500" },
  { time: "10:30", name: "Kỷ yếu 12A1", initials: "KY", tone: "from-sky-400 to-indigo-500" },
  { time: "14:00", name: "Gia đình chị Hà", initials: "GH", tone: "from-fuchsia-400 to-violet-500" },
];

const TRUSTED_AVATARS = [
  { initials: "AN", tone: "from-violet-400 to-indigo-600" },
  { initials: "TP", tone: "from-sky-400 to-blue-600" },
  { initials: "HL", tone: "from-fuchsia-400 to-purple-600" },
  { initials: "MK", tone: "from-emerald-400 to-teal-600" },
];

function BrandMark({ inverted = false }: { inverted?: boolean }) {
  return (
    <span className="flex items-center gap-3">
      <span className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/30 ring-1 ring-white/20">
        <Aperture className="h-5 w-5" strokeWidth={2.25} aria-hidden="true" />
      </span>
      <span>
        <span className="flex items-center gap-2">
          <span
            className={
              inverted
                ? "text-base font-semibold tracking-tight text-white"
                : "text-base font-semibold tracking-tight text-foreground"
            }
          >
            StudioCore
          </span>
          <span
            className={
              inverted
                ? "rounded-full border border-white/15 bg-white/10 px-1.5 py-px text-[10px] font-semibold leading-4 text-indigo-100"
                : "rounded-full border border-indigo-500/20 bg-indigo-500/10 px-1.5 py-px text-[10px] font-semibold leading-4 text-indigo-600 dark:text-indigo-300"
            }
          >
            v2.0
          </span>
        </span>
        <span
          className={
            inverted
              ? "block text-xs text-zinc-400"
              : "block text-xs text-muted-foreground"
          }
        >
          Nền tảng quản lý studio chụp ảnh
        </span>
      </span>
    </span>
  );
}

function StudioPreviewCard() {
  return (
    <div className="relative mt-10 max-w-md" aria-hidden="true">
      <div className="animate-float rounded-2xl border border-white/10 bg-white/[0.06] p-5 shadow-2xl shadow-black/40 backdrop-blur-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-200 ring-1 ring-indigo-400/30">
              <CalendarCheck2 className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-semibold tracking-tight text-white">Lịch chụp hôm nay</p>
              <p className="text-xs text-zinc-400">Chi nhánh Quận 1</p>
            </div>
          </div>
          <span className="rounded-full bg-emerald-400/10 px-2 py-0.5 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-400/20">
            8/8 slot
          </span>
        </div>

        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div className="h-full w-full rounded-full bg-gradient-to-r from-indigo-400 via-violet-400 to-fuchsia-400" />
        </div>

        <ul className="mt-4 space-y-2.5">
          {SHOOT_SLOTS.map((slot) => (
            <li
              key={slot.time}
              className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2"
            >
              <span className="w-11 font-mono text-xs text-zinc-400">{slot.time}</span>
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br ${slot.tone} text-[10px] font-semibold text-white`}
              >
                {slot.initials}
              </span>
              <span className="flex-1 truncate text-sm text-zinc-200">{slot.name}</span>
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px] shadow-emerald-400/70" />
            </li>
          ))}
        </ul>
      </div>

      <div className="animate-float-delayed absolute -bottom-8 -right-4 rounded-2xl border border-white/10 bg-zinc-900/80 px-4 py-3 shadow-2xl shadow-black/50 backdrop-blur-md xl:-right-12">
        <p className="text-xs text-zinc-400">Doanh thu tháng này</p>
        <div className="mt-1 flex items-center gap-2">
          <span className="text-lg font-semibold tracking-tight text-white">186,4tr</span>
          <span className="flex items-center gap-0.5 rounded-md bg-emerald-400/10 px-1.5 py-0.5 text-xs font-semibold text-emerald-300">
            <TrendingUp className="h-3 w-3" />
            +24%
          </span>
        </div>
      </div>
    </div>
  );
}

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <div className="grid min-h-screen w-full lg:grid-cols-[1.1fr_1fr]">
        <aside className="relative hidden overflow-hidden bg-gradient-to-br from-zinc-950 via-zinc-950 to-violet-950 text-white lg:flex lg:flex-col lg:justify-between lg:p-10 xl:p-14">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.35] [background-image:linear-gradient(to_right,rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:44px_44px] [mask-image:radial-gradient(ellipse_at_top_left,black_30%,transparent_75%)]"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-indigo-600/25 blur-3xl"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute -bottom-40 right-0 h-[28rem] w-[28rem] rounded-full bg-violet-600/20 blur-3xl"
            aria-hidden="true"
          />

          <div className="relative">
            <Link
              href="/"
              className="inline-flex rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60 focus-visible:ring-offset-4 focus-visible:ring-offset-zinc-950"
            >
              <BrandMark inverted />
            </Link>
          </div>

          <div className="relative my-12 max-w-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-300/80">
              Vận hành tập trung
            </p>
            <h2 className="mt-4 text-4xl font-semibold leading-[1.15] tracking-tight text-white xl:text-[2.75rem]">
              Một hệ thống cho khách hàng, lịch chụp, album{" "}
              <span className="bg-gradient-to-r from-indigo-300 via-violet-300 to-fuchsia-300 bg-clip-text text-transparent">
                và tài chính.
              </span>
            </h2>
            <p className="mt-5 max-w-lg text-[15px] leading-7 text-zinc-400">
              StudioCore được thiết kế cho studio ảnh Việt Nam: đa chi nhánh,
              phân quyền theo vai trò, dữ liệu tập trung và quy trình từ lead
              đến giao ảnh.
            </p>
            <StudioPreviewCard />
          </div>

          <div className="relative space-y-5">
            <div className="flex items-center gap-3">
              <div className="flex -space-x-2">
                {TRUSTED_AVATARS.map((avatar) => (
                  <span
                    key={avatar.initials}
                    className={`flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br ${avatar.tone} text-[10px] font-semibold text-white ring-2 ring-zinc-950`}
                    aria-hidden="true"
                  >
                    {avatar.initials}
                  </span>
                ))}
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 text-[10px] font-semibold text-zinc-300 ring-2 ring-zinc-950"
                  aria-hidden="true"
                >
                  300+
                </span>
              </div>
              <p className="text-sm text-zinc-300">
                Được <span className="font-semibold text-white">300+ studio</span> và photographer tin dùng
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-5 text-xs text-zinc-400">
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                <span>Multi-tenant và đa chi nhánh</span>
                <span>Phân quyền chi tiết, kiểm tra ở server</span>
              </div>
              <a
                href="tel:0976181859"
                className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-zinc-300 transition-colors hover:border-indigo-400/40 hover:text-white"
              >
                <Phone className="h-3 w-3" aria-hidden="true" />
                Hỗ trợ kỹ thuật 24/7 qua Hotline 0976 181 859
              </a>
            </div>
          </div>
        </aside>

        <main className="relative flex min-h-screen min-w-0 flex-col justify-center overflow-hidden px-4 py-10 sm:px-8 lg:px-12">
          <div
            className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-indigo-500/10 blur-3xl dark:bg-indigo-500/15"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-violet-500/10 blur-3xl lg:hidden"
            aria-hidden="true"
          />
          <div className="relative mx-auto w-full min-w-0 max-w-[440px]">
            <div className="mb-8 lg:hidden">
              <Link href="/" className="inline-flex">
                <BrandMark />
              </Link>
            </div>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
