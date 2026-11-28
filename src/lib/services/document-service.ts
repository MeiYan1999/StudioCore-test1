import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { and, desc, eq, isNull, or, sql, type SQL } from "drizzle-orm";
import type { AppDb } from "../db/client";
import { documents, customers, orders } from "../db/schema";
import type { ActorContext } from "../auth/types";
import { assertBranchAccess, assertPermission, getBranchScope } from "../auth/permissions";
import { NotFoundError, ValidationError } from "../errors";
import { normalizeVietnamesePhone } from "../utils/phone";
import { writeAudit } from "../audit";
import { getStorageAdapter, getStorageProvider } from "../adapters/storage";
import {
  DOCUMENT_ALLOWED_EXTENSIONS,
  DOCUMENT_CATEGORIES,
  DOCUMENT_MAX_BYTES,
  DOCUMENT_VISIBILITIES,
} from "../documents/constants";

const ROOT = path.join(process.cwd(), "data", "documents");

export type DocumentView = {
  id: string;
  name: string;
  category: string;
  url: string | null;
  storageKey: string | null;
  visibility: string;
  version: number;
  notes: string | null;
  uploadedByName: string | null;
  orderCode: string | null;
  customerName: string | null;
  createdAt: Date;
};

function safeExtension(filename: string): string {
  const extension = filename.split(".").pop()?.toLowerCase() ?? "";
  if (!(DOCUMENT_ALLOWED_EXTENSIONS as readonly string[]).includes(extension)) {
    throw new ValidationError(
      `Định dạng file không hỗ trợ. Cho phép: ${DOCUMENT_ALLOWED_EXTENSIONS.join(", ")}.`,
    );
  }
  return extension;
}

function storagePath(key: string): string {
  const normalized = key.replace(/\\/g, "/").replace(/^\/+/, "");
  if (normalized.includes("..") || path.isAbsolute(normalized)) {
    throw new ValidationError("Storage key tài liệu không hợp lệ.");
  }
  const full = path.join(ROOT, normalized);
  if (!full.startsWith(`${ROOT}${path.sep}`)) {
    throw new ValidationError("Đường dẫn tài liệu không hợp lệ.");
  }
  return full;
}

type DocumentAssociation = { orderCode?: string; customerPhone?: string; branchId: string; visibility: string };

function documentAssociation(db: AppDb, actor: ActorContext, input: DocumentAssociation) {
  if (input.visibility === "branch" && !input.branchId) throw new ValidationError("Chọn chi nhánh cho tài liệu.");
  const order = input.orderCode?.trim() ? db.select().from(orders).where(and(
    eq(orders.tenantId, actor.tenantId), eq(orders.branchId, input.branchId),
    eq(orders.code, input.orderCode.trim().toUpperCase()),
  )).get() : undefined;
  if (input.orderCode?.trim() && !order) throw new ValidationError("Không tìm thấy đơn ở chi nhánh đã chọn.");
  const customer = input.customerPhone?.trim() ? db.select().from(customers).where(and(
    eq(customers.tenantId, actor.tenantId), eq(customers.branchId, input.branchId),
    eq(customers.phone, normalizeVietnamesePhone(input.customerPhone) ?? ""),
  )).get() : undefined;
  if (input.customerPhone?.trim() && (!customer || (order && order.customerId !== customer.id)))
    throw new ValidationError("Khách hàng không khớp với đơn hoặc chi nhánh.");
  return { orderId: order?.id ?? null, customerId: order?.customerId ?? customer?.id ?? null };
}

export function listDocuments(
  db: AppDb,
  actor: ActorContext,
  filters: { q?: string; category?: string } = {},
): DocumentView[] {
  assertPermission(actor, "tasks.view");
  const scope = getBranchScope(actor);
  if (scope.mode === "none") return [];
  const conditions: SQL[] = [eq(documents.tenantId, actor.tenantId)];
  if (scope.mode === "branch") {
    conditions.push(
      or(and(isNull(documents.branchId), eq(documents.visibility, "internal")), eq(documents.branchId, scope.branchId)) ??
        sql`1=0`,
    );
  }
  if (filters.category && (DOCUMENT_CATEGORIES as readonly string[]).includes(filters.category)) {
    conditions.push(eq(documents.category, filters.category));
  }
  if (filters.q?.trim()) {
    conditions.push(
      sql`lower(${documents.name} || ' ' || coalesce(${orders.code}, '') || ' ' || coalesce(${customers.name}, '') || ' ' || coalesce(${customers.phone}, '')) like ${`%${filters.q.trim().toLowerCase()}%`}`,
    );
  }
  return db
    .select({
      id: documents.id,
      name: documents.name,
      category: documents.category,
      url: documents.url,
      storageKey: documents.storageKey,
      visibility: documents.visibility,
      version: documents.version,
      notes: documents.notes,
      orderCode: orders.code, customerName: customers.name,
      uploadedByName: sql<string>`(select name from staff where staff.id = ${documents.uploadedBy})`,
      createdAt: documents.createdAt,
    })
    .from(documents)
    .leftJoin(orders, eq(documents.orderId, orders.id))
    .leftJoin(customers, eq(documents.customerId, customers.id))
    .where(and(...conditions))
    .orderBy(desc(documents.createdAt))
    .limit(300)
    .all();
}

export function createLinkDocument(
  db: AppDb,
  actor: ActorContext,
  input: {
    name: string;
    category: string;
    url: string;
    visibility: string;
    branchId: string;
    notes: string;
    orderCode?: string;
    customerPhone?: string;
  },
): string {
  assertPermission(actor, "tasks.manage");
  if (!input.name.trim()) throw new ValidationError("Tên tài liệu là bắt buộc.");
  if (!/^https:\/\/|^\//.test(input.url.trim())) {
    throw new ValidationError("Link tài liệu phải là HTTPS hoặc đường dẫn nội bộ.");
  }
  if (!DOCUMENT_VISIBILITIES.includes(input.visibility as (typeof DOCUMENT_VISIBILITIES)[number])) {
    throw new ValidationError("Phạm vi tài liệu không hợp lệ.");
  }
  if (input.branchId) assertBranchAccess(actor, input.branchId);
  const association = documentAssociation(db, actor, input);
  const previous = db
    .select({ version: documents.version })
    .from(documents)
    .where(
      and(
        eq(documents.tenantId, actor.tenantId),
        eq(documents.name, input.name.trim()),
        eq(documents.category, input.category || "other"),
        input.branchId ? eq(documents.branchId, input.branchId) : isNull(documents.branchId),
        association.orderId ? eq(documents.orderId, association.orderId) : isNull(documents.orderId),
        association.customerId ? eq(documents.customerId, association.customerId) : isNull(documents.customerId),
      ),
    )
    .orderBy(desc(documents.version))
    .get();
  const id = crypto.randomUUID();
  db.insert(documents)
    .values({
      id,
      tenantId: actor.tenantId,
      branchId: input.branchId || null,
      ...association,
      name: input.name.trim(),
      category: input.category || "other",
      url: input.url.trim(),
      visibility: input.visibility,
      version: (previous?.version ?? 0) + 1,
      notes: input.notes.trim() || null,
      uploadedBy: actor.staffId,
    })
    .run();
  writeAudit(db, {
    tenantId: actor.tenantId,
    actorId: actor.staffId,
    action: "documents.link.create",
    entity: "document",
    entityId: id,
  });
  return id;
}

export async function createUploadedDocument(
  db: AppDb,
  actor: ActorContext,
  input: {
    name: string;
    category: string;
    visibility: string;
    branchId: string;
    notes: string;
    orderCode?: string;
    customerPhone?: string;
    filename: string;
    buffer: Buffer;
  },
): Promise<string> {
  assertPermission(actor, "tasks.manage");
  if (!input.name.trim()) throw new ValidationError("Tên tài liệu là bắt buộc.");
  if (input.buffer.length === 0) throw new ValidationError("File rỗng.");
  if (input.buffer.length > DOCUMENT_MAX_BYTES) {
    throw new ValidationError("File tài liệu vượt quá 20MB.");
  }
  if (!DOCUMENT_VISIBILITIES.includes(input.visibility as (typeof DOCUMENT_VISIBILITIES)[number])) {
    throw new ValidationError("Phạm vi tài liệu không hợp lệ.");
  }
  if (input.branchId) assertBranchAccess(actor, input.branchId);
  const association = documentAssociation(db, actor, input);
  const extension = safeExtension(input.filename);
  const key = `${actor.tenantId}/${crypto.randomUUID()}.${extension}`;
  if (getStorageProvider() === "r2") {
    await getStorageAdapter().put(`documents/${key}`, input.buffer);
  } else {
    const full = storagePath(key);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, input.buffer);
  }
  const previous = db
    .select({ version: documents.version })
    .from(documents)
    .where(
      and(
        eq(documents.tenantId, actor.tenantId),
        eq(documents.name, input.name.trim()),
        eq(documents.category, input.category || "other"),
        input.branchId ? eq(documents.branchId, input.branchId) : isNull(documents.branchId),
        association.orderId ? eq(documents.orderId, association.orderId) : isNull(documents.orderId),
        association.customerId ? eq(documents.customerId, association.customerId) : isNull(documents.customerId),
      ),
    )
    .orderBy(desc(documents.version))
    .get();
  const id = crypto.randomUUID();
  db.insert(documents)
    .values({
      id,
      tenantId: actor.tenantId,
      branchId: input.branchId || null,
      ...association,
      name: input.name.trim(),
      category: input.category || "other",
      storageKey: key,
      visibility: input.visibility,
      version: (previous?.version ?? 0) + 1,
      notes: input.notes.trim() || null,
      uploadedBy: actor.staffId,
    })
    .run();
  writeAudit(db, {
    tenantId: actor.tenantId,
    actorId: actor.staffId,
    action: "documents.file.create",
    entity: "document",
    entityId: id,
    metadata: { size: input.buffer.length, extension },
  });
  return id;
}

export async function getDocumentFile(
  db: AppDb,
  actor: ActorContext,
  documentId: string,
): Promise<{ document: typeof documents.$inferSelect; buffer: Buffer }> {
  assertPermission(actor, "tasks.view");
  const row = db
    .select()
    .from(documents)
    .where(and(eq(documents.id, documentId), eq(documents.tenantId, actor.tenantId)))
    .get();
  if (!row) throw new NotFoundError("Không tìm thấy tài liệu.");
  const scope = getBranchScope(actor);
  if (scope.mode === "none" || (scope.mode === "branch" && (row.branchId ? row.branchId !== scope.branchId : row.visibility !== "internal"))) {
    throw new NotFoundError("Không tìm thấy tài liệu.");
  }
  if (row.branchId) assertBranchAccess(actor, row.branchId);
  if (!row.storageKey) {
    throw new ValidationError("Tài liệu này là link, không có file tải.");
  }
  const absolutePath = storagePath(row.storageKey);
  if (fs.existsSync(absolutePath)) {
    return { document: row, buffer: fs.readFileSync(absolutePath) };
  }
  if (getStorageProvider() === "r2") {
    try {
      return { document: row, buffer: await getStorageAdapter().read(`documents/${row.storageKey}`) };
    } catch (error) {
      if (!(error instanceof Error) || error.name !== "NoSuchKey") throw error;
    }
  }
  throw new NotFoundError("File tài liệu không còn trên storage.");
}
