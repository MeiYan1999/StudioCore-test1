"use client";

import { useActionState } from "react";
import { BrainCircuit, KeyRound, ShieldCheck } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { SubmitButton } from "@/components/shared/submit-button";
import { initialActionState } from "@/lib/actions/action-state";
import { saveAiSettingsAction } from "@/lib/actions/ai-actions";
import type { AiSettingsView } from "@/lib/services/ai-service";

export function AiSettingsForm({ settings }: { settings: AiSettingsView }) {
  const [state, formAction] = useActionState(
    saveAiSettingsAction,
    initialActionState,
  );

  return (
    <form action={formAction} className="space-y-4">
      {state.status === "error" ? (
        <Alert tone="danger">{state.message}</Alert>
      ) : null}
      {state.status === "success" ? (
        <Alert tone="success">{state.message}</Alert>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label htmlFor="ai-provider">Provider</Label>
          <Select
            id="ai-provider"
            name="provider"
            defaultValue={settings.provider}
            className="mt-1.5"
          >
            <option value="local">Local heuristic (không gửi ảnh ra ngoài)</option>
            <option value="openai">OpenAI (live, cần API key)</option>
            <option value="gemini">Google Gemini (live, cần API key)</option>
          </Select>
          <p className="mt-1 text-xs text-muted-foreground">
            Local chạy bằng sharp/rule-based trong server; không gọi mạng.
          </p>
        </div>
        <div>
          <Label htmlFor="ai-model">Model</Label>
          <Input
            id="ai-model"
            name="model"
            defaultValue={settings.model}
            className="mt-1.5"
            maxLength={120}
          />
        </div>
      </div>

      <div className="rounded-lg border border-border p-3">
        <div className="flex flex-wrap items-center gap-2">
          <KeyRound className="h-4 w-4 text-muted-foreground" aria-hidden />
          <Label htmlFor="ai-api-key">API key</Label>
          <Badge tone={settings.hasApiKey ? "success" : "neutral"}>
            {settings.hasApiKey ? "Đã cấu hình" : "Chưa cấu hình"}
          </Badge>
        </div>
        <Input
          id="ai-api-key"
          name="apiKey"
          type="password"
          autoComplete="new-password"
          placeholder={
            settings.hasApiKey
              ? "Để trống để giữ key hiện tại"
              : "Chưa có key — dán key mới ở đây"
          }
          className="mt-2"
          maxLength={500}
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Key được mã hóa AES-GCM khi lưu và không bao giờ trả lại client. Nếu
          biến môi trường AI_API_KEY được đặt, key env được dùng làm fallback.
        </p>
        {settings.hasApiKey ? (
          <label className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              name="clearApiKey"
              className="h-4 w-4 rounded border-border"
            />
            Xóa key đã lưu
          </label>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label htmlFor="ai-budget">Ngân sách AI tháng (VND)</Label>
          <Input
            id="ai-budget"
            name="budgetVnd"
            type="number"
            min={0}
            step={1}
            defaultValue={settings.budgetVnd}
            className="mt-1.5"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Cost guard chặn job live nếu ước tính vượt ngân sách. 0 = chưa đặt
            ngân sách; job live có phí sẽ bị chặn.
          </p>
        </div>
        <div>
          <Label htmlFor="ai-cost">Chi phí ước tính mỗi ảnh (VND)</Label>
          <Input
            id="ai-cost"
            name="costPerImageVnd"
            type="number"
            min={0}
            step={10}
            defaultValue={settings.costPerImageVnd}
            className="mt-1.5"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Chỉ dùng để ước tính và chặn ngân sách; không phải hóa đơn thực tế.
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-border p-3">
        <div className="flex items-start gap-2">
          <ShieldCheck className="mt-0.5 h-4 w-4 text-primary" aria-hidden />
          <div>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                name="consent"
                defaultChecked={settings.consent}
                className="mt-0.5 h-4 w-4 rounded border-border"
              />
              <span>
                <span className="font-medium text-foreground">
                  Tôi đồng ý gửi ảnh khách cho AI provider bên ngoài
                </span>
                <span className="block text-xs text-muted-foreground">
                  Bắt buộc với provider live. Local heuristic không gửi ảnh ra
                  ngoài và không cần consent.
                </span>
              </span>
            </label>
          </div>
        </div>
      </div>

      <div className="rounded-lg bg-surface-muted p-3">
        <p className="text-sm font-medium text-foreground">Bật tính năng phân tích</p>
        <div className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="featureBlur"
              defaultChecked={settings.features.blur}
              className="h-4 w-4 rounded border-border"
            />
            Cảnh báo mờ (blur heuristic)
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="featureExposure"
              defaultChecked={settings.features.exposure}
              className="h-4 w-4 rounded border-border"
            />
            Thiếu sáng / quá sáng
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="featureDuplicate"
              defaultChecked={settings.features.duplicate}
              className="h-4 w-4 rounded border-border"
            />
            Ảnh gần trùng (perceptual hash)
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="featureBurst"
              defaultChecked={settings.features.burst}
              className="h-4 w-4 rounded border-border"
            />
            Gợi ý giữ ảnh nét nhất trong burst
          </label>
          <label className="flex items-center gap-2 text-muted-foreground">
            <input
              type="checkbox"
              checked={false}
              disabled
              className="h-4 w-4 rounded border-border"
            />
            Phát hiện nhắm mắt — chưa hỗ trợ
          </label>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Không có model phát hiện mắt; hệ thống hiển thị “chưa hỗ trợ” thay vì
          đọc EXIF và giả vờ phát hiện.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <BrainCircuit className="h-3.5 w-3.5" aria-hidden />
          Chạy phân tích trong trang album; mọi job đều ghi log và chi phí ước tính.
        </p>
        <SubmitButton pendingLabel="Đang lưu...">Lưu cấu hình AI</SubmitButton>
      </div>
    </form>
  );
}
