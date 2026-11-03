import crypto from "node:crypto";
import { and, asc, eq, isNull } from "drizzle-orm";
import type { AppDb } from "../db/client";
import { activityLogs, branches, settings } from "../db/schema";
import type { ActorContext } from "../auth/types";
import { assertPermission } from "../auth/permissions";
import { NotFoundError, ValidationError } from "../errors";

export function setTenantSetting(
  db: AppDb,
  tenantId: string,
  key: string,
  value: string,
): void {
  const existing = db
    .select({ id: settings.id })
    .from(settings)
    .where(
      and(
        eq(settings.tenantId, tenantId),
        eq(settings.key, key),
        isNull(settings.branchId),
      ),
    )
    .get();
  if (existing) {
    db.update(settings)
      .set({ value, updatedAt: new Date() })
      .where(eq(settings.id, existing.id))
      .run();
    return;
  }
  db.insert(settings)
    .values({
      id: `setting-${key.replace(/[^a-z0-9]+/gi, "-")}-${tenantId}`,
      tenantId,
      key,
      value,
      branchId: null,
    })
    .run();
}

export type StudioSettingsInput = {
  name: string;
  logoUrl: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  taxCode: string;
  bankName: string;
  bankBin: string;
  bankAccountNumber: string;
  bankAccountName: string;
  weekdayHours: string;
  saturdayHours: string;
  sundayHours: string;
  reviewTemplate: string;
  reminderTemplate: string;
};

export function saveStudioSettings(
  db: AppDb,
  actor: ActorContext,
  input: StudioSettingsInput,
): void {
  assertPermission(actor, "settings.manage");
  if (!input.name.trim()) throw new ValidationError("Tên studio là bắt buộc.");
  if (input.bankBin && !/^\d{6}$/.test(input.bankBin)) {
    throw new ValidationError("Bank BIN phải gồm 6 chữ số.");
  }
  if (input.bankAccountNumber && !/^\d{6,19}$/.test(input.bankAccountNumber)) {
    throw new ValidationError("Số tài khoản phải gồm 6–19 chữ số.");
  }
  const workingHours = JSON.stringify({
    monday: input.weekdayHours || "08:00-18:00",
    tuesday: input.weekdayHours || "08:00-18:00",
    wednesday: input.weekdayHours || "08:00-18:00",
    thursday: input.weekdayHours || "08:00-18:00",
    friday: input.weekdayHours || "08:00-18:00",
    saturday: input.saturdayHours || "08:00-17:00",
    sunday: input.sundayHours || "closed",
  });
  const entries: [string, string][] = [
    ["studio.name", input.name.trim()],
    ["studio.logoUrl", input.logoUrl.trim()],
    ["studio.address", input.address.trim()],
    ["studio.phone", input.phone.trim()],
    ["studio.email", input.email.trim()],
    ["studio.website", input.website.trim()],
    ["studio.taxCode", input.taxCode.trim()],
    ["studio.workingHours", workingHours],
    ["payment.bankName", input.bankName.trim()],
    ["payment.bankBin", input.bankBin.trim()],
    ["payment.bankAccountNumber", input.bankAccountNumber.trim()],
    ["payment.bankAccountName", input.bankAccountName.trim()],
    ["notification.reviewTemplate", input.reviewTemplate.trim()],
    ["notification.reminderTemplate", input.reminderTemplate.trim()],
  ];
  db.transaction((tx) => {
    for (const [key, value] of entries) {
      setTenantSetting(tx, actor.tenantId, key, value);
    }
  });
  db.insert(activityLogs)
    .values({
      id: crypto.randomUUID(),
      tenantId: actor.tenantId,
      actorId: actor.staffId,
      action: "settings.studio.update",
      entity: "settings",
      entityId: "studio",
      metadata: JSON.stringify({}),
      createdAt: new Date(),
    })
    .run();
}

export type BranchSettingsView = {
  id: string;
  name: string;
  address: string;
  phone: string;
  status: string;
  workingHours: string;
};

export function listBranchesForSettings(
  db: AppDb,
  actor: ActorContext,
): BranchSettingsView[] {
  assertPermission(actor, "settings.manage");
  return db
    .select({
      id: branches.id,
      name: branches.name,
      address: branches.address,
      phone: branches.phone,
      status: branches.status,
      workingHours: branches.workingHours,
    })
    .from(branches)
    .where(eq(branches.tenantId, actor.tenantId))
    .orderBy(asc(branches.name))
    .all();
}

export function saveBranch(
  db: AppDb,
  actor: ActorContext,
  input: {
    id?: string;
    name: string;
    address: string;
    phone: string;
    status: string;
  },
): string {
  assertPermission(actor, "settings.manage");
  if (!input.name.trim()) throw new ValidationError("Tên chi nhánh là bắt buộc.");
  if (!input.address.trim()) throw new ValidationError("Địa chỉ là bắt buộc.");
  if (!input.phone.trim()) throw new ValidationError("Số điện thoại là bắt buộc.");
  if (!["active", "inactive"].includes(input.status)) {
    throw new ValidationError("Trạng thái chi nhánh không hợp lệ.");
  }
  const duplicate = db
    .select({ id: branches.id })
    .from(branches)
    .where(
      and(
        eq(branches.tenantId, actor.tenantId),
        eq(branches.name, input.name.trim()),
      ),
    )
    .get();
  if (duplicate && duplicate.id !== input.id) {
    throw new ValidationError("Tên chi nhánh đã tồn tại.");
  }
  if (input.id) {
    const existing = db
      .select()
      .from(branches)
      .where(and(eq(branches.id, input.id), eq(branches.tenantId, actor.tenantId)))
      .get();
    if (!existing) throw new NotFoundError("Không tìm thấy chi nhánh.");
    db.update(branches)
      .set({
        name: input.name.trim(),
        address: input.address.trim(),
        phone: input.phone.trim(),
        status: input.status,
        updatedAt: new Date(),
      })
      .where(eq(branches.id, input.id))
      .run();
    db.insert(activityLogs)
      .values({
        id: crypto.randomUUID(),
        tenantId: actor.tenantId,
        actorId: actor.staffId,
        action: "settings.branch.update",
        entity: "branch",
        entityId: input.id,
        metadata: JSON.stringify({}),
        createdAt: new Date(),
      })
      .run();
    return input.id;
  }
  const id = crypto.randomUUID();
  db.insert(branches)
    .values({
      id,
      tenantId: actor.tenantId,
      name: input.name.trim(),
      address: input.address.trim(),
      phone: input.phone.trim(),
      status: input.status,
      workingHours: JSON.stringify({
        monday: "08:00-18:00",
        tuesday: "08:00-18:00",
        wednesday: "08:00-18:00",
        thursday: "08:00-18:00",
        friday: "08:00-18:00",
        saturday: "08:00-17:00",
        sunday: "closed",
      }),
    })
    .run();
  db.insert(activityLogs)
    .values({
      id: crypto.randomUUID(),
      tenantId: actor.tenantId,
      actorId: actor.staffId,
      action: "settings.branch.create",
      entity: "branch",
      entityId: id,
      metadata: JSON.stringify({}),
      createdAt: new Date(),
    })
    .run();
  return id;
}
