"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, Plus, Send, UserCheck } from "lucide-react";
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
import {
  assignConversationAction,
  createConversationAction,
  sendInboxMessageAction,
  setConversationAiAction,
  setConversationStatusAction,
  simulateInboundAction,
} from "@/lib/actions/operations-actions";
import {
  CONVERSATION_CHANNELS,
  CONVERSATION_CHANNEL_LABELS,
  CONVERSATION_STATUS_LABELS,
} from "@/lib/inbox/constants";

type BranchOption = { id: string; name: string };
type CustomerOption = { id: string; name: string; phone: string };
type StaffOption = { id: string; name: string; code: string };

export function CreateConversationSheet({
  branches,
  customers,
  assignees,
  defaultBranchId,
}: {
  branches: BranchOption[];
  customers: CustomerOption[];
  assignees: StaffOption[];
  defaultBranchId: string;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [state, formAction] = useActionState(
    async (previousState: typeof initialActionState, formData: FormData) => {
      const result = await createConversationAction(previousState, formData);
      if (result.status === "success") {
        toast.success(result.message ?? "Đã tạo hội thoại.");
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
        <Button size="sm">
          <Plus className="h-4 w-4" aria-hidden />
          Hội thoại
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Tạo hội thoại local</SheetTitle>
          <SheetDescription>
            Tin nhắn lưu trong local inbox; Fanpage/Zalo live chưa cấu hình.
          </SheetDescription>
        </SheetHeader>
        <form action={formAction} className="space-y-4">
          {state.status === "error" ? <Alert tone="danger">{state.message}</Alert> : null}
          <div>
            <Label htmlFor="conversation-channel">Kênh</Label>
            <Select id="conversation-channel" name="channel" defaultValue="local" className="mt-1.5">
              {CONVERSATION_CHANNELS.map((channel) => (
                <option key={channel} value={channel}>
                  {CONVERSATION_CHANNEL_LABELS[channel]}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="conversation-branch">Chi nhánh</Label>
            <Select id="conversation-branch" name="branchId" defaultValue={defaultBranchId} className="mt-1.5">
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="conversation-customer">Khách hàng</Label>
            <Select id="conversation-customer" name="customerId" defaultValue="" className="mt-1.5">
              <option value="">Không gắn khách</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name} · {customer.phone}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="conversation-assignee">Phân công</Label>
            <Select id="conversation-assignee" name="assignedTo" defaultValue="" className="mt-1.5">
              <option value="">Chưa phân công</option>
              {assignees.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · {item.code}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="conversation-subject">Chủ đề</Label>
            <Input id="conversation-subject" name="subject" className="mt-1.5" />
          </div>
          <div className="flex justify-end">
            <SubmitButton pendingLabel="Đang lưu...">Tạo hội thoại</SubmitButton>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

export function MessageComposer({ conversationId }: { conversationId: string }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [state, formAction] = useActionState(
    async (previousState: typeof initialActionState, formData: FormData) => {
      const result = await sendInboxMessageAction(previousState, formData);
      if (result.status === "success") {
        setValue("");
        router.refresh();
      } else if (result.status === "error") {
        toast.error(result.message ?? "Không gửi được tin.");
      }
      return result;
    },
    initialActionState,
  );
  return (
    <form action={formAction} className="mt-3 space-y-2 border-t border-border pt-3">
      <input type="hidden" name="conversationId" value={conversationId} />
      <Textarea
        name="content"
        rows={2}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Trả lời khách (lưu local inbox)..."
      />
      {state.status === "error" ? <Alert tone="danger">{state.message}</Alert> : null}
      <div className="flex justify-end">
        <SubmitButton size="sm" pendingLabel="Đang gửi...">
          <Send className="h-4 w-4" aria-hidden />
          Gửi tin
        </SubmitButton>
      </div>
    </form>
  );
}

function AssignForm({
  conversationId,
  assignees,
  assignedTo,
}: {
  conversationId: string;
  assignees: StaffOption[];
  assignedTo: string | null;
}) {
  const router = useRouter();
  const [, formAction] = useActionState(
    async (previousState: typeof initialActionState, formData: FormData) => {
      const result = await assignConversationAction(previousState, formData);
      if (result.status === "success") {
        toast.success(result.message ?? "Đã phân công.");
        router.refresh();
      } else if (result.status === "error") {
        toast.error(result.message ?? "Không phân công được.");
      }
      return result;
    },
    initialActionState,
  );
  return (
    <form action={formAction} className="flex items-center gap-1">
      <input type="hidden" name="conversationId" value={conversationId} />
      <Select name="assignedTo" defaultValue={assignedTo ?? ""} aria-label="Phân công hội thoại" className="max-w-48">
        <option value="">Chưa phân công</option>
        {assignees.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
      </Select>
      <SubmitButton variant="ghost" size="sm" pendingLabel="...">
        <UserCheck className="h-3.5 w-3.5" aria-hidden />
        Gán
      </SubmitButton>
    </form>
  );
}

function StatusForm({
  conversationId,
  status,
}: {
  conversationId: string;
  status: string;
}) {
  const router = useRouter();
  const [, formAction] = useActionState(
    async (previousState: typeof initialActionState, formData: FormData) => {
      const result = await setConversationStatusAction(previousState, formData);
      if (result.status === "success") {
        toast.success(result.message ?? "Đã cập nhật.");
        router.refresh();
      } else if (result.status === "error") {
        toast.error(result.message ?? "Không cập nhật được.");
      }
      return result;
    },
    initialActionState,
  );
  return (
    <form action={formAction}>
      <input type="hidden" name="conversationId" value={conversationId} />
      <input type="hidden" name="status" value={status} />
      <SubmitButton variant="ghost" size="sm" pendingLabel="...">
        {CONVERSATION_STATUS_LABELS[status] ?? status}
      </SubmitButton>
    </form>
  );
}

function AiToggleForm({
  conversationId,
  enabled,
}: {
  conversationId: string;
  enabled: boolean;
}) {
  const router = useRouter();
  const [, formAction] = useActionState(
    async (previousState: typeof initialActionState, formData: FormData) => {
      const result = await setConversationAiAction(previousState, formData);
      if (result.status === "success") {
        toast.success(result.message ?? "Đã cập nhật AI.");
        router.refresh();
      } else if (result.status === "error") {
        toast.error(result.message ?? "Không cập nhật được AI.");
      }
      return result;
    },
    initialActionState,
  );
  return (
    <form action={formAction}>
      <input type="hidden" name="conversationId" value={conversationId} />
      <input type="hidden" name="enabled" value={enabled ? "off" : "on"} />
      <SubmitButton variant="outline" size="sm" pendingLabel="...">
        <Bot className="h-3.5 w-3.5" aria-hidden />
        {enabled ? "Tắt AI auto-reply" : "Bật AI auto-reply"}
      </SubmitButton>
    </form>
  );
}

export function ConversationHeaderActions({
  conversationId,
  assignedTo,
  assignees,
  aiAutoReply,
}: {
  conversationId: string;
  assignedTo: string | null;
  assignees: StaffOption[];
  aiAutoReply: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <AssignForm conversationId={conversationId} assignees={assignees} assignedTo={assignedTo} />
      <StatusForm conversationId={conversationId} status="processing" />
      <StatusForm conversationId={conversationId} status="replied" />
      <AiToggleForm conversationId={conversationId} enabled={aiAutoReply} />
    </div>
  );
}

export function SimulateInboundForm({ conversationId }: { conversationId: string }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [state, formAction] = useActionState(
    async (previousState: typeof initialActionState, formData: FormData) => {
      const result = await simulateInboundAction(previousState, formData);
      if (result.status === "success") {
        toast.success(result.message ?? "Đã mô phỏng tin đến.");
        setValue("");
        router.refresh();
      } else if (result.status === "error") {
        toast.error(result.message ?? "Không mô phỏng được.");
      }
      return result;
    },
    initialActionState,
  );
  return (
    <form action={formAction} className="mt-3 space-y-2 rounded-lg border border-dashed border-border p-3">
      <input type="hidden" name="conversationId" value={conversationId} />
      <Label htmlFor="simulate-inbound">Mô phỏng tin khách đến (demo)</Label>
      <Textarea
        id="simulate-inbound"
        name="content"
        rows={2}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Ví dụ: Cho mình xin bảng giá gói cưới..."
      />
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          AI local chỉ trả lời chủ đề giá/lịch/địa chỉ; ca khó chuyển người thật.
        </p>
        <SubmitButton variant="outline" size="sm" pendingLabel="Đang xử lý...">
          <Bot className="h-4 w-4" aria-hidden />
          Gửi tin đến
        </SubmitButton>
      </div>
      {state.status === "error" ? <Alert tone="danger">{state.message}</Alert> : null}
    </form>
  );
}
