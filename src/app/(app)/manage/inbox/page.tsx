import Link from "next/link";
import { Inbox, MessageSquare } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ForbiddenState } from "@/components/shared/forbidden-state";
import { DateTimeText } from "@/components/shared/date-time";
import {
  ConversationHeaderActions,
  CreateConversationSheet,
  MessageComposer,
  SimulateInboundForm,
} from "@/components/inbox/inbox-controls";
import { hasPermission } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { listCustomerOptions } from "@/lib/services/customer-service";
import {
  getConversation,
  listConversations,
  listInboxAssignees,
} from "@/lib/services/inbox-service";
import {
  CONVERSATION_CHANNELS,
  CONVERSATION_CHANNEL_LABELS,
  CONVERSATION_STATUSES,
  CONVERSATION_STATUS_LABELS,
  messagingAdapterStatus,
} from "@/lib/inbox/constants";
import { cn, formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata = { title: "Inbox" };

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    channel?: string;
    conversationId?: string;
  }>;
}) {
  const actor = await requireActor();
  if (!hasPermission(actor.permissions, "customers.view")) {
    return <ForbiddenState description="Vai trò của bạn không có quyền xem inbox." />;
  }
  const params = await searchParams;
  const db = getDb();
  const conversations = listConversations(db, actor, params);
  const selected =
    conversations.find((item) => item.id === params.conversationId) ??
    conversations[0] ??
    null;
  const detail = selected ? getConversation(db, actor, selected.id) : null;
  const assignees = listInboxAssignees(db, actor);
  const customers = listCustomerOptions(db, actor);
  const canManage = hasPermission(actor.permissions, "customers.manage");
  const adapter = messagingAdapterStatus();
  const defaultBranchId = actor.activeBranchId ?? actor.branches[0]?.id ?? "";
  const query = new URLSearchParams();
  if (params.q) query.set("q", params.q);
  if (params.status) query.set("status", params.status);
  if (params.channel) query.set("channel", params.channel);

  return (
    <div>
      <PageHeader
        title="Inbox"
        description="Local inbox hội thoại Fanpage/Zalo; AI auto-reply có giới hạn chủ đề và human handoff."
        actions={
          canManage ? (
            <CreateConversationSheet
              branches={actor.branches}
              customers={customers}
              assignees={assignees}
              defaultBranchId={defaultBranchId}
            />
          ) : null
        }
      />
      <Alert tone="warning" className="mb-4">
        {adapter.note}
      </Alert>

      <form method="get" className="mb-4 grid gap-3 rounded-xl border border-border bg-surface p-4 sm:grid-cols-4 sm:items-end">
        <div>
          <Label htmlFor="inbox-q">Tìm kiếm</Label>
          <Input id="inbox-q" name="q" defaultValue={params.q ?? ""} placeholder="Khách, chủ đề..." className="mt-1.5" />
        </div>
        <div>
          <Label htmlFor="inbox-status">Trạng thái</Label>
          <Select id="inbox-status" name="status" defaultValue={params.status ?? ""} className="mt-1.5">
            <option value="">Tất cả</option>
            {CONVERSATION_STATUSES.map((status) => (
              <option key={status} value={status}>
                {CONVERSATION_STATUS_LABELS[status]}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="inbox-channel">Kênh</Label>
          <Select id="inbox-channel" name="channel" defaultValue={params.channel ?? ""} className="mt-1.5">
            <option value="">Tất cả</option>
            {CONVERSATION_CHANNELS.map((channel) => (
              <option key={channel} value={channel}>
                {CONVERSATION_CHANNEL_LABELS[channel]}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit" size="sm">Lọc</Button>
      </form>

      {conversations.length === 0 ? (
        <EmptyState
          icon={<Inbox className="h-6 w-6" aria-hidden />}
          title="Chưa có hội thoại"
          description="Tạo hội thoại local hoặc mô phỏng tin khách để thử AI auto-reply."
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
          <aside className="max-h-[70vh] overflow-y-auto rounded-xl border border-border bg-surface">
            <ul className="divide-y divide-border">
              {conversations.map((conversation) => (
                <li key={conversation.id}>
                  <Link
                    href={`/manage/inbox?${new URLSearchParams({
                      ...Object.fromEntries(query),
                      conversationId: conversation.id,
                    }).toString()}`}
                    className={cn(
                      "block px-3 py-3 hover:bg-accent",
                      selected?.id === conversation.id && "bg-accent",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium">
                        {conversation.customerName ?? conversation.subject ?? "Khách chưa gắn"}
                      </p>
                      <Badge
                        tone={
                          conversation.status === "replied"
                            ? "success"
                            : conversation.status === "processing"
                              ? "warning"
                              : "danger"
                        }
                      >
                        {CONVERSATION_STATUS_LABELS[conversation.status]}
                      </Badge>
                    </div>
                    <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                      {conversation.lastMessage ?? "Chưa có tin nhắn"}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {CONVERSATION_CHANNEL_LABELS[conversation.channel]} ·{" "}
                      {conversation.lastMessageAt
                        ? formatDateTime(conversation.lastMessageAt)
                        : "—"}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </aside>

          {detail ? (
            <section className="rounded-xl border border-border bg-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="text-base font-semibold">
                    {detail.conversation.customerName ?? detail.conversation.subject ?? "Hội thoại"}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {CONVERSATION_CHANNEL_LABELS[detail.conversation.channel]} ·{" "}
                    {detail.conversation.branchName} · giao{" "}
                    {detail.conversation.assignedName ?? "chưa"}
                  </p>
                </div>
                {canManage ? (
                  <ConversationHeaderActions
                    conversationId={detail.conversation.id}
                    assignedTo={detail.conversation.assignedTo}
                    assignees={assignees}
                    aiAutoReply={detail.conversation.aiAutoReply}
                  />
                ) : null}
              </div>

              <div className="mt-3 max-h-[45vh] space-y-2 overflow-y-auto rounded-lg bg-surface-muted p-3">
                {detail.messages.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Chưa có tin nhắn trong hội thoại này.
                  </p>
                ) : (
                  detail.messages.map((message) => (
                    <div
                      key={message.id}
                      className={cn(
                        "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                        message.direction === "outbound"
                          ? "ml-auto bg-primary text-primary-foreground"
                          : "bg-surface",
                      )}
                    >
                      <p className="whitespace-pre-wrap">{message.content}</p>
                      <p
                        className={cn(
                          "mt-1 text-[10px]",
                          message.direction === "outbound"
                            ? "text-primary-foreground/70"
                            : "text-muted-foreground",
                        )}
                      >
                        {message.senderName ?? "Khách"} · <DateTimeText value={message.sentAt} />
                      </p>
                    </div>
                  ))
                )}
              </div>

              {canManage ? (
                <>
                  <MessageComposer conversationId={detail.conversation.id} />
                  {process.env.NODE_ENV !== "production" ? (
                    <SimulateInboundForm conversationId={detail.conversation.id} />
                  ) : null}
                </>
              ) : (
                <p className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
                  <MessageSquare className="h-3.5 w-3.5" aria-hidden />
                  Bạn chỉ có quyền xem hội thoại.
                </p>
              )}
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
