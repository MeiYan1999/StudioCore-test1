import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import type { AppDb } from "../db/client";
import {
  conversations,
  facebookDeliveries,
  facebookPages,
  facebookThreads,
  messages,
} from "../db/schema";

export const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export function metaConfig() {
  const {
    META_APP_ID,
    META_APP_SECRET,
    META_GRAPH_VERSION,
    META_REDIRECT_URI,
    META_TOKEN_KEY,
    META_VERIFY_TOKEN,
  } = process.env;
  if (
    !META_APP_ID ||
    !META_APP_SECRET ||
    !META_GRAPH_VERSION?.match(/^v\d+\.0$/) ||
    !META_REDIRECT_URI ||
    !META_TOKEN_KEY ||
    !META_VERIFY_TOKEN
  ) {
    throw new Error(
      "Facebook chưa sẵn sàng. Chủ hệ thống cần cấu hình Meta App, phiên bản API, callback HTTPS và khóa mã hóa.",
    );
  }
  if (!META_REDIRECT_URI.startsWith("https://"))
    throw new Error("Meta callback phải dùng HTTPS.");
  if (Buffer.from(META_TOKEN_KEY, "base64").length !== 32)
    throw new Error("META_TOKEN_KEY phải là khóa base64 32 byte.");
  return {
    appId: META_APP_ID,
    secret: META_APP_SECRET,
    version: META_GRAPH_VERSION,
    redirect: META_REDIRECT_URI,
    key: Buffer.from(META_TOKEN_KEY, "base64"),
    verify: META_VERIFY_TOKEN,
  };
}
export function seal(token: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", metaConfig().key, iv);
  const data = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString("base64");
}
export function unseal(value: string) {
  const data = Buffer.from(value, "base64");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    metaConfig().key,
    data.subarray(0, 12),
  );
  decipher.setAuthTag(data.subarray(12, 28));
  return Buffer.concat([
    decipher.update(data.subarray(28)),
    decipher.final(),
  ]).toString("utf8");
}
export function validSignature(
  body: Buffer,
  signature: string | null,
  secret = metaConfig().secret,
) {
  if (!signature?.match(/^sha256=[a-f0-9]{64}$/)) return false;
  const expected = createHmac("sha256", secret).update(body).digest();
  return timingSafeEqual(expected, Buffer.from(signature.slice(7), "hex"));
}
export class MetaError extends Error {
  constructor(
    public code: number,
    message: string,
  ) {
    super(message);
  }
}
export async function graph<T>(
  path: string,
  token: string,
  body?: object,
  method?: string,
): Promise<T> {
  const config = metaConfig();
  const url = new URL(`https://graph.facebook.com/${config.version}/${path}`);
  url.searchParams.set(
    "appsecret_proof",
    createHmac("sha256", config.secret).update(token).digest("hex"),
  );
  const response = await fetch(url, {
    method: method ?? (body ? "POST" : "GET"),
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
    cache: "no-store",
  });
  const data = await response.json();
  if (!response.ok || data.error)
    throw new MetaError(
      data.error?.code ?? response.status,
      data.error?.message ?? "Meta không phản hồi thành công",
    );
  return data as T;
}
export type MetaEvent = {
  sender?: { id: string };
  recipient?: { id: string };
  timestamp?: number;
  message?: {
    mid?: string;
    text?: string;
    is_echo?: boolean;
    metadata?: string;
    attachments?: { type: string; payload?: { url?: string } }[];
  };
  delivery?: { mids?: string[] };
  read?: { watermark?: number };
};
export function ingestWebhook(
  db: AppDb,
  payload: {
    object?: string;
    entry?: { id: string; messaging?: MetaEvent[] }[];
  },
) {
  if (payload.object !== "page") return;
  db.transaction(
    (tx) => {
      for (const entry of payload.entry ?? []) {
        const page = tx
          .select()
          .from(facebookPages)
          .where(eq(facebookPages.id, entry.id))
          .get();
        if (!page || page.status !== "connected") continue;
        tx.update(facebookPages)
          .set({ lastEventAt: Date.now() })
          .where(eq(facebookPages.id, page.id))
          .run();
        for (const event of entry.messaging ?? []) {
          const echo = event.message?.is_echo === true;
          const psid = echo ? event.recipient?.id : event.sender?.id;
          if (!psid || psid === page.id) continue;
          let thread = tx
            .select()
            .from(facebookThreads)
            .where(
              and(
                eq(facebookThreads.pageId, page.id),
                eq(facebookThreads.psid, psid),
              ),
            )
            .get();
          if (!thread && event.message?.mid) {
            const id = crypto.randomUUID();
            tx.insert(conversations)
              .values({
                id,
                tenantId: page.tenantId,
                branchId: page.branchId,
                channel: "facebook",
                subject: `Khách Facebook ${psid.slice(-6)}`,
              })
              .run();
            tx.insert(facebookThreads)
              .values({ conversationId: id, pageId: page.id, psid })
              .run();
            thread = tx
              .select()
              .from(facebookThreads)
              .where(eq(facebookThreads.conversationId, id))
              .get();
          }
          if (!thread) continue;
          for (const mid of event.delivery?.mids ?? [])
            tx.update(facebookDeliveries)
              .set({ status: "delivered" })
              .where(
                and(
                  eq(facebookDeliveries.messageId, mid),
                  eq(facebookDeliveries.conversationId, thread.conversationId),
                ),
              )
              .run();
          if (event.read?.watermark)
            tx.run(
              sql`UPDATE facebook_deliveries SET status='read' WHERE conversation_id=${thread.conversationId} AND id IN (SELECT id FROM messages WHERE direction='outbound' AND sent_at<=${event.read.watermark}) AND status IN ('sent','delivered')`,
            );
          const msg = event.message;
          if (!msg?.mid) continue;
          if (
            tx
              .select()
              .from(facebookDeliveries)
              .where(eq(facebookDeliveries.messageId, msg.mid))
              .get()
          )
            continue;
          // Our echoed metadata reconciles a send even if the HTTP response was lost.
          const pending =
            echo && msg.metadata
              ? tx
                  .select()
                  .from(facebookDeliveries)
                  .where(
                    and(
                      eq(facebookDeliveries.id, msg.metadata),
                      eq(
                        facebookDeliveries.conversationId,
                        thread.conversationId,
                      ),
                    ),
                  )
                  .get()
              : null;
          if (pending) {
            tx.update(facebookDeliveries)
              .set({ messageId: msg.mid, status: "sent", error: null })
              .where(eq(facebookDeliveries.id, pending.id))
              .run();
            continue;
          }
          const at = Math.min(
            Number(event.timestamp) || Date.now(),
            Date.now(),
          );
          const id = crypto.randomUUID();
          const attachment = msg.attachments?.find((a) => a.payload?.url)
            ?.payload?.url;
          tx.insert(messages)
            .values({
              id,
              tenantId: page.tenantId,
              conversationId: thread.conversationId,
              direction: echo ? "outbound" : "inbound",
              content:
                msg.text ??
                (attachment
                  ? "[Ảnh / tệp đính kèm]"
                  : "[Tin nhắn chưa hỗ trợ]"),
              externalId: msg.mid,
              sentAt: new Date(at),
            })
            .run();
          tx.insert(facebookDeliveries)
            .values({
              id,
              conversationId: thread.conversationId,
              messageId: msg.mid,
              status: echo ? "sent" : "received",
              attachment,
            })
            .run();
          tx.update(conversations)
            .set({
              lastMessageAt: sql`max(coalesce(last_message_at,0),${at})`,
              updatedAt: new Date(),
            })
            .where(eq(conversations.id, thread.conversationId))
            .run();
          if (!echo)
            tx.update(facebookThreads)
              .set({ lastInboundAt: sql`max(last_inbound_at,${at})` })
              .where(eq(facebookThreads.conversationId, thread.conversationId))
              .run();
        }
      }
    },
    { behavior: "immediate" },
  );
}
export function sendBlockReason(
  page: { status: string; token: string | null },
  lastInbound: number,
) {
  try {
    metaConfig();
  } catch (error) {
    return (error as Error).message;
  }
  if (page.status !== "connected" || !page.token)
    return "Fanpage mất kết nối. Chủ studio cần kết nối lại.";
  if (Date.now() - lastInbound >= 86400000)
    return "Đã ngoài cửa sổ phản hồi 24 giờ của Meta. Cần khách nhắn lại trước khi gửi.";
  return null;
}
export async function sendFacebook(
  db: AppDb,
  conversationId: string,
  content: string,
  requestId: string,
  attachment?: string,
) {
  const thread = db
    .select()
    .from(facebookThreads)
    .where(eq(facebookThreads.conversationId, conversationId))
    .get();
  if (!thread) throw new Error("Hội thoại chưa liên kết Facebook.");
  const page = db
    .select()
    .from(facebookPages)
    .where(eq(facebookPages.id, thread.pageId))
    .get()!;
  const reason = sendBlockReason(page, thread.lastInboundAt);
  if (reason) throw new Error(reason);
  if (!content.trim() && !attachment)
    throw new Error("Nhập nội dung tin nhắn.");
  if (content.length > 2000) throw new Error("Tối đa 2000 ký tự.");
  if (attachment && !attachment.startsWith("https://"))
    throw new Error("Ảnh phải có URL HTTPS công khai.");
  const id = digest(`${conversationId}:${requestId}`);
  const existing = db
    .select()
    .from(facebookDeliveries)
    .where(eq(facebookDeliveries.id, id))
    .get();
  if (existing) return existing;
  db.transaction(
    (tx) => {
      tx.insert(messages)
        .values({
          id,
          tenantId: page.tenantId,
          conversationId,
          direction: "outbound",
          content: content || "[Ảnh]",
          sentAt: new Date(),
        })
        .run();
      tx.insert(facebookDeliveries)
        .values({ id, conversationId, status: "sending", attachment })
        .run();
    },
    { behavior: "immediate" },
  );
  try {
    const response = await graph<{ message_id: string }>(
      `${page.id}/messages`,
      unseal(page.token!),
      {
        recipient: { id: thread.psid },
        messaging_type: "RESPONSE",
        message: {
          ...(attachment
            ? {
                attachment: {
                  type: "image",
                  payload: { url: attachment, is_reusable: true },
                },
              }
            : { text: content }),
          metadata: id,
        },
      },
    );
    db.update(facebookDeliveries)
      .set({ status: "sent", messageId: response.message_id })
      .where(eq(facebookDeliveries.id, id))
      .run();
    db.update(conversations)
      .set({ lastMessageAt: new Date(), status: "replied" })
      .where(eq(conversations.id, conversationId))
      .run();
  } catch (error) {
    const confirmed = db
      .select()
      .from(facebookDeliveries)
      .where(eq(facebookDeliveries.id, id))
      .get();
    if (confirmed?.messageId) return confirmed;
    db.update(facebookDeliveries)
      .set({
        status: error instanceof MetaError ? "failed" : "unknown",
        error:
          error instanceof MetaError
            ? error.message
            : "Chưa xác định Meta đã nhận tin. Kiểm tra Messenger trước khi gửi lại.",
      })
      .where(eq(facebookDeliveries.id, id))
      .run();
    if (error instanceof MetaError && [190, 10, 200].includes(error.code))
      db.update(facebookPages)
        .set({ status: "reauth" })
        .where(eq(facebookPages.id, page.id))
        .run();
  }
  return db
    .select()
    .from(facebookDeliveries)
    .where(eq(facebookDeliveries.id, id))
    .get();
}
