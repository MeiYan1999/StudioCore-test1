"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Calendar,
  CalendarDays,
  Check,
  Clock,
  Copy,
  ExternalLink,
  FileText,
  MapPin,
  Plus,
  QrCode,
  RotateCw,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  createContractAction,
  getNextContractCodeAction,
} from "@/lib/actions/contract-actions";
import type { AssigneeOption } from "@/lib/services/order-service";
import type { RoomItem } from "@/lib/services/room-service";
import type { ServiceItem } from "@/lib/services/catalog-service";
import { formatVnd } from "@/lib/utils";

export interface StudioBankConfig {
  bankBin: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
}

export interface ContractSessionState {
  id: string;
  sessionNumber: number;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  roomId?: string;
  photographerId?: string;
  makeupId?: string;
  editorId?: string;
}

const SERVICE_CATEGORIES = [
  { value: "Pre-wedding", label: "Pre-wedding (Ảnh cưới ngoại cảnh & Studio)" },
  { value: "Tiệc cưới", label: "Tiệc cưới (Phóng sự cưới / Ăn hỏi)" },
  { value: "Baby & Trẻ em", label: "Baby & Trẻ em (Thôi nôi, sơ sinh, sinh nhật)" },
  { value: "Gia đình", label: "Gia đình (Ảnh kỷ niệm gia đình)" },
  { value: "Nàng thơ & Nghệ thuật", label: "Nàng thơ & Nghệ thuật (Concept cá nhân, Beauty)" },
  { value: "Profile & Doanh nhân", label: "Profile & Doanh nhân (Chân dung thương hiệu, Lookbook)" },
  { value: "Kỷ yếu", label: "Kỷ yếu (Học sinh, Sinh viên)" },
  { value: "Khác", label: "Dịch vụ khác" },
];

const PRESET_PACKAGES = [
  {
    id: "preset-wedding",
    name: "Gói Tiệc Cưới & Ngoại Cảnh",
    category: "Pre-wedding",
    price: 5000000,
    durationMinutes: 180,
    defaultCrew: "1 Chụp",
  },
  {
    id: "preset-prewedding-vip",
    name: "Gói Pre-wedding Studio & Ngoại Cảnh VIP",
    category: "Pre-wedding",
    price: 8500000,
    durationMinutes: 240,
    defaultCrew: "1 Chụp + 1 Makeup",
  },
  {
    id: "preset-party",
    name: "Gói Phóng Sự Cưới Trọn Gói",
    category: "Tiệc cưới",
    price: 6500000,
    durationMinutes: 240,
    defaultCrew: "1 Chụp",
  },
  {
    id: "preset-baby",
    name: "Gói Chụp Baby & Trẻ Em Studio",
    category: "Baby & Trẻ em",
    price: 2500000,
    durationMinutes: 90,
    defaultCrew: "1 Chụp",
  },
  {
    id: "preset-family",
    name: "Gói Chụp Ảnh Gia Đình",
    category: "Gia đình",
    price: 3500000,
    durationMinutes: 120,
    defaultCrew: "1 Chụp",
  },
  {
    id: "preset-muse",
    name: "Gói Nàng Thơ & Nghệ Thuật",
    category: "Nàng thơ & Nghệ thuật",
    price: 1800000,
    durationMinutes: 90,
    defaultCrew: "1 Chụp + 1 Makeup",
  },
  {
    id: "preset-profile",
    name: "Gói Profile Doanh Nhân & Thương Hiệu",
    category: "Profile & Doanh nhân",
    price: 2200000,
    durationMinutes: 90,
    defaultCrew: "1 Chụp",
  },
];

const CREW_CONFIGS = [
  "1 Chụp",
  "1 Chụp + 1 Makeup",
  "2 Chụp + 1 Makeup",
  "2 Chụp + 2 Makeup",
  "Chỉ Makeup",
  "Tùy chỉnh",
];

const QUICK_LOCATIONS = [
  "Phòng Studio A",
  "Phòng Studio B",
  "Ngoại cảnh",
  "Phim trường",
];

export function ContractCreateModal({
  branches,
  services = [],
  rooms = [],
  assignees,
  defaultBranchId,
  defaultDate,
  defaultTime = "09:00",
  studioBankConfig,
  trigger,
  onSuccess,
}: {
  branches: { id: string; name: string }[];
  services?: ServiceItem[];
  rooms?: RoomItem[];
  assignees?: {
    photographers: AssigneeOption[];
    editors: AssigneeOption[];
    makeup: AssigneeOption[];
  };
  defaultBranchId?: string;
  defaultDate?: string;
  defaultTime?: string;
  studioBankConfig?: StudioBankConfig;
  trigger?: React.ReactNode;
  onSuccess?: (orderId: string) => void;
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const todayStr =
    defaultDate || new Date().toISOString().slice(0, 10);

  // Form states
  const [code, setCode] = useState("HD00001");
  const [signedAt, setSignedAt] = useState(todayStr);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [branchId, setBranchId] = useState(
    defaultBranchId || branches[0]?.id || "",
  );
  const [serviceCategory, setServiceCategory] = useState("Pre-wedding");
  const [selectedServiceId, setSelectedServiceId] = useState(
    services[0]?.id || "preset-wedding",
  );
  const [packageName, setPackageName] = useState("Gói Tiệc Cưới & Ngoại Cảnh");
  const [crewConfig, setCrewConfig] = useState("1 Chụp");
  const [surcharge, setSurcharge] = useState<number>(0);
  const [surchargeNote, setSurchargeNote] = useState("");
  const [total, setTotal] = useState<number>(5000000);
  const [deposit, setDeposit] = useState<number>(500000);
  const [depositMethod, setDepositMethod] = useState<
    "bank_transfer" | "cash" | "vietqr"
  >("bank_transfer");
  const [notes, setNotes] = useState("");

  // Shoot Sessions (Buổi 1, Buổi 2...)
  const [sessions, setSessions] = useState<ContractSessionState[]>([
    {
      id: "session-1",
      sessionNumber: 1,
      date: todayStr,
      startTime: defaultTime || "09:00",
      endTime: "12:00",
      location: "Phòng Studio A",
      photographerId: "",
      makeupId: "",
      editorId: "",
    },
  ]);

  // VietQR Modal state
  const [showQrModal, setShowQrModal] = useState(false);
  const [copiedContent, setCopiedContent] = useState(false);

  // Load next contract code on open
  useEffect(() => {
    if (isOpen) {
      getNextContractCodeAction().then((res) => {
        if (res.code) {
          setCode(res.code);
        }
      });
    }
  }, [isOpen]);

  // Auto-sync initial package price if default preset matches
  const allPackages = [
    ...services.map((s) => ({
      id: s.id,
      name: s.name,
      category: s.category,
      price: s.price,
      durationMinutes: s.durationMinutes,
      defaultCrew: "1 Chụp",
    })),
    ...PRESET_PACKAGES,
  ];

  const handleSelectPackage = (pkgId: string) => {
    setSelectedServiceId(pkgId);
    const found = allPackages.find((p) => p.id === pkgId);
    if (found) {
      setPackageName(found.name);
      const newTotal = found.price + surcharge;
      setTotal(newTotal);
      if (found.defaultCrew) setCrewConfig(found.defaultCrew);

      // Adjust session 1 end time based on duration
      if (found.durationMinutes && sessions.length > 0) {
        const startH = parseInt(sessions[0].startTime.split(":")[0], 10) || 9;
        const startM = parseInt(sessions[0].startTime.split(":")[1], 10) || 0;
        const totalMinutes = startH * 60 + startM + found.durationMinutes;
        const endH = Math.min(23, Math.floor(totalMinutes / 60));
        const endM = totalMinutes % 60;
        const newEndTime = `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;

        setSessions((prev) =>
          prev.map((s, idx) => (idx === 0 ? { ...s, endTime: newEndTime } : s)),
        );
      }
    }
  };

  const handleSurchargeChange = (amount: number) => {
    setSurcharge(amount);
    const selectedPkg = allPackages.find((p) => p.id === selectedServiceId);
    const basePrice = selectedPkg ? selectedPkg.price : total - surcharge;
    setTotal(Math.max(0, basePrice + amount));
  };

  const handleAddSession = () => {
    const nextNum = sessions.length + 1;
    setSessions((prev) => [
      ...prev,
      {
        id: `session-${Date.now()}`,
        sessionNumber: nextNum,
        date: todayStr,
        startTime: "14:00",
        endTime: "17:00",
        location: "Ngoại cảnh",
        photographerId: sessions[0]?.photographerId || "",
        makeupId: sessions[0]?.makeupId || "",
        editorId: "",
      },
    ]);
  };

  const handleRemoveSession = (id: string) => {
    if (sessions.length <= 1) {
      toast.error("Hợp đồng cần ít nhất 1 buổi chụp.");
      return;
    }
    setSessions((prev) =>
      prev
        .filter((s) => s.id !== id)
        .map((s, index) => ({ ...s, sessionNumber: index + 1 })),
    );
  };

  const updateSession = (
    id: string,
    field: keyof ContractSessionState,
    value: any,
  ) => {
    setSessions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)),
    );
  };

  const handleRegenerateCode = async () => {
    const res = await getNextContractCodeAction();
    if (res.code) {
      setCode(res.code);
      toast.success(`Đã tạo mã mới: ${res.code}`);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!customerName.trim()) {
      toast.error("Vui lòng điền tên khách hàng.");
      return;
    }
    if (!customerPhone.trim()) {
      toast.error("Vui lòng điền số điện thoại khách hàng.");
      return;
    }

    const formData = new FormData();
    formData.set("code", code);
    formData.set("signedAt", signedAt);
    formData.set("customerName", customerName);
    formData.set("customerPhone", customerPhone);
    formData.set("branchId", branchId);
    formData.set("serviceCategory", serviceCategory);
    formData.set("serviceId", selectedServiceId.startsWith("preset-") ? "" : selectedServiceId);
    formData.set("packageName", packageName);
    formData.set("crewConfig", crewConfig);
    formData.set("surcharge", String(surcharge));
    formData.set("surchargeNote", surchargeNote);
    formData.set("total", String(total));
    formData.set("deposit", String(deposit));
    formData.set("depositMethod", depositMethod);
    formData.set("notes", notes);
    formData.set("sessions", JSON.stringify(sessions));

    startTransition(async () => {
      const res = await createContractAction(formData);
      if (res.success && res.orderId) {
        toast.success(res.message || `Đã lưu hợp đồng ${code} thành công! 🎉`);
        setIsOpen(false);
        router.refresh();
        if (onSuccess) {
          onSuccess(res.orderId);
        }
      } else {
        toast.error(res.error || "Không thể lưu hợp đồng.");
      }
    });
  };

  // Crew validation for session 1
  const photographersList = assignees?.photographers || [];
  const makeupList = assignees?.makeup || [];
  const editorsList = assignees?.editors || [];

  const s1 = sessions[0];
  const s1AssignedCount = [s1?.photographerId, s1?.makeupId, s1?.editorId].filter(
    Boolean,
  ).length;

  const requiresPhotographer = crewConfig.includes("Chụp");
  const hasPhotographer = Boolean(s1?.photographerId);

  // Bank Info for VietQR
  const bankBin = studioBankConfig?.bankBin || "970422"; // default MBBank
  const bankName = studioBankConfig?.bankName || "MBBank";
  const bankAccount = studioBankConfig?.accountNumber || "0987654321";
  const bankAccountName =
    studioBankConfig?.accountName || "CONG TY STUDIOCORE";

  const qrTransferContent = `COC ${code} ${customerName.trim().toUpperCase()}`;
  const vietQrUrl = `https://img.vietqr.io/image/${bankBin}-${bankAccount}-compact2.png?amount=${deposit}&addInfo=${encodeURIComponent(qrTransferContent)}&accountName=${encodeURIComponent(bankAccountName)}`;

  const copyQrContent = () => {
    navigator.clipboard.writeText(qrTransferContent);
    setCopiedContent(true);
    toast.success("Đã sao chép nội dung chuyển khoản!");
    setTimeout(() => setCopiedContent(false), 2000);
  };

  return (
    <>
      {trigger ? (
        <span onClick={() => setIsOpen(true)}>{trigger}</span>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90"
        >
          <FileText className="h-4 w-4" />
          <span>+ Thêm hợp đồng</span>
        </button>
      )}

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
          <div className="relative w-full max-w-[860px] max-h-[92vh] overflow-y-auto rounded-2xl border border-border bg-surface text-foreground shadow-2xl transition-all">
            {/* Modal Header */}
            <div className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-surface/95 px-6 py-4 backdrop-blur-sm">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <FileText className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
                    Thêm Hợp Đồng Studio Mới
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Khởi tạo hợp đồng dịch vụ, chọn gói chụp và lên kế hoạch lịch chụp cho khách
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                aria-label="Đóng"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* SECTION 1: THÔNG TIN HỢP ĐỒNG & KHÁCH HÀNG */}
              <section className="rounded-xl border border-border/80 bg-surface-muted/30 p-4 sm:p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
                  <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary">
                    <span className="h-2 w-2 rounded-full bg-primary" />
                    1. THÔNG TIN HỢP ĐỒNG &amp; KHÁCH HÀNG
                  </span>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  {/* Mã hợp đồng */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-semibold text-foreground">
                        Mã Hợp Đồng
                      </label>
                      <button
                        type="button"
                        onClick={handleRegenerateCode}
                        className="flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                      >
                        <RotateCw className="h-3 w-3" />
                        Tự sinh mã
                      </button>
                    </div>
                    <input
                      type="text"
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase())}
                      className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm font-mono font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      placeholder="HD00001"
                      required
                    />
                  </div>

                  {/* Ngày ký hợp đồng */}
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1.5">
                      Ngày ký hợp đồng
                    </label>
                    <input
                      type="date"
                      value={signedAt}
                      onChange={(e) => setSignedAt(e.target.value)}
                      className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      required
                    />
                  </div>

                  {/* Tên khách hàng */}
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1.5">
                      Tên khách hàng <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      placeholder="vd: Hoang Thang"
                      required
                    />
                  </div>

                  {/* Số điện thoại */}
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1.5">
                      Số điện thoại <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="tel"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      placeholder="09xx xxx xxx"
                      required
                    />
                  </div>

                  {/* Phân loại dịch vụ */}
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1.5">
                      Phân loại dịch vụ
                    </label>
                    <select
                      value={serviceCategory}
                      onChange={(e) => setServiceCategory(e.target.value)}
                      className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      {SERVICE_CATEGORIES.map((cat) => (
                        <option key={cat.value} value={cat.value}>
                          {cat.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Gói dịch vụ studio */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-semibold text-foreground">
                        Gói dịch vụ studio <span className="text-rose-500">*</span>
                      </label>
                      <Link
                        href="/manage/settings/services"
                        target="_blank"
                        className="flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                      >
                        ⚙ Quản lý gói
                      </Link>
                    </div>
                    <select
                      value={selectedServiceId}
                      onChange={(e) => handleSelectPackage(e.target.value)}
                      className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      {allPackages.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} — {formatVnd(p.price)}
                        </option>
                      ))}
                    </select>
                    {/* Ê-kíp định biên theo gói */}
                    <div className="mt-2 flex items-center justify-between rounded-md bg-accent/40 px-2.5 py-1.5 text-xs">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Users className="h-3.5 w-3.5 text-primary" />
                        Ê-kíp: <strong className="text-foreground">{crewConfig}</strong>
                      </span>
                      <select
                        value={crewConfig}
                        onChange={(e) => setCrewConfig(e.target.value)}
                        className="rounded border border-border bg-surface px-2 py-0.5 text-xs text-foreground focus:outline-none"
                      >
                        {CREW_CONFIGS.map((cfg) => (
                          <option key={cfg} value={cfg}>
                            {cfg}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Chi phí phát sinh */}
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1.5">
                      Chi phí phát sinh (đ)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        step="50000"
                        value={surcharge || 0}
                        onChange={(e) =>
                          handleSurchargeChange(Number(e.target.value) || 0)
                        }
                        className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold text-foreground pr-8 focus:outline-none focus:ring-1 focus:ring-primary"
                        placeholder="0"
                      />
                      <span className="absolute right-3 top-2.5 text-xs text-muted-foreground">
                        đ
                      </span>
                    </div>
                  </div>

                  {/* Ghi chú phát sinh */}
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1.5">
                      Ghi chú phát sinh (đi lại, vé cổng...)
                    </label>
                    <input
                      type="text"
                      value={surchargeNote}
                      onChange={(e) => setSurchargeNote(e.target.value)}
                      className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      placeholder="vd: Phát sinh đi lại ngoại tỉnh, vé vào cổng..."
                    />
                  </div>

                  {/* Tổng giá trị hợp đồng */}
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1.5">
                      Tổng giá trị hợp đồng (đ) <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        step="100000"
                        value={total}
                        onChange={(e) => setTotal(Number(e.target.value) || 0)}
                        className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm font-bold text-primary pr-8 focus:outline-none focus:ring-1 focus:ring-primary"
                        required
                      />
                      <span className="absolute right-3 top-2.5 text-xs font-medium text-muted-foreground">
                        đ
                      </span>
                    </div>
                  </div>

                  {/* Tiền cọc đợt 1 */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-semibold text-foreground">
                        Tiền cọc đợt 1 (đ)
                      </label>
                      <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                        Mặc định 500k hoặc theo gói
                      </span>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        max={total}
                        step="50000"
                        value={deposit}
                        onChange={(e) => setDeposit(Number(e.target.value) || 0)}
                        className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm font-bold text-emerald-600 dark:text-emerald-400 pr-8 focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                      <span className="absolute right-3 top-2.5 text-xs font-medium text-muted-foreground">
                        đ
                      </span>
                    </div>
                  </div>
                </div>
              </section>

              {/* SECTION 2: KẾ HOẠCH & LỊCH CHỤP CHO KHÁCH */}
              {sessions.map((session, index) => {
                const isPrimary = index === 0;
                return (
                  <section
                    key={session.id}
                    className="rounded-xl border border-sky-500/30 bg-sky-50/20 dark:bg-sky-950/10 p-4 sm:p-5 space-y-4"
                  >
                    <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
                      <div className="flex items-center gap-2">
                        <CalendarDays className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                        <span className="text-xs font-bold uppercase tracking-wider text-sky-700 dark:text-sky-300">
                          2. KẾ HOẠCH &amp; LỊCH CHỤP CHO KHÁCH (BUỔI{" "}
                          {session.sessionNumber} THEO GÓI)
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-sky-100 dark:bg-sky-900/60 px-2.5 py-0.5 text-[11px] font-semibold text-sky-700 dark:text-sky-300">
                          {isPrimary ? "Buổi chính" : `Buổi ${session.sessionNumber}`}
                        </span>
                        {!isPrimary && (
                          <button
                            type="button"
                            onClick={() => handleRemoveSession(session.id)}
                            className="text-xs text-rose-500 hover:text-rose-600 flex items-center gap-1 font-medium"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Xóa buổi này
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-3">
                      {/* Ngày chụp */}
                      <div>
                        <label className="block text-xs font-semibold text-foreground mb-1.5">
                          Ngày chụp
                        </label>
                        <input
                          type="date"
                          value={session.date}
                          onChange={(e) =>
                            updateSession(session.id, "date", e.target.value)
                          }
                          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                          required
                        />
                      </div>

                      {/* Bắt đầu */}
                      <div>
                        <label className="block text-xs font-semibold text-foreground mb-1.5">
                          Bắt đầu (24h)
                        </label>
                        <input
                          type="time"
                          value={session.startTime}
                          onChange={(e) =>
                            updateSession(session.id, "startTime", e.target.value)
                          }
                          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                          required
                        />
                      </div>

                      {/* Kết thúc */}
                      <div>
                        <label className="block text-xs font-semibold text-foreground mb-1.5">
                          Kết thúc (24h)
                        </label>
                        <input
                          type="time"
                          value={session.endTime}
                          onChange={(e) =>
                            updateSession(session.id, "endTime", e.target.value)
                          }
                          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                          required
                        />
                      </div>
                    </div>

                    {/* Địa điểm / Phòng chụp */}
                    <div>
                      <div className="flex flex-wrap items-center justify-between gap-1.5 mb-1.5">
                        <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5 text-primary" />
                          Địa điểm / Phòng chụp
                        </label>
                        <div className="flex flex-wrap gap-1">
                          {QUICK_LOCATIONS.map((loc) => (
                            <button
                              key={loc}
                              type="button"
                              onClick={() => updateSession(session.id, "location", loc)}
                              className="rounded border border-border bg-surface px-2 py-0.5 text-[11px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                            >
                              {loc}
                            </button>
                          ))}
                        </div>
                      </div>
                      <input
                        type="text"
                        value={session.location}
                        onChange={(e) =>
                          updateSession(session.id, "location", e.target.value)
                        }
                        className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                        placeholder="📍 vd: Phòng Studio A, Ngoại cảnh Đà Lạt, Phim trường Rosa..."
                      />
                    </div>

                    {/* Phân công ê-kíp */}
                    <div className="rounded-lg border border-border/80 bg-surface p-3.5 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                            <Users className="h-3.5 w-3.5 text-primary" />
                            Phân công ê-kíp Buổi {session.sessionNumber}
                          </span>
                          <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-medium text-foreground">
                            {[
                              session.photographerId,
                              session.makeupId,
                              session.editorId,
                            ].filter(Boolean).length}{" "}
                            người
                          </span>
                          {requiresPhotographer && !session.photographerId ? (
                            <span className="rounded-full bg-amber-100 dark:bg-amber-950/70 border border-amber-300 dark:border-amber-700 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">
                              ⚠️ Thiếu thợ (0/1 chụp)
                            </span>
                          ) : (
                            <span className="rounded-full bg-emerald-100 dark:bg-emerald-950/70 border border-emerald-300 dark:border-emerald-700 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
                              ✅ Đã đủ thợ (1/1 chụp)
                            </span>
                          )}
                        </div>
                        <Link
                          href="/manage/settings/staff"
                          target="_blank"
                          className="text-[11px] font-medium text-primary hover:underline flex items-center gap-1"
                        >
                          Quản lý nhân sự →
                        </Link>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-3">
                        {/* Photographer */}
                        <div>
                          <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                            Thợ chụp (Photographer)
                          </label>
                          <select
                            value={session.photographerId || ""}
                            onChange={(e) =>
                              updateSession(
                                session.id,
                                "photographerId",
                                e.target.value,
                              )
                            }
                            className="w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                          >
                            <option value="">Chưa phân công thợ chụp</option>
                            {photographersList.map((p) => (
                              <option key={p.id} value={p.id}>
                                📷 {p.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Makeup */}
                        <div>
                          <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                            Makeup Artist
                          </label>
                          <select
                            value={session.makeupId || ""}
                            onChange={(e) =>
                              updateSession(session.id, "makeupId", e.target.value)
                            }
                            className="w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                          >
                            <option value="">Chưa phân công makeup</option>
                            {makeupList.map((m) => (
                              <option key={m.id} value={m.id}>
                                💄 {m.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Editor / Trợ lý */}
                        <div>
                          <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                            Editor / Retoucher
                          </label>
                          <select
                            value={session.editorId || ""}
                            onChange={(e) =>
                              updateSession(session.id, "editorId", e.target.value)
                            }
                            className="w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                          >
                            <option value="">Chưa phân công editor</option>
                            {editorsList.map((ed) => (
                              <option key={ed.id} value={ed.id}>
                                💻 {ed.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <p className="text-[11px] text-muted-foreground italic">
                        Chưa có nhân sự. Bạn có thể phân công sau khi lưu.
                      </p>
                    </div>
                  </section>
                );
              })}

              {/* Button: Thêm buổi chụp khác */}
              <div className="space-y-1.5">
                <button
                  type="button"
                  onClick={handleAddSession}
                  className="w-full rounded-xl border-2 border-dashed border-sky-400/80 bg-sky-50/30 dark:bg-sky-950/20 py-3 text-xs font-bold text-sky-700 dark:text-sky-300 hover:bg-sky-50 dark:hover:bg-sky-950/40 hover:border-sky-500 transition-colors flex items-center justify-center gap-1.5 shadow-xs"
                >
                  <Plus className="h-4 w-4" />
                  + + Thêm Buổi Chụp Khác Cho Hợp Đồng Này (Buổi {sessions.length + 1})
                </button>
                <p className="text-[11px] text-muted-foreground text-center">
                  💡 Dành cho gói cưới nhiều ca/ngày: Số tiền hợp đồng không đổi (0 đ phát sinh cho khách). Mỗi buổi tự động lên Lịch chụp &amp; Google Calendar, nhân sự vẫn tính đủ tiền show.
                </p>
              </div>

              {/* SECTION 3: GHI CHÚ HỢP ĐỒNG & THU CỌC ĐỢT 1 */}
              <section className="rounded-xl border border-border/80 bg-surface-muted/30 p-4 sm:p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
                  <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    3. GHI CHÚ HỢP ĐỒNG &amp; THU CỌC ĐỢT 1
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">
                    Ghi chú hợp đồng
                  </label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="Yêu cầu chụp, trang phục, phụ kiện kèm theo..."
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold text-foreground">
                      Hình thức thu cọc đợt 1:
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowQrModal(true)}
                      className="text-xs font-semibold text-primary hover:underline flex items-center gap-1.5"
                    >
                      <QrCode className="h-3.5 w-3.5" />
                      Mở Mã QR Chuyển Khoản Ngay
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setDepositMethod("bank_transfer")}
                      className={`rounded-xl border p-2.5 text-xs font-semibold transition-all ${
                        depositMethod === "bank_transfer"
                          ? "border-primary bg-primary/10 text-primary shadow-xs"
                          : "border-border bg-surface text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Chuyển khoản (STK)
                    </button>

                    <button
                      type="button"
                      onClick={() => setDepositMethod("cash")}
                      className={`rounded-xl border p-2.5 text-xs font-semibold transition-all ${
                        depositMethod === "cash"
                          ? "border-primary bg-primary/10 text-primary shadow-xs"
                          : "border-border bg-surface text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Tiền mặt
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setDepositMethod("vietqr");
                        setShowQrModal(true);
                      }}
                      className={`rounded-xl border p-2.5 text-xs font-semibold transition-all ${
                        depositMethod === "vietqr"
                          ? "border-primary bg-primary/10 text-primary shadow-xs"
                          : "border-border bg-surface text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      VietQR Tự Động
                    </button>
                  </div>
                </div>
              </section>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {isPending ? (
                    <span className="flex items-center gap-1.5">
                      <RotateCw className="h-4 w-4 animate-spin" />
                      Đang lưu hợp đồng...
                    </span>
                  ) : (
                    "Lưu Hợp Đồng"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* VietQR Quick Payment Modal */}
      {showQrModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-sm rounded-2xl border border-border bg-surface p-6 shadow-2xl text-center space-y-4">
            <button
              type="button"
              onClick={() => setShowQrModal(false)}
              className="absolute right-4 top-4 rounded-lg p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>

            <div>
              <span className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 mb-2">
                <QrCode className="h-5 w-5" />
              </span>
              <h3 className="text-base font-bold text-foreground">
                Mã VietQR Thu Cọc Đợt 1
              </h3>
              <p className="text-xs text-muted-foreground">
                Khách quét QR bằng app ngân hàng để cọc tự động
              </p>
            </div>

            <div className="mx-auto rounded-xl border border-border bg-white p-3 shadow-sm inline-block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={vietQrUrl}
                alt="VietQR Deposit"
                className="w-56 h-auto mx-auto object-contain"
              />
            </div>

            <div className="rounded-xl bg-accent/40 p-3 text-left text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Số tiền cọc:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  {formatVnd(deposit)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ngân hàng:</span>
                <span className="font-semibold text-foreground">{bankName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Số tài khoản:</span>
                <span className="font-mono font-semibold text-foreground">
                  {bankAccount}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Chủ tài khoản:</span>
                <span className="font-semibold text-foreground">
                  {bankAccountName}
                </span>
              </div>
              <div className="border-t border-border/60 pt-1.5 flex items-center justify-between">
                <div>
                  <p className="text-[11px] text-muted-foreground">Nội dung chuyển:</p>
                  <p className="font-mono font-bold text-primary">
                    {qrTransferContent}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={copyQrContent}
                  className="rounded-md border border-border bg-surface p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent"
                  title="Sao chép"
                >
                  {copiedContent ? (
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowQrModal(false)}
              className="w-full rounded-xl bg-primary py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition"
            >
              Đã thu xong / Đóng
            </button>
          </div>
        </div>
      )}
    </>
  );
}
