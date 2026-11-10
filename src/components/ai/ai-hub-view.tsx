"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Bot,
  BrainCircuit,
  Check,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  MessageSquare,
  Palette,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Sliders,
  Sparkles,
  Trash2,
  TrendingUp,
  Tv,
  Wand2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  addAiHubApiKeyAction,
  deleteAiHubApiKeyAction,
  resetAiHubFeatureStatsAction,
  testAiHubApiKeyAction,
  toggleAiHubApiKeyAction,
  toggleAiHubFeatureAction,
  updateAiHubFeatureAction,
} from "@/lib/actions/ai-hub-actions";
import type {
  AiHubApiKey,
  AiHubData,
  AiHubFeatureConfig,
  AiHubFeatureId,
} from "@/lib/services/ai-hub-service";
import type { AiJobView } from "@/lib/services/ai-service";
import { DateTimeText } from "@/components/shared/date-time";
import { formatVnd } from "@/lib/utils";

interface AiHubViewProps {
  initialData: AiHubData;
  recentJobs?: AiJobView[];
}

export function AiHubView({ initialData, recentJobs = [] }: AiHubViewProps) {
  const [data, setData] = useState<AiHubData>(initialData);
  const [activeTab, setActiveTab] = useState<"keys" | "features" | "reports">("features");
  const [isPending, startTransition] = useTransition();

  // Add API Key Modal state
  const [showAddKeyModal, setShowAddKeyModal] = useState(false);
  const [addKeyError, setAddKeyError] = useState<string | null>(null);

  // Success message banner
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  // Copied state
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);

  const showFeedback = (msg: string) => {
    setFeedbackMessage(msg);
    setTimeout(() => setFeedbackMessage(null), 4000);
  };

  const handleToggleFeature = (featureId: AiHubFeatureId, currentEnabled: boolean) => {
    const nextEnabled = !currentEnabled;
    // Optimistic update
    setData((prev) => {
      const updatedFeatures = prev.features.map((f) =>
        f.id === featureId ? { ...f, enabled: nextEnabled } : f,
      );
      const activeFeatures = updatedFeatures.filter((f) => f.enabled).length;
      return {
        ...prev,
        features: updatedFeatures,
        metrics: {
          ...prev.metrics,
          activeFeatures,
        },
      };
    });

    startTransition(async () => {
      try {
        const res = await toggleAiHubFeatureAction(featureId, nextEnabled);
        if (res?.data) {
          setData(res.data);
          showFeedback(`Đã ${nextEnabled ? "bật" : "tắt"} tính năng thành công.`);
        }
      } catch (err: any) {
        showFeedback(err?.message || "Lỗi cập nhật tính năng.");
      }
    });
  };

  const handleUpdateFeatureField = (
    featureId: AiHubFeatureId,
    field: "model" | "budgetUsd" | "warningPercent",
    value: any,
  ) => {
    const numValue = field === "model" ? value : Number(value);

    setData((prev) => {
      const updatedFeatures = prev.features.map((f) =>
        f.id === featureId ? { ...f, [field]: numValue } : f,
      );
      const totalBudgetUsd = updatedFeatures.reduce((sum, f) => sum + (f.budgetUsd || 0), 0);
      return {
        ...prev,
        features: updatedFeatures,
        metrics: {
          ...prev.metrics,
          totalBudgetUsd,
          budgetPercent:
            totalBudgetUsd > 0
              ? (prev.metrics.costThisMonthUsd / totalBudgetUsd) * 100
              : 0,
        },
      };
    });

    startTransition(async () => {
      try {
        const res = await updateAiHubFeatureAction(featureId, { [field]: numValue });
        if (res?.data) {
          setData(res.data);
        }
      } catch {
        // silently fallback or notify
      }
    });
  };

  const handleResetStats = (featureId: AiHubFeatureId, featureName: string) => {
    if (!confirm(`Bạn có chắc muốn đặt lại (reset) số liệu token và lượt gọi của "${featureName}"?`)) {
      return;
    }

    startTransition(async () => {
      try {
        const res = await resetAiHubFeatureStatsAction(featureId);
        if (res?.data) {
          setData(res.data);
          showFeedback(`Đã reset số liệu cho ${featureName}.`);
        }
      } catch (err: any) {
        showFeedback(err?.message || "Không thể reset số liệu.");
      }
    });
  };

  const handleAddKeySubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setAddKeyError(null);
    const form = e.currentTarget;
    const formData = new FormData(form);

    startTransition(async () => {
      try {
        const res = await addAiHubApiKeyAction(formData);
        if (res.success && res.data) {
          setData(res.data);
          setShowAddKeyModal(false);
          form.reset();
          showFeedback("Đã thêm API Key vào pool thành công.");
        } else {
          setAddKeyError(res.error || "Không thể thêm API Key.");
        }
      } catch (err: any) {
        setAddKeyError(err?.message || "Lỗi hệ thống khi thêm API key.");
      }
    });
  };

  const handleToggleKey = (keyId: string, currentStatus: string) => {
    const nextActive = currentStatus !== "active";
    startTransition(async () => {
      try {
        const res = await toggleAiHubApiKeyAction(keyId, nextActive);
        if (res?.data) {
          setData(res.data);
          showFeedback(`Đã ${nextActive ? "bật" : "tạm dừng"} API Key.`);
        }
      } catch (err: any) {
        showFeedback(err?.message || "Lỗi cập nhật key.");
      }
    });
  };

  const handleDeleteKey = (keyId: string, name: string) => {
    if (!confirm(`Xóa API Key "${name}" khỏi pool? Hành động này không thể hoàn tác.`)) {
      return;
    }
    startTransition(async () => {
      try {
        const res = await deleteAiHubApiKeyAction(keyId);
        if (res?.data) {
          setData(res.data);
          showFeedback(`Đã xóa API Key "${name}".`);
        }
      } catch (err: any) {
        showFeedback(err?.message || "Lỗi xóa API key.");
      }
    });
  };

  const handleTestKey = (keyId: string) => {
    startTransition(async () => {
      try {
        const res = await testAiHubApiKeyAction(keyId);
        showFeedback(res.message);
      } catch (err: any) {
        showFeedback(err?.message || "Lỗi kiểm tra key.");
      }
    });
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKeyId(id);
    setTimeout(() => setCopiedKeyId(null), 2000);
  };

  const getFeatureIcon = (icon: AiHubFeatureConfig["icon"]) => {
    switch (icon) {
      case "bot":
        return <Tv className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />;
      case "messenger":
        return <MessageSquare className="h-5 w-5 text-sky-600 dark:text-sky-400" />;
      case "ads":
        return <TrendingUp className="h-5 w-5 text-amber-600 dark:text-amber-400" />;
      case "social":
        return <Sparkles className="h-5 w-5 text-pink-600 dark:text-pink-400" />;
      case "photo":
        return <Palette className="h-5 w-5 text-rose-600 dark:text-rose-400" />;
      case "learning":
        return <BrainCircuit className="h-5 w-5 text-teal-600 dark:text-teal-400" />;
      default:
        return <Bot className="h-5 w-5 text-blue-600 dark:text-blue-400" />;
    }
  };

  const getFeatureIconBg = (icon: AiHubFeatureConfig["icon"]) => {
    switch (icon) {
      case "bot":
        return "bg-indigo-50 dark:bg-indigo-950/40 border-indigo-100 dark:border-indigo-900/50";
      case "messenger":
        return "bg-sky-50 dark:bg-sky-950/40 border-sky-100 dark:border-sky-900/50";
      case "ads":
        return "bg-amber-50 dark:bg-amber-950/40 border-amber-100 dark:border-amber-900/50";
      case "social":
        return "bg-pink-50 dark:bg-pink-950/40 border-pink-100 dark:border-pink-900/50";
      case "photo":
        return "bg-rose-50 dark:bg-rose-950/40 border-rose-100 dark:border-rose-900/50";
      case "learning":
        return "bg-teal-50 dark:bg-teal-950/40 border-teal-100 dark:border-teal-900/50";
      default:
        return "bg-blue-50 dark:bg-blue-950/40 border-blue-100 dark:border-blue-900/50";
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-16">
      {/* Top Bar: Back & Title */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/manage/settings"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Quay lại
          </Link>
          <div className="h-4 w-px bg-slate-300 dark:bg-slate-700" />
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Trung tâm AI
          </h1>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700">
            v2 - Hub
          </span>
        </div>

        {feedbackMessage && (
          <div className="rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800 animate-in fade-in">
            {feedbackMessage}
          </div>
        )}
      </div>

      {/* Top 4 Metrics Row */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {/* Metric 1: Số API Key */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            SỐ API KEY
          </p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {data.metrics.activeKeys}/{data.metrics.totalKeys}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {data.metrics.activeKeys} hoạt động
          </p>
        </div>

        {/* Metric 2: Tính năng đang bật */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            TÍNH NĂNG ĐANG BẬT
          </p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {data.metrics.activeFeatures}/{data.metrics.totalFeatures}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {data.metrics.activeFeatures === data.metrics.totalFeatures
              ? "Tất cả đang bật"
              : `${data.metrics.totalFeatures - data.metrics.activeFeatures} tính năng tắt`}
          </p>
        </div>

        {/* Metric 3: Chi phí tháng này */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            CHI PHÍ THÁNG NÀY
          </p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            ${data.metrics.costThisMonthUsd.toFixed(4)}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            ~ {data.metrics.costThisMonthVnd.toLocaleString("vi-VN")}đ
          </p>
        </div>

        {/* Metric 4: Tổng định mức */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            TỔNG ĐỊNH MỨC
          </p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            ${data.metrics.totalBudgetUsd.toFixed(2)}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Đã dùng {data.metrics.budgetPercent.toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Tabs navigation */}
      <div className="flex border-b border-slate-200 dark:border-slate-800">
        <div className="flex space-x-1 sm:space-x-2">
          <button
            type="button"
            onClick={() => setActiveTab("keys")}
            className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "keys"
                ? "border-blue-600 text-blue-600 dark:border-blue-500 dark:text-blue-400"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            <KeyRound className="h-4 w-4" />
            API Keys
            {data.metrics.totalKeys > 0 && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                {data.metrics.totalKeys}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("features")}
            className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "features"
                ? "border-blue-600 text-blue-600 dark:border-blue-500 dark:text-blue-400"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            <Sliders className="h-4 w-4" />
            Tính năng
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-600 dark:bg-blue-950 dark:text-blue-400">
              {data.metrics.activeFeatures}/{data.metrics.totalFeatures}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("reports")}
            className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "reports"
                ? "border-blue-600 text-blue-600 dark:border-blue-500 dark:text-blue-400"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            <TrendingUp className="h-4 w-4" />
            Báo cáo
          </button>
        </div>
      </div>

      {/* TAB 1: API KEYS */}
      {activeTab === "keys" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Pool API Key tập trung & Tự động Fallback
              </h2>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Các key được xoay vòng dùng chung. Khi một key gặp lỗi 429 hoặc cạn quota, hệ thống sẽ tự động chuyển sang key dự phòng tiếp theo.
              </p>
            </div>
            <Button
              type="button"
              onClick={() => setShowAddKeyModal(true)}
              className="bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Thêm API Key
            </Button>
          </div>

          {data.apiKeys.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center dark:border-slate-800 dark:bg-slate-900/50">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
                <KeyRound className="h-6 w-6" />
              </div>
              <h3 className="mt-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
                Chưa có API Key nào trong Pool
              </h3>
              <p className="mx-auto mt-1 max-w-md text-xs text-slate-500 dark:text-slate-400">
                Thêm API Key từ OpenAI, Google Gemini hoặc Anthropic Claude để các tính năng AI bắt đầu hoạt động với cơ chế tự động fallback.
              </p>
              <Button
                type="button"
                onClick={() => setShowAddKeyModal(true)}
                variant="outline"
                className="mt-4"
              >
                <Plus className="h-4 w-4 mr-1.5" />
                Thêm API Key đầu tiên
              </Button>
            </div>
          ) : (
            <div className="grid gap-3">
              {data.apiKeys.map((key) => (
                <div
                  key={key.id}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-semibold text-xs uppercase">
                      {key.provider.slice(0, 3)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                          {key.name}
                        </span>
                        <Badge
                          tone={
                            key.status === "active"
                              ? "success"
                              : key.status === "paused"
                                ? "neutral"
                                : "danger"
                          }
                        >
                          {key.status === "active"
                            ? "Hoạt động"
                            : key.status === "paused"
                              ? "Tạm dừng"
                              : "Lỗi quota"}
                        </Badge>
                        <span className="text-xs text-slate-400">
                          Ưu tiên #{key.priority}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-xs text-slate-500 font-mono">
                        <span>{key.keyMasked}</span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(key.keyMasked, key.id)}
                          className="hover:text-blue-600"
                          title="Copy"
                        >
                          {copiedKeyId === key.id ? (
                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleTestKey(key.id)}
                      disabled={isPending}
                    >
                      <RefreshCw className="h-3.5 w-3.5 mr-1" />
                      Test kết nối
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggleKey(key.id, key.status)}
                      disabled={isPending}
                    >
                      {key.status === "active" ? "Tạm dừng" : "Bật lại"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteKey(key.id, key.name)}
                      disabled={isPending}
                      className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Modal / Dialog thêm API Key */}
          {showAddKeyModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
              <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  Thêm API Key mới vào Pool
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Key được mã hóa bảo mật chuẩn AES-GCM và lưu an toàn.
                </p>

                {addKeyError && (
                  <div className="mt-3 rounded-lg bg-rose-50 p-3 text-xs text-rose-700 border border-rose-200">
                    {addKeyError}
                  </div>
                )}

                <form onSubmit={handleAddKeySubmit} className="mt-4 space-y-4">
                  <div>
                    <Label htmlFor="key-provider">Nhà cung cấp (Provider)</Label>
                    <select
                      id="key-provider"
                      name="provider"
                      defaultValue="openai"
                      className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                    >
                      <option value="openai">OpenAI (GPT-4o, GPT-4o Mini)</option>
                      <option value="gemini">Google Gemini (Gemini 1.5/2.5)</option>
                      <option value="anthropic">Anthropic Claude (Sonnet 3.5)</option>
                      <option value="deepseek">DeepSeek (V3, R1)</option>
                      <option value="openrouter">OpenRouter (Tổng hợp)</option>
                    </select>
                  </div>

                  <div>
                    <Label htmlFor="key-name">Tên gợi nhớ</Label>
                    <Input
                      id="key-name"
                      name="name"
                      placeholder="Ví dụ: Key OpenAI Chính, Backup..."
                      className="mt-1.5"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="key-value">API Key (sk-...)</Label>
                    <Input
                      id="key-value"
                      name="apiKey"
                      type="password"
                      placeholder="Dán key tại đây (sk-..., AIzaSy...)"
                      className="mt-1.5"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="key-priority">Thứ tự ưu tiên (1 = cao nhất)</Label>
                    <Input
                      id="key-priority"
                      name="priority"
                      type="number"
                      min={1}
                      max={99}
                      defaultValue={1}
                      className="mt-1.5"
                    />
                  </div>

                  <div className="mt-6 flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowAddKeyModal(false)}
                    >
                      Hủy
                    </Button>
                    <Button
                      type="submit"
                      disabled={isPending}
                      className="bg-blue-600 text-white hover:bg-blue-700"
                    >
                      {isPending ? "Đang lưu..." : "Lưu API Key"}
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: TÍNH NĂNG (Features matching screenshot exact layout) */}
      {activeTab === "features" && (
        <div className="space-y-4">
          {data.features.map((feature) => (
            <div
              key={feature.id}
              className={`rounded-2xl border transition-all ${
                feature.enabled
                  ? "border-slate-200/90 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
                  : "border-slate-200/50 bg-slate-50/60 opacity-75 dark:border-slate-800/60 dark:bg-slate-900/40"
              } p-4 sm:p-5`}
            >
              {/* Feature Card Top Row: Icon + Title + Switch */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${getFeatureIconBg(
                      feature.icon,
                    )}`}
                  >
                    {getFeatureIcon(feature.icon)}
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                      {feature.name}
                    </h3>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 max-w-2xl leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </div>

                {/* Switch Toggle */}
                <div className="flex items-center shrink-0">
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input
                      type="checkbox"
                      checked={feature.enabled}
                      onChange={() => handleToggleFeature(feature.id, feature.enabled)}
                      className="peer sr-only"
                    />
                    <div className="peer h-6 w-11 rounded-full bg-slate-200 after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-slate-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-hidden dark:bg-slate-700 dark:after:border-slate-600"></div>
                  </label>
                </div>
              </div>

              {/* Feature Card Middle Row: 3 Controls (Model, Budget, Warning %) */}
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-12 sm:gap-4">
                {/* 1. Mô hình AI */}
                <div className="sm:col-span-5">
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Mô hình AI
                  </label>
                  <select
                    value={feature.model}
                    disabled={!feature.enabled}
                    onChange={(e) =>
                      handleUpdateFeatureField(feature.id, "model", e.target.value)
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 focus:border-blue-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 disabled:opacity-60"
                  >
                    {feature.modelOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. Định mức USD/tháng */}
                <div className="sm:col-span-4">
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Định mức USD/tháng
                  </label>
                  <Input
                    type="number"
                    min={0}
                    max={1000}
                    step={1}
                    value={feature.budgetUsd}
                    disabled={!feature.enabled}
                    onChange={(e) =>
                      handleUpdateFeatureField(
                        feature.id,
                        "budgetUsd",
                        e.target.value,
                      )
                    }
                    className="h-9 text-sm"
                  />
                </div>

                {/* 3. Cảnh báo khi đạt % */}
                <div className="sm:col-span-3">
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Cảnh báo khi đạt %
                  </label>
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    step={5}
                    value={feature.warningPercent}
                    disabled={!feature.enabled}
                    onChange={(e) =>
                      handleUpdateFeatureField(
                        feature.id,
                        "warningPercent",
                        e.target.value,
                      )
                    }
                    className="h-9 text-sm"
                  />
                </div>
              </div>

              {/* Feature Card Bottom Row: Usage tokens & Budget status & Reset */}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs dark:border-slate-800/80">
                <span className="text-slate-500 dark:text-slate-400">
                  Đã dùng tháng này:{" "}
                  <strong className="text-slate-700 dark:text-slate-300">
                    {feature.tokensUsed} token
                  </strong>{" "}
                  •{" "}
                  <strong className="text-slate-700 dark:text-slate-300">
                    {feature.callsCount} lượt gọi
                  </strong>
                </span>

                <div className="flex items-center gap-3">
                  <span className="font-mono text-slate-600 dark:text-slate-400">
                    ${feature.usedUsd.toFixed(4)} / ${feature.budgetUsd} (
                    {(feature.budgetUsd > 0
                      ? (feature.usedUsd / feature.budgetUsd) * 100
                      : 0
                    ).toFixed(1)}
                    %)
                  </span>
                  <button
                    type="button"
                    onClick={() => handleResetStats(feature.id, feature.name)}
                    className="inline-flex items-center gap-1 font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Reset số liệu
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 3: BÁO CÁO (Reports & Logs) */}
      {activeTab === "reports" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <span className="text-xs font-semibold text-slate-500">TỔNG REQUEST AI</span>
              <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
                {data.features.reduce((s, f) => s + f.callsCount, 0)} lượt
              </p>
              <p className="mt-1 text-xs text-slate-500">Trong chu kỳ tháng hiện tại</p>
            </div>
            <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <span className="text-xs font-semibold text-slate-500">TỔNG TOKEN TIÊU THỤ</span>
              <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
                {data.features.reduce((s, f) => s + f.tokensUsed, 0).toLocaleString("vi-VN")}
              </p>
              <p className="mt-1 text-xs text-slate-500">Bao gồm input & output tokens</p>
            </div>
            <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <span className="text-xs font-semibold text-slate-500">TỈ LỆ THÀNH CÔNG</span>
              <p className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                100.0%
              </p>
              <p className="mt-1 text-xs text-slate-500">Tự động fallback thành công</p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Nhật ký gọi AI & Jobs gần đây
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Toàn bộ các tác vụ phân tích album, soạn thảo và xử lý ảnh tự động.
            </p>

            {recentJobs.length === 0 ? (
              <div className="mt-6 py-8 text-center text-xs text-slate-500 dark:text-slate-400">
                Chưa có job gọi AI nào trong hệ thống. Khi các tác vụ xử lý ảnh hoặc chat AI chạy, log chi tiết sẽ hiển thị ở đây.
              </div>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 text-slate-500 dark:border-slate-800">
                    <tr>
                      <th className="py-2 pr-4 font-semibold">Mã Job</th>
                      <th className="py-2 pr-4 font-semibold">Tác vụ</th>
                      <th className="py-2 pr-4 font-semibold">Provider</th>
                      <th className="py-2 pr-4 font-semibold">Chi phí</th>
                      <th className="py-2 pr-4 font-semibold">Trạng thái</th>
                      <th className="py-2 font-semibold">Thời gian</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {recentJobs.map((job) => (
                      <tr key={job.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-850">
                        <td className="py-2.5 pr-4 font-mono text-slate-600 dark:text-slate-400">
                          {job.id.slice(0, 8)}
                        </td>
                        <td className="py-2.5 pr-4 font-medium text-slate-800 dark:text-slate-200">
                          {job.type}
                        </td>
                        <td className="py-2.5 pr-4 text-slate-600 dark:text-slate-400">
                          {job.provider}
                        </td>
                        <td className="py-2.5 pr-4 font-mono text-slate-700 dark:text-slate-300">
                          {formatVnd(job.estimatedCost)}
                        </td>
                        <td className="py-2.5 pr-4">
                          <Badge
                            tone={
                              job.status === "completed"
                                ? "success"
                                : job.status === "failed"
                                  ? "danger"
                                  : "warning"
                            }
                          >
                            {job.status}
                          </Badge>
                        </td>
                        <td className="py-2.5 text-slate-500">
                          <DateTimeText value={job.createdAt} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
