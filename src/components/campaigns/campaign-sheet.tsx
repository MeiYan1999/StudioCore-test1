"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Megaphone, Plus } from "lucide-react";
import { toast } from "sonner";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { SubmitButton } from "@/components/shared/submit-button";
import { initialActionState } from "@/lib/actions/action-state";
import { saveCampaignAction } from "@/lib/actions/operations-actions";
import {
  CAMPAIGN_SOURCES,
  CAMPAIGN_SOURCE_LABELS,
  CAMPAIGN_STATUSES,
  CAMPAIGN_STATUS_LABELS,
} from "@/lib/campaigns/constants";
import type { CampaignView } from "@/lib/services/campaign-service";

type BranchOption = { id: string; name: string };

export function CampaignSheet({
  campaign,
  branches,
  defaultBranchId,
}: {
  campaign?: CampaignView;
  branches: BranchOption[];
  defaultBranchId: string;
}) {
  const isEdit = Boolean(campaign);
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [state, formAction] = useActionState(
    async (previousState: typeof initialActionState, formData: FormData) => {
      const result = await saveCampaignAction(previousState, formData);
      if (result.status === "success") {
        toast.success(result.message ?? "Đã lưu chiến dịch.");
        setOpen(false);
        router.refresh();
      }
      return result;
    },
    initialActionState,
  );
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant={isEdit ? "ghost" : "primary"} size="sm">
          {isEdit ? "Sửa" : <><Plus className="h-4 w-4" aria-hidden />Chiến dịch</>}
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{isEdit ? "Sửa chiến dịch" : "Tạo chiến dịch"}</SheetTitle>
          <SheetDescription>
            Số liệu nhập tay; chưa kết nối Meta/TikTok Ads nên không gọi mạng.
          </SheetDescription>
        </SheetHeader>
        <form action={formAction} className="space-y-4">
          {state.status === "error" ? <Alert tone="danger">{state.message}</Alert> : null}
          {campaign ? <input type="hidden" name="campaignId" value={campaign.id} /> : null}
          <div>
            <Label htmlFor="campaign-name">Tên chiến dịch</Label>
            <Input id="campaign-name" name="name" defaultValue={campaign?.name ?? ""} required className="mt-1.5" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="campaign-source">Nguồn</Label>
              <Select id="campaign-source" name="source" defaultValue={campaign?.source ?? "facebook"} className="mt-1.5">
                {CAMPAIGN_SOURCES.map((source) => (
                  <option key={source} value={source}>
                    {CAMPAIGN_SOURCE_LABELS[source]}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="campaign-branch">Chi nhánh</Label>
              <Select id="campaign-branch" name="branchId" defaultValue={campaign?.branchId ?? defaultBranchId} className="mt-1.5">
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="campaign-status">Trạng thái</Label>
              <Select id="campaign-status" name="status" defaultValue={campaign?.status ?? "active"} className="mt-1.5">
                {CAMPAIGN_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {CAMPAIGN_STATUS_LABELS[status]}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="campaign-budget">Ngân sách</Label>
              <Input id="campaign-budget" name="budget" type="number" min={0} defaultValue={campaign?.budget ?? 0} className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="campaign-spend">Đã chi</Label>
              <Input id="campaign-spend" name="spend" type="number" min={0} defaultValue={campaign?.spend ?? 0} className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="campaign-leads">Leads</Label>
              <Input id="campaign-leads" name="leads" type="number" min={0} defaultValue={campaign?.leads ?? 0} className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="campaign-orders">Đơn</Label>
              <Input id="campaign-orders" name="ordersCount" type="number" min={0} defaultValue={campaign?.ordersCount ?? 0} className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="campaign-revenue">Doanh thu</Label>
              <Input id="campaign-revenue" name="revenue" type="number" min={0} defaultValue={campaign?.revenue ?? 0} className="mt-1.5" />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="campaign-start">Bắt đầu</Label>
              <Input id="campaign-start" name="startAt" type="datetime-local" className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="campaign-end">Kết thúc</Label>
              <Input id="campaign-end" name="endAt" type="datetime-local" className="mt-1.5" />
            </div>
          </div>
          <div>
            <Label htmlFor="campaign-notes">Ghi chú</Label>
            <Textarea id="campaign-notes" name="notes" rows={2} defaultValue={campaign?.notes ?? ""} className="mt-1.5" />
          </div>
          <div className="flex justify-end">
            <SubmitButton pendingLabel="Đang lưu...">
              <Megaphone className="h-4 w-4" aria-hidden />
              Lưu chiến dịch
            </SubmitButton>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
