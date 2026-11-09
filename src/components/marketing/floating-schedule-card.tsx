import { CalendarDays, CheckCircle2, ShieldCheck, UserCheck } from "lucide-react";

export function FloatingScheduleCard() {
  return (
    <div className="liquid-glass absolute -top-6 -left-3 hidden w-72 rounded-3xl p-4 shadow-2xl transition-all duration-300 hover:shadow-primary/20 md:block lg:-left-10 animate-float-delayed">
      <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-2.5">
        <div className="flex items-center gap-1.5">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
            <CalendarDays className="h-3.5 w-3.5" />
          </span>
          <span className="text-xs font-bold text-foreground">Điều Phối Ekip</span>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="h-3 w-3" />
          0 Trùng ca
        </span>
      </div>

      <div className="mt-2.5 space-y-2">
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-2">
          <div className="flex items-center justify-between text-[11px] font-semibold text-foreground">
            <span>08:30 • Cưới Ngoại Cảnh</span>
            <span className="text-emerald-600 dark:text-emerald-400">Khớp lịch</span>
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <UserCheck className="h-3 w-3 text-primary" />
            <span>Thợ: Minh Tuấn · Make: Lan Anh</span>
          </div>
        </div>

        <div className="rounded-xl border border-border/80 bg-surface/70 p-2">
          <div className="flex items-center justify-between text-[11px] font-semibold text-foreground">
            <span>13:30 • Chụp Bé &amp; Gia Đình</span>
            <span className="text-primary">Sẵn sàng</span>
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <UserCheck className="h-3 w-3 text-primary" />
            <span>Thợ: Hoàng Long · Studio Phòng 2</span>
          </div>
        </div>
      </div>

      <div className="mt-2.5 flex items-center justify-between text-[10px] text-muted-foreground">
        <span>Tự động phát hiện xung đột giờ</span>
        <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
      </div>
    </div>
  );
}
