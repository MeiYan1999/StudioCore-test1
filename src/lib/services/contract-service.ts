import { and, desc, eq, like } from "drizzle-orm";
import type { AppDb } from "../db/client";
import {
  appointments,
  customers,
  orders,
  orderItems,
  orderStatusHistory,
  payments,
  transactions,
} from "../db/schema";
import type { ActorContext } from "../auth/types";
import { assertBranchAccess, assertPermission } from "../auth/permissions";
import { ValidationError } from "../errors";
import { writeAudit } from "../audit";
import { parseVietnamDateTimeLocal } from "../utils";
import { normalizeVietnamesePhone } from "../utils/phone";

export interface ContractSessionInput {
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  location?: string;
  roomId?: string | null;
  photographerId?: string | null;
  makeupId?: string | null;
  editorId?: string | null;
  notes?: string;
}

export interface ContractCreateInput {
  code?: string;
  signedAt?: string; // YYYY-MM-DD
  customerName: string;
  customerPhone: string;
  branchId: string;
  serviceCategory?: string;
  serviceId?: string | null;
  packageName: string;
  crewConfig?: string;
  surcharge?: number;
  surchargeNote?: string;
  total: number;
  deposit?: number;
  depositMethod?: "bank_transfer" | "cash" | "vietqr" | "card";
  notes?: string;
  sessions: ContractSessionInput[];
}

export function getNextContractCode(db: AppDb, tenantId: string): string {
  const existingOrders = db
    .select({ code: orders.code })
    .from(orders)
    .where(and(eq(orders.tenantId, tenantId), like(orders.code, "HD%")))
    .all();

  let maxNum = 0;
  for (const row of existingOrders) {
    const match = row.code.match(/^HD(\d+)$/i);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
    }
  }

  const nextNum = maxNum + 1;
  return `HD${String(nextNum).padStart(5, "0")}`;
}

export function createContractWithAppointments(
  db: AppDb,
  actor: ActorContext,
  input: ContractCreateInput,
): { orderId: string; code: string; customerId: string; appointmentIds: string[] } {
  assertPermission(actor, "orders.manage");
  assertBranchAccess(actor, input.branchId);

  const customerName = input.customerName.trim();
  const customerPhone = normalizeVietnamesePhone(input.customerPhone);
  if (!customerName) {
    throw new ValidationError("Tên khách hàng là bắt buộc.");
  }
  if (!customerPhone) {
    throw new ValidationError("Số điện thoại khách hàng không hợp lệ.");
  }

  const total = Math.max(0, Math.floor(input.total || 0));
  const surcharge = Math.max(0, Math.floor(input.surcharge || 0));
  const deposit = Math.min(total, Math.max(0, Math.floor(input.deposit || 0)));
  const depositMethod = input.depositMethod || "bank_transfer";
  const mappedMethod = depositMethod === "vietqr" ? "bank_transfer" : depositMethod;

  const now = new Date();
  const orderId = crypto.randomUUID();

  // Find or generate unique contract code
  let code = (input.code || "").trim().toUpperCase();
  if (!code) {
    code = getNextContractCode(db, actor.tenantId);
  }

  // Ensure code uniqueness in tenant
  const existingCode = db
    .select({ id: orders.id })
    .from(orders)
    .where(and(eq(orders.tenantId, actor.tenantId), eq(orders.code, code)))
    .get();

  if (existingCode) {
    code = `${code}-${Math.floor(100 + Math.random() * 900)}`;
  }

  const createdAppointmentIds: string[] = [];

  const result = db.transaction((tx) => {
    // 1. Customer: find existing by phone or create new
    let customer = tx
      .select({ id: customers.id })
      .from(customers)
      .where(
        and(
          eq(customers.tenantId, actor.tenantId),
          eq(customers.phone, customerPhone),
        ),
      )
      .get();

    let customerId: string;
    if (customer) {
      customerId = customer.id;
      // Update customer name if provided
      tx.update(customers)
        .set({ name: customerName, updatedAt: now })
        .where(eq(customers.id, customerId))
        .run();
    } else {
      customerId = crypto.randomUUID();
      tx.insert(customers)
        .values({
          id: customerId,
          tenantId: actor.tenantId,
          branchId: input.branchId,
          name: customerName,
          phone: customerPhone,
          status: "active",
          source: "walk_in",
          tier: "standard",
          tags: "[]",
          measurements: "{}",
          ownerId: actor.staffId,
        })
        .run();
    }

    // 2. Prepare shoot sessions & scheduling
    const validSessions = (input.sessions || []).filter(
      (s) => s.date && s.startTime && s.endTime,
    );

    let firstScheduledAt: Date | null = null;
    let firstLocation = "";
    let firstPhotographerId: string | null = null;
    let firstMakeupId: string | null = null;
    let firstEditorId: string | null = null;

    if (validSessions.length > 0) {
      const s0 = validSessions[0];
      firstScheduledAt = parseVietnamDateTimeLocal(`${s0.date}T${s0.startTime}`);
      firstLocation = s0.location?.trim() || "";
      firstPhotographerId = s0.photographerId || null;
      firstMakeupId = s0.makeupId || null;
      firstEditorId = s0.editorId || null;
    } else if (input.signedAt) {
      firstScheduledAt = parseVietnamDateTimeLocal(`${input.signedAt}T09:00`);
    }

    // 3. Create Order
    const subtotal = Math.max(0, total - surcharge);
    const paid = deposit;
    const remaining = Math.max(0, total - paid);
    const orderStatus = deposit > 0 ? "deposit_received" : "new";

    const formattedNotes = [
      input.notes?.trim() ? `[Ghi chú HĐ]: ${input.notes.trim()}` : "",
      input.serviceCategory ? `[Phân loại]: ${input.serviceCategory}` : "",
      input.surchargeNote?.trim() ? `[Phát sinh]: ${input.surchargeNote.trim()}` : "",
      input.crewConfig ? `[Ê-kíp]: ${input.crewConfig}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    tx.insert(orders)
      .values({
        id: orderId,
        tenantId: actor.tenantId,
        branchId: input.branchId,
        code,
        customerId,
        status: orderStatus,
        photographerId: firstPhotographerId,
        editorId: firstEditorId,
        makeupId: firstMakeupId,
        scheduledAt: firstScheduledAt,
        location: firstLocation || null,
        subtotal,
        surcharge,
        discount: 0,
        total,
        deposit,
        paid,
        remaining,
        notes: formattedNotes || null,
        contractConfirmedAt: now,
        contractConfirmedBy: actor.staffId,
        createdBy: actor.staffId,
      })
      .run();

    // 4. Create Order Items
    tx.insert(orderItems)
      .values({
        id: crypto.randomUUID(),
        tenantId: actor.tenantId,
        orderId,
        itemType: "service",
        refId: input.serviceId || null,
        name: input.packageName || "Gói chụp hợp đồng studio",
        quantity: 1,
        unitPrice: subtotal,
        total: subtotal,
        sortOrder: 0,
      })
      .run();

    if (surcharge > 0) {
      tx.insert(orderItems)
        .values({
          id: crypto.randomUUID(),
          tenantId: actor.tenantId,
          orderId,
          itemType: "custom",
          refId: null,
          name: input.surchargeNote?.trim() || "Chi phí phát sinh",
          quantity: 1,
          unitPrice: surcharge,
          total: surcharge,
          sortOrder: 1,
        })
        .run();
    }

    // 5. If deposit > 0, record Payment & Cashflow Transaction
    if (deposit > 0) {
      const paymentId = crypto.randomUUID();
      tx.insert(payments)
        .values({
          id: paymentId,
          tenantId: actor.tenantId,
          orderId,
          amount: deposit,
          method: mappedMethod,
          status: "completed",
          reference: `COC-${code}`,
          idempotencyKey: `contract-${orderId}-deposit`,
          paidAt: now,
          createdBy: actor.staffId,
        })
        .run();

      tx.insert(transactions)
        .values({
          id: crypto.randomUUID(),
          tenantId: actor.tenantId,
          branchId: input.branchId,
          type: "income",
          category: "order_payment",
          amount: deposit,
          orderId,
          customerId,
          staffId: actor.staffId,
          method: mappedMethod,
          description: `Thu cọc đợt 1 HĐ ${code} (${customerName})`,
          occurredAt: now,
          createdBy: actor.staffId,
        })
        .run();
    }

    // 6. Create Shoot Appointments (Lịch chụp) for all sessions
    for (let i = 0; i < validSessions.length; i++) {
      const s = validSessions[i];
      const startAt = parseVietnamDateTimeLocal(`${s.date}T${s.startTime}`);
      const endAt = parseVietnamDateTimeLocal(`${s.date}T${s.endTime}`);

      if (startAt && endAt) {
        const appointmentId = crypto.randomUUID();
        createdAppointmentIds.push(appointmentId);

        const sessionTitle =
          validSessions.length > 1
            ? `HĐ ${code} (Buổi ${i + 1}) - ${customerName}`
            : `HĐ ${code} - ${customerName}`;

        const loc = s.location?.trim() ? ` · ${s.location.trim()}` : "";

        tx.insert(appointments)
          .values({
            id: appointmentId,
            tenantId: actor.tenantId,
            branchId: input.branchId,
            orderId,
            roomId: s.roomId || null,
            photographerId: s.photographerId || null,
            makeupId: s.makeupId || null,
            editorId: s.editorId || null,
            startAt,
            endAt,
            bufferMinutes: 30,
            status: "scheduled",
            idempotencyKey: `contract-${orderId}-session-${i + 1}-${startAt.getTime()}`,
            notes: `${sessionTitle}${loc}${s.notes ? ` · ${s.notes}` : ""}`,
            createdBy: actor.staffId,
          })
          .run();
      }
    }

    // 7. Order Status History
    tx.insert(orderStatusHistory)
      .values({
        id: crypto.randomUUID(),
        tenantId: actor.tenantId,
        orderId,
        fromStatus: null,
        toStatus: orderStatus,
        note: `Khởi tạo hợp đồng dịch vụ mới ${code} và lên kế hoạch ${validSessions.length} buổi chụp.`,
        changedBy: actor.staffId,
        createdAt: now,
      })
      .run();

    return { orderId, code, customerId, appointmentIds: createdAppointmentIds };
  });

  writeAudit(db, {
    tenantId: actor.tenantId,
    actorId: actor.staffId,
    action: "contract.create",
    entity: "order",
    entityId: orderId,
    metadata: {
      code,
      customerName,
      customerPhone,
      total,
      deposit,
      sessionsCount: input.sessions.length,
    },
  });

  return result;
}
