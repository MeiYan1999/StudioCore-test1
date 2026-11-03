import crypto from "node:crypto";
import { and, desc, eq, isNull, ne, or, sql, type SQL } from "drizzle-orm";
import type { AppDb } from "../db/client";
import {
  aiJobs,
  branches,
  conversations,
  customers,
  messages,
  staff,
} from "../db/schema";
import type { ActorContext } from "../auth/types";
import { assertBranchAccess, assertPermission, getBranchScope } from "../auth/permissions";
import { NotFoundError, ValidationError } from "../errors";
import { writeAudit } from "../audit";
import { getTenantSettings } from "./settings-service";
import { createNotification } from "./notification-service";
import {
  CONVERSATION_CHANNELS,
  CONVERSATION_STATUSES,
} from "../inbox/constants";

export type ConversationView = {
  id: string;
  branchId: string;
  branchName: string;
  customerId: string | null;
  customerName: string | null;
  channel: string;
  subject: string | null;
  assignedTo: string | null;
  assignedName: string | null;
  status: string;
  aiAutoReply: boolean;
  lastMessageAt: Date | null;
  lastMessage: string | null;
};

export type MessageView = {
  id: string;
  direction: string;
  senderName: string | null;
  content: string;
  sentAt: Date;
};

export function listConversations(
  db: AppDb,
  actor: ActorContext,
  filters: { q?: string; status?: string; channel?: string } = {},
): ConversationView[] {
  assertPermission(actor, "customers.view");
  const scope = getBranchScope(actor);
  if (scope.mode === "none") return [];
  const conditions: SQL[] = [eq(conversations.tenantId, actor.tenantId)];
  if (scope.mode === "branch") {
    conditions.push(eq(conversations.branchId, scope.branchId));
  }
  if (filters.status && (CONVERSATION_STATUSES as readonly string[]).includes(filters.status)) {
    conditions.push(eq(conversations.status, filters.status));
  }
  if (filters.channel && (CONVERSATION_CHANNELS as readonly string[]).includes(filters.channel)) {
    conditions.push(eq(conversations.channel, filters.channel));
  }
  if (filters.q?.trim()) {
    const term = `%${filters.q.trim().toLowerCase()}%`;
    const search = or(
      sql`lower(coalesce(${conversations.subject}, '')) like ${term}`,
      sql`lower(coalesce(${customers.name}, '')) like ${term}`,
      sql`lower(coalesce(${customers.phone}, '')) like ${term}`,
    );
    if (search) conditions.push(search);
  }
  return db
    .select({
      id: conversations.id,
      branchId: conversations.branchId,
      branchName: branches.name,
      customerId: conversations.customerId,
      customerName: customers.name,
      channel: conversations.channel,
      subject: conversations.subject,
      assignedTo: conversations.assignedTo,
      assignedName: staff.name,
      status: conversations.status,
      aiAutoReply: conversations.aiAutoReply,
      lastMessageAt: conversations.lastMessageAt,
      lastMessage: sql<string | null>`(
        select content from messages
        where messages.conversation_id = ${conversations.id}
          and messages.tenant_id = ${conversations.tenantId}
        order by messages.sent_at desc limit 1
      )`,
    })
    .from(conversations)
    .innerJoin(branches, eq(conversations.branchId, branches.id))
    .leftJoin(customers, eq(conversations.customerId, customers.id))
    .leftJoin(staff, eq(conversations.assignedTo, staff.id))
    .where(and(...conditions))
    .orderBy(desc(conversations.lastMessageAt), desc(conversations.createdAt))
    .limit(200)
    .all();
}

export function getConversation(
  db: AppDb,
  actor: ActorContext,
  conversationId: string,
): { conversation: ConversationView; messages: MessageView[] } {
  assertPermission(actor, "customers.view");
  const row = listConversations(db, actor).find((item) => item.id === conversationId);
  if (!row) throw new NotFoundError("Không tìm thấy hội thoại.");
  const messageRows = db
    .select({
      id: messages.id,
      direction: messages.direction,
      senderName: messages.senderName,
      content: messages.content,
      sentAt: messages.sentAt,
    })
    .from(messages)
    .where(
      and(
        eq(messages.tenantId, actor.tenantId),
        eq(messages.conversationId, conversationId),
      ),
    )
    .orderBy(messages.sentAt)
    .all();
  return { conversation: row, messages: messageRows };
}

export function createConversation(
  db: AppDb,
  actor: ActorContext,
  input: {
    branchId: string;
    customerId: string;
    channel: string;
    subject: string;
    assignedTo: string;
  },
): string {
  assertPermission(actor, "customers.manage");
  assertBranchAccess(actor, input.branchId);
  if (!(CONVERSATION_CHANNELS as readonly string[]).includes(input.channel)) {
    throw new ValidationError("Kênh hội thoại không hợp lệ.");
  }
  if (input.customerId) {
    const customer = db
      .select({ id: customers.id })
      .from(customers)
      .where(
        and(eq(customers.id, input.customerId), eq(customers.tenantId, actor.tenantId)),
      )
      .get();
    if (!customer) throw new ValidationError("Khách hàng không hợp lệ.");
  }
  const id = crypto.randomUUID();
  db.insert(conversations)
    .values({
      id,
      tenantId: actor.tenantId,
      branchId: input.branchId,
      customerId: input.customerId || null,
      channel: input.channel,
      subject: input.subject.trim() || null,
      assignedTo: input.assignedTo || null,
      status: "unanswered",
      lastMessageAt: new Date(),
    })
    .run();
  writeAudit(db, {
    tenantId: actor.tenantId,
    actorId: actor.staffId,
    action: "inbox.conversation.create",
    entity: "conversation",
    entityId: id,
  });
  return id;
}

function requireConversation(
  db: AppDb,
  actor: ActorContext,
  conversationId: string,
) {
  const row = db
    .select()
    .from(conversations)
    .where(
      and(eq(conversations.id, conversationId), eq(conversations.tenantId, actor.tenantId)),
    )
    .get();
  if (!row) throw new NotFoundError("Không tìm thấy hội thoại.");
  assertBranchAccess(actor, row.branchId);
  return row;
}

export function sendMessage(
  db: AppDb,
  actor: ActorContext,
  conversationId: string,
  content: string,
): void {
  assertPermission(actor, "customers.manage");
  const conversation = requireConversation(db, actor, conversationId);
  if (!content.trim()) throw new ValidationError("Nội dung tin nhắn là bắt buộc.");
  if (content.length > 4000) throw new ValidationError("Tin nhắn quá dài.");
  const now = new Date();
  db.transaction((tx) => {
    tx.insert(messages)
      .values({
        id: crypto.randomUUID(),
        tenantId: actor.tenantId,
        conversationId,
        direction: "outbound",
        senderName: `${actor.staffName} (local)`,
        content: content.trim(),
        sentAt: now,
      })
      .run();
    tx.update(conversations)
      .set({ status: "replied", lastMessageAt: now, updatedAt: now })
      .where(eq(conversations.id, conversationId))
      .run();
  });
  writeAudit(db, {
    tenantId: actor.tenantId,
    actorId: actor.staffId,
    action: "inbox.message.send",
    entity: "conversation",
    entityId: conversationId,
    metadata: { channel: conversation.channel, adapter: "local" },
  });
}

export function assignConversation(
  db: AppDb,
  actor: ActorContext,
  conversationId: string,
  assignedTo: string,
): void {
  assertPermission(actor, "customers.manage");
  requireConversation(db, actor, conversationId);
  if (assignedTo) {
    const assignee = db
      .select({ id: staff.id })
      .from(staff)
      .where(
        and(
          eq(staff.id, assignedTo),
          eq(staff.tenantId, actor.tenantId),
          eq(staff.active, true),
          isNull(staff.archivedAt),
        ),
      )
      .get();
    if (!assignee) throw new ValidationError("Nhân sự không hợp lệ.");
  }
  db.update(conversations)
    .set({ assignedTo: assignedTo || null, status: "processing", updatedAt: new Date() })
    .where(eq(conversations.id, conversationId))
    .run();
  writeAudit(db, {
    tenantId: actor.tenantId,
    actorId: actor.staffId,
    action: "inbox.conversation.assign",
    entity: "conversation",
    entityId: conversationId,
    metadata: { assignedTo },
  });
}

export function setConversationStatus(
  db: AppDb,
  actor: ActorContext,
  conversationId: string,
  status: "unanswered" | "processing" | "replied",
): void {
  assertPermission(actor, "customers.manage");
  requireConversation(db, actor, conversationId);
  if (!(CONVERSATION_STATUSES as readonly string[]).includes(status)) {
    throw new ValidationError("Trạng thái hội thoại không hợp lệ.");
  }
  db.update(conversations)
    .set({ status, updatedAt: new Date() })
    .where(eq(conversations.id, conversationId))
    .run();
  writeAudit(db, {
    tenantId: actor.tenantId,
    actorId: actor.staffId,
    action: "inbox.conversation.status",
    entity: "conversation",
    entityId: conversationId,
    metadata: { status },
  });
}

export function setConversationAi(
  db: AppDb,
  actor: ActorContext,
  conversationId: string,
  enabled: boolean,
): void {
  assertPermission(actor, "customers.manage");
  requireConversation(db, actor, conversationId);
  db.update(conversations)
    .set({ aiAutoReply: enabled, updatedAt: new Date() })
    .where(eq(conversations.id, conversationId))
    .run();
  writeAudit(db, {
    tenantId: actor.tenantId,
    actorId: actor.staffId,
    action: "inbox.ai.toggle",
    entity: "conversation",
    entityId: conversationId,
    metadata: { enabled },
  });
}

function localAutoReply(
  content: string,
  studioAddress: string,
): { reply: string | null; topic: string } {
  const normalized = content.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/gap nguoi|khieu nai|phan nan|bao loi|huy don/.test(normalized)) {
    return { reply: null, topic: "human_handoff" };
  }
  if (/gia|bao gia|bang gia|combo/.test(normalized)) {
    return {
      reply:
        "Cảm ơn bạn đã quan tâm. Studio đã ghi nhận yêu cầu bảng giá; tư vấn viên sẽ gửi thông tin chi tiết trong giờ làm việc.",
      topic: "pricing",
    };
  }
  if (/lich|dat lich|hen|ngay chup/.test(normalized)) {
    return {
      reply:
        "Studio đã nhận yêu cầu đặt lịch. Vui lòng cho studio biết ngày mong muốn và số người để kiểm tra slot trống.",
      topic: "schedule",
    };
  }
  if (/dia chi|o dau|duong di/.test(normalized)) {
    return studioAddress
      ? { reply: `Studio hiện tại: ${studioAddress}. Bạn cần studio hỗ trợ thêm thông tin gì?`, topic: "address" }
      : { reply: null, topic: "address_unconfigured" };
  }
  return { reply: null, topic: "uncertain" };
}

export function simulateInboundMessage(
  db: AppDb,
  actor: ActorContext,
  conversationId: string,
  content: string,
): { reply: string | null; handoff: boolean } {
  assertPermission(actor, "customers.manage");
  const conversation = requireConversation(db, actor, conversationId);
  if (!content.trim()) throw new ValidationError("Nội dung tin đến là bắt buộc.");
  const now = new Date();
  db.insert(messages)
    .values({
      id: crypto.randomUUID(),
      tenantId: actor.tenantId,
      conversationId,
      direction: "inbound",
      senderName: "Khách demo",
      content: content.trim(),
      sentAt: now,
    })
    .run();
  db.update(conversations)
    .set({ status: "unanswered", lastMessageAt: now, updatedAt: now })
    .where(eq(conversations.id, conversationId))
    .run();

  if (!conversation.aiAutoReply) {
    writeAudit(db, {
      tenantId: actor.tenantId,
      actorId: actor.staffId,
      action: "inbox.message.inbound",
      entity: "conversation",
      entityId: conversationId,
    });
    return { reply: null, handoff: true };
  }

  const settings = getTenantSettings(db, actor.tenantId);
  const generated = localAutoReply(
    content,
    settings["studio.address"] ?? "",
  );
  const handoff = generated.reply === null;
  const jobId = crypto.randomUUID();
  if (generated.reply) {
    db.insert(messages)
      .values({
        id: crypto.randomUUID(),
        tenantId: actor.tenantId,
        conversationId,
        direction: "outbound",
        senderName: "AI local",
        content: generated.reply,
        sentAt: new Date(),
      })
      .run();
    db.update(conversations)
      .set({
        status: "replied",
        lastMessageAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(conversations.id, conversationId))
      .run();
  } else {
    db.update(conversations)
      .set({ status: "processing", updatedAt: new Date() })
      .where(eq(conversations.id, conversationId))
      .run();
    const assigneeId = conversation.assignedTo;
    if (assigneeId) {
      createNotification(db, {
        tenantId: actor.tenantId,
        userId: assigneeId,
        type: "inbox_handoff",
        title: "Hội thoại cần người thật",
        content: "AI local không chắc chắn và đã chuyển hội thoại cho nhân sự.",
        link: `/manage/inbox?conversationId=${conversationId}`,
      });
    }
  }
  db.insert(aiJobs)
    .values({
      id: jobId,
      tenantId: actor.tenantId,
      type: "inbox_auto_reply",
      provider: "local",
      status: "completed",
      inputRef: conversationId,
      outputRef: JSON.stringify({
        topic: generated.topic,
        reply: generated.reply,
        handoff,
      }),
      estimatedCost: 0,
      createdBy: actor.staffId,
    })
    .run();
  writeAudit(db, {
    tenantId: actor.tenantId,
    actorId: actor.staffId,
    action: "inbox.ai.reply",
    entity: "conversation",
    entityId: conversationId,
    metadata: { topic: generated.topic, handoff },
  });
  return { reply: generated.reply, handoff };
}

export function listInboxAssignees(db: AppDb, actor: ActorContext) {
  assertPermission(actor, "customers.view");
  return db
    .select({ id: staff.id, name: staff.name, code: staff.code })
    .from(staff)
    .where(
      and(
        eq(staff.tenantId, actor.tenantId),
        eq(staff.active, true),
        isNull(staff.archivedAt),
        ne(staff.role, "platform_admin"),
      ),
    )
    .orderBy(staff.name)
    .all();
}
