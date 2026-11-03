import { count, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import path from "node:path";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { createDb } from "@/lib/db/client";
import { seedDatabase } from "@/lib/db/seed";
import {
  albumFolders,
  attendance,
  budgets,
  campaigns,
  commissionRules,
  commissions,
  conversations,
  documents,
  expenses,
  invoices,
  messages,
  payrolls,
  taskComments,
  tasks,
  transactions,
  albums,
  appointments,
  branches,
  customerInteractions,
  customers,
  equipment,
  equipmentUsages,
  leaveRequests,
  orderItems,
  orderStatusHistory,
  orders,
  payments,
  photos,
  products,
  rolePermissions,
  rooms,
  serviceAddons,
  services,
  settings,
  staff,
  staffShifts,
  tenants,
  vouchers,
  wardrobeItems,
  wardrobeRentals,
} from "@/lib/db/schema";

describe("seed idempotent", () => {
  it("chạy seed hai lần không nhân đôi dữ liệu", () => {
    const db = createDb(":memory:");
    migrate(db, { migrationsFolder: path.resolve(process.cwd(), "drizzle") });

    seedDatabase(db);
    seedDatabase(db);

    expect(db.select({ value: count() }).from(tenants).get()?.value).toBe(2);
    expect(db.select({ value: count() }).from(staff).get()?.value).toBe(10);
    expect(db.select({ value: count() }).from(customers).get()?.value).toBe(10);
    expect(db.select({ value: count() }).from(services).get()?.value).toBe(5);
    expect(db.select({ value: count() }).from(wardrobeItems).get()?.value).toBe(15);
    expect(db.select({ value: count() }).from(branches).get()?.value).toBe(3);
    expect(db.select({ value: count() }).from(serviceAddons).get()?.value).toBe(6);
    expect(db.select({ value: count() }).from(products).get()?.value).toBe(5);
    expect(db.select({ value: count() }).from(vouchers).get()?.value).toBe(3);
    expect(db.select({ value: count() }).from(customerInteractions).get()?.value).toBe(10);
    expect(db.select({ value: count() }).from(orders).get()?.value).toBe(6);
    expect(db.select({ value: count() }).from(orderItems).get()?.value).toBe(13);
    expect(db.select({ value: count() }).from(orderStatusHistory).get()?.value).toBe(26);
    expect(db.select({ value: count() }).from(payments).get()?.value).toBe(5);
    expect(db.select({ value: count() }).from(rooms).get()?.value).toBe(4);
    expect(db.select({ value: count() }).from(staffShifts).get()?.value).toBe(154);
    expect(db.select({ value: count() }).from(leaveRequests).get()?.value).toBe(2);
    expect(db.select({ value: count() }).from(appointments).get()?.value).toBe(6);
    expect(db.select({ value: count() }).from(wardrobeRentals).get()?.value).toBe(2);
    expect(db.select({ value: count() }).from(equipment).get()?.value).toBe(5);
    expect(db.select({ value: count() }).from(equipmentUsages).get()?.value).toBe(1);
    expect(db.select({ value: count() }).from(rolePermissions).get()?.value).toBe(168);
    expect(db.select({ value: count() }).from(settings).get()?.value).toBe(22);
    expect(db.select({ value: count() }).from(albums).get()?.value).toBe(1);
    expect(db.select({ value: count() }).from(albumFolders).get()?.value).toBe(3);
    expect(db.select({ value: count() }).from(photos).get()?.value).toBe(12);
    expect(db.select({ value: count() }).from(transactions).get()?.value).toBe(8);
    expect(db.select({ value: count() }).from(expenses).get()?.value).toBe(3);
    expect(db.select({ value: count() }).from(budgets).get()?.value).toBe(2);
    expect(db.select({ value: count() }).from(invoices).get()?.value).toBe(2);
    expect(db.select({ value: count() }).from(commissionRules).get()?.value).toBe(3);
    expect(db.select({ value: count() }).from(commissions).get()?.value).toBe(3);
    expect(db.select({ value: count() }).from(payrolls).get()?.value).toBe(1);
    expect(db.select({ value: count() }).from(attendance).get()?.value).toBe(6);
    expect(db.select({ value: count() }).from(tasks).get()?.value).toBe(4);
    expect(db.select({ value: count() }).from(taskComments).get()?.value).toBe(2);
    expect(db.select({ value: count() }).from(documents).get()?.value).toBe(2);
    expect(db.select({ value: count() }).from(campaigns).get()?.value).toBe(2);
    expect(db.select({ value: count() }).from(conversations).get()?.value).toBe(2);
    expect(db.select({ value: count() }).from(messages).get()?.value).toBe(4);
    expect(
      db
        .select({ value: count() })
        .from(customers)
        .where(eq(customers.tenantId, "tenant-demo"))
        .get()?.value,
    ).toBe(10);
  });
});
