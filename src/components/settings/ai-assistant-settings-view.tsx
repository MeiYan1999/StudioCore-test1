"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  Copy,
  KeyRound,
  Loader2,
  PauseCircle,
  PlayCircle,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import type { AiAssistantSettings } from "@/lib/services/ai-assistant-service";
import {
  generateDraftWriterKeyAction,
  generateHmacSecretAction,
  saveAiAssistantWebhookAction,
  toggleAiAssistantAction,
  toggleAiAssistantPauseAction,
  toggleBranchAiAssistantAction,
} from "@/lib/actions/ai-assistant-actions";

type Props = {
  initialSettings: AiAssistantSettings;
};

export function AiAssistantSettingsView({ initialSettings }: Props) {
  const [enabled, setEnabled] = useState(initialSettings.enabled);
  const [paused, setPaused] = useState(initialSettings.paused);
  const [branches, setBranches] = useState(initialSettings.branches);
  const [webhookUrl, setWebhookUrl] = useState(initialSettings.webhookUrl);
  const [hmacSecret, setHmacSecret] = useState(initialSettings.hmacSecret);
  const [agentKey, setAgentKey] = useState(initialSettings.agentKey);

  const [isTogglingEnabled, setIsTogglingEnabled] = useState(false);
  const [isTogglingPause, setIsTogglingPause] = useState(false);
  const [isSavingWebhook, setIsSavingWebhook] = useState(false);
  const [isGeneratingSecret, setIsGeneratingSecret] = useState(false);
  const [isGeneratingKey, setIsGeneratingKey] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  const [feedback, setFeedback] = useState<{
    tone: "success" | "danger";
    text: string;
  } | null>(null);

  const handleToggleEnabled = async () => {
    setIsTogglingEnabled(true);
    setFeedback(null);
    const nextState = !enabled;
    try {
      const res = await toggleAiAssistantAction(nextState);
      if (res.ok) {
        setEnabled(nextState);
        setFeedback({ tone: "success", text: res.message });
      } else {
        setFeedback({ tone: "danger", text: res.message });
      }
    } catch (err) {
      setFeedback({
        tone: "danger",
        text: err instanceof Error ? err.message : "Lỗi chuyển trạng thái.",
      });
    } finally {
      setIsTogglingEnabled(false);
    }
  };

  const handleTogglePause = async () => {
    setIsTogglingPause(true);
    setFeedback(null);
    const nextPaused = !paused;
    try {
      const res = await toggleAiAssistantPauseAction(nextPaused);
      if (res.ok) {
        setPaused(nextPaused);
        setFeedback({ tone: "success", text: res.message });
      } else {
        setFeedback({ tone: "danger", text: res.message });
      }
    } catch (err) {
      setFeedback({
        tone: "danger",
        text: err instanceof Error ? err.message : "Lỗi tạm dừng.",
      });
    } finally {
      setIsTogglingPause(false);
    }
  };

  const handleToggleBranch = async (branchId: string, currentEnabled: boolean) => {
    const nextVal = !currentEnabled;
    try {
      const res = await toggleBranchAiAssistantAction(branchId, nextVal);
      if (res.ok) {
        setBranches((prev) =>
          prev.map((b) => (b.id === branchId ? { ...b, enabled: nextVal } : b)),
        );
      }
    } catch (err) {
      console.warn("Failed to toggle branch:", err);
    }
  };

  const handleGenerateSecret = async () => {
    setIsGeneratingSecret(true);
    try {
      const res = await generateHmacSecretAction();
      if (res.ok) {
        setHmacSecret(res.secret);
      }
    } catch (err) {
      console.warn("Failed to generate secret:", err);
    } finally {
      setIsGeneratingSecret(false);
    }
  };

  const handleSaveWebhook = async () => {
    setIsSavingWebhook(true);
    setFeedback(null);
    try {
      const res = await saveAiAssistantWebhookAction(webhookUrl, hmacSecret);
      if (res.ok) {
        setFeedback({ tone: "success", text: res.message });
      } else {
        setFeedback({ tone: "danger", text: res.message });
      }
    } catch (err) {
      setFeedback({
        tone: "danger",
        text: err instanceof Error ? err.message : "Lỗi lưu webhook.",
      });
    } finally {
      setIsSavingWebhook(false);
    }
  };

  const handleGenerateKey = async () => {
    setIsGeneratingKey(true);
    setFeedback(null);
    try {
      const res = await generateDraftWriterKeyAction();
      if (res.ok) {
        setAgentKey(res.key);
        setFeedback({ tone: "success", text: res.message });
      } else {
        setFeedback({ tone: "danger", text: res.message });
      }
    } catch (err) {
      setFeedback({
        tone: "danger",
        text: err instanceof Error ? err.message : "Lỗi tạo khóa.",
      });
    } finally {
      setIsGeneratingKey(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    } catch {
      // Fallback
    }
  };

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Top Header matching StudioBase */}
      <div className="space-y-1">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="-ml-2 h-8 gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <Link href="/manage/settings">
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Cài đặt</span>
          </Link>
        </Button>
        <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
          Trợ lý AI soạn tin
        </h1>
        <p className="text-xs text-muted-foreground sm:text-sm leading-relaxed max-w-3xl">
          Agent bên ngoài soạn bản nháp trong khung chat. Nhân viên bấm Gửi, Sửa
          hoặc Bỏ. StudioCore không tự gửi và không gọi LLM. Mặc định tắt. Bật
          từng chi nhánh khi chạy thử, ví dụ chỉ Xuân Lộc và Phan Thiết.
        </p>
      </div>

      {feedback ? (
        <Alert tone={feedback.tone} className="mt-2">
          {feedback.text}
        </Alert>
      ) : null}

      {/* Card 1: Bật / tắt */}
      <section className="rounded-2xl border border-border bg-surface p-5 shadow-xs">
        <h2 className="text-base font-semibold text-foreground">Bật / tắt</h2>
        <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
          Tắt hoặc tạm dừng sẽ dừng webhook và ẩn bản nháp đang chờ ngay lập tức.
        </p>

        {/* Row 1: Bật trợ lý soạn tin */}
        <div className="mt-4 flex items-center justify-between border-b border-border/60 pb-4">
          <span className="text-sm font-semibold text-foreground">
            Bật trợ lý soạn tin
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            disabled={isTogglingEnabled}
            onClick={handleToggleEnabled}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
              enabled ? "bg-[#0284c7]" : "bg-slate-300 dark:bg-slate-700"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                enabled ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {/* Row 2: Đang chạy theo công tắc & Tạm dừng ngay */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-foreground">
              {paused ? "Đang tạm dừng" : "Đang chạy theo công tắc"}
            </p>
            <p className="text-xs text-muted-foreground">
              Tạm dừng giữ nguyên chi nhánh đã chọn.
            </p>
          </div>

          <Button
            type="button"
            onClick={handleTogglePause}
            disabled={isTogglingPause}
            className={`rounded-xl px-4 py-2 text-xs font-semibold gap-1.5 text-white shadow-xs transition-colors ${
              paused
                ? "bg-emerald-600 hover:bg-emerald-700"
                : "bg-[#dc2626] hover:bg-red-700"
            }`}
          >
            {isTogglingPause ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : paused ? (
              <PlayCircle className="h-4 w-4" />
            ) : (
              <PauseCircle className="h-4 w-4" />
            )}
            <span>{paused ? "Tiếp tục chạy" : "Tạm dừng ngay"}</span>
          </Button>
        </div>
      </section>

      {/* Card 2: Chi nhánh */}
      <section className="rounded-2xl border border-border bg-surface p-5 shadow-xs">
        <h2 className="text-base font-semibold text-foreground">Chi nhánh</h2>
        <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
          Chi nhánh tắt không nhận webhook và không hiện bản nháp. Mặc định tắt
          hết.
        </p>

        <div className="mt-4 divide-y divide-border/60">
          {branches.map((b) => (
            <div
              key={b.id}
              className="flex items-center justify-between py-3.5 first:pt-1 last:pb-1"
            >
              <span className="text-sm font-medium text-foreground">
                {b.name}
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={b.enabled}
                onClick={() => handleToggleBranch(b.id, b.enabled)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                  b.enabled ? "bg-[#0284c7]" : "bg-slate-300 dark:bg-slate-700"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                    b.enabled ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Card 3: Webhook */}
      <section className="rounded-2xl border border-border bg-surface p-5 shadow-xs">
        <h2 className="text-base font-semibold text-foreground">Webhook</h2>
        <p className="mt-1 text-xs text-muted-foreground sm:text-sm leading-relaxed">
          POST JSON khi có tin nhắn khách, sau khoảng 15 giây gom cụm. Chữ ký
          HMAC-SHA256 ở header X-StudioCore-Signature dạng sha256=&lt;hex&gt; của
          timestamp.body.
        </p>

        {/* Webhook URL Input */}
        <div className="mt-4">
          <label className="block text-xs font-semibold text-foreground">
            Webhook URL
          </label>
          <input
            type="url"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            placeholder="https://bot.example.com/studiocore/drafts"
            className="mt-1.5 w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-xs sm:text-sm text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* HMAC Secret Input */}
        <div className="mt-4">
          <label className="block text-xs font-semibold text-foreground">
            HMAC secret
          </label>
          <div className="mt-1.5 flex gap-2">
            <input
              type="text"
              value={hmacSecret}
              onChange={(e) => setHmacSecret(e.target.value)}
              placeholder="Nhập secret hoặc bấm Tạo secret..."
              className="flex-1 rounded-xl border border-border bg-surface px-3.5 py-2.5 text-xs sm:text-sm font-mono text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
            />
            <Button
              type="button"
              variant="outline"
              onClick={handleGenerateSecret}
              disabled={isGeneratingSecret}
              className="rounded-xl px-4 text-xs font-medium shrink-0"
            >
              {isGeneratingSecret ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : null}
              <span>Tạo secret</span>
            </Button>
          </div>
        </div>

        {/* Save button */}
        <div className="mt-4">
          <Button
            type="button"
            onClick={handleSaveWebhook}
            disabled={isSavingWebhook}
            className="rounded-xl bg-[#0284c7] hover:bg-sky-700 text-white px-5 py-2 text-xs font-semibold shadow-xs"
          >
            {isSavingWebhook ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : null}
            <span>Lưu webhook</span>
          </Button>
        </div>
      </section>

      {/* Card 4: Khóa agent */}
      <section className="rounded-2xl border border-border bg-surface p-5 shadow-xs">
        <h2 className="text-base font-semibold text-foreground">Khóa agent</h2>
        <p className="mt-1 text-xs text-muted-foreground sm:text-sm leading-relaxed">
          Khóa scmcp_ scope draft_writer. Chỉ ghi ai_reply_drafts và đọc kết quả /
          hội thoại đã chốt. Không gửi tin cho khách.
        </p>

        <div className="mt-4">
          {agentKey ? (
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                readOnly
                value={agentKey}
                className="flex-1 min-w-[280px] rounded-xl border border-border bg-muted/20 px-3.5 py-2 text-xs font-mono text-foreground focus:outline-hidden"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(agentKey)}
                className="rounded-xl text-xs font-medium gap-1"
              >
                {copiedKey ? (
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                <span>{copiedKey ? "Đã copy" : "Sao chép"}</span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleGenerateKey}
                disabled={isGeneratingKey}
                className="rounded-xl text-xs text-muted-foreground hover:text-foreground"
              >
                {isGeneratingKey ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : null}
                <span>Tạo lại</span>
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={handleGenerateKey}
              disabled={isGeneratingKey}
              className="rounded-xl border-border px-4 py-2 text-xs font-medium hover:bg-muted"
            >
              {isGeneratingKey ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <KeyRound className="mr-1.5 h-3.5 w-3.5" />
              )}
              <span>Tạo khóa draft_writer</span>
            </Button>
          )}
        </div>
      </section>
    </div>
  );
}
