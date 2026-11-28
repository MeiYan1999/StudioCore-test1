import { beforeAll, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { and, count, eq } from "drizzle-orm";
import { authenticate } from "@/lib/auth/login-service";
import { getActorFromToken } from "@/lib/auth/session-core";
import type { ActorContext } from "@/lib/auth/types";
import type { AppDb } from "@/lib/db/client";
import { aiJobs, notifications } from "@/lib/db/schema";
import {
  addTaskComment,
  createTask,
  getTasksForCustomer,
  listTasks,
  setTaskStatus,
} from "@/lib/services/task-service";
import {
  createLeaveRequest,
  listAttendance,
  recordCheckIn,
  recordCheckOut,
  setLeaveStatus,
} from "@/lib/services/hr-service";
import {
  getConversation,
  setConversationAi,
  simulateInboundMessage,
} from "@/lib/services/inbox-service";
import {
  saveBranch,
  saveStudioSettings,
} from "@/lib/services/settings-write-service";
import { getTenantSettings } from "@/lib/services/settings-service";
import { saveCampaign, listCampaigns } from "@/lib/services/campaign-service";
import {
  createLinkDocument,
  createUploadedDocument,
  getDocumentFile,
  listDocuments,
} from "@/lib/services/document-service";
import { getNotificationsForActor, markNotificationRead } from "@/lib/services/notification-service";
import { getDashboardOverview } from "@/lib/services/report-service";
import * as storage from "@/lib/adapters/storage";
import { createTestDb } from "../helpers/test-db";

let db: AppDb;
let owner: ActorContext;
let photographer: ActorContext;
let receptionist: ActorContext;

async function login(email: string, ip: string): Promise<ActorContext> {
  const result = await authenticate(
    db,
    { mode: "password", identifier: email, secret: "Demo@123" },
    { ip, userAgent: "vitest-operations" },
  );
  if (!result.ok) throw new Error(result.error);
  const actor = await getActorFromToken(db, result.token);
  if (!actor) throw new Error("Không dựng actor");
  return actor;
}

beforeAll(async () => {
  db = createTestDb();
  owner = await login("owner@studiocore.demo", "192.0.2.120");
  photographer = await login("photo@studiocore.demo", "192.0.2.121");
  receptionist = await login("letan@studiocore.demo", "192.0.2.122");
});

describe("vận hành: tasks, HR, inbox, settings", () => {
  it("task từ CRM, mention notification và trạng thái done", () => {
    const taskId = createTask(db, owner, {
      title: "Chăm sóc khách test",
      description: "Gọi lại khách",
      branchId: "branch-demo-q1",
      assigneeId: "staff-sc-photo",
      orderId: "order-demo-01",
      customerId: "customer-demo-01",
      albumId: "",
      priority: "high",
      status: "todo",
      dueAt: "2026-11-10T09:00",
    });
    const tasks = getTasksForCustomer(db, owner, "customer-demo-01");
    expect(tasks.some((task) => task.id === taskId)).toBe(true);
    const notify = db
      .select({ value: count() })
      .from(notifications)
      .where(
        and(
          eq(notifications.tenantId, owner.tenantId),
          eq(notifications.userId, "staff-sc-photo"),
          eq(notifications.type, "task_assigned"),
        ),
      )
      .get()?.value ?? 0;
    expect(notify).toBeGreaterThan(0);
    addTaskComment(db, owner, taskId, "@SC-PHOTO kiểm tra giúp nhé");
    const mention = db
      .select({ value: count() })
      .from(notifications)
      .where(eq(notifications.type, "task_mention"))
      .get()?.value ?? 0;
    expect(mention).toBeGreaterThan(0);
    setTaskStatus(db, owner, taskId, "done");
  });

  it("chấm công check-in/out và chặn mở hai ca", () => {
    const attendanceId = recordCheckIn(db, owner, {
      staffId: "staff-sc-photo",
      branchId: "branch-demo-q1",
      method: "gps",
      checkIn: "2026-11-03T08:00",
      latitude: "10.7769",
      longitude: "106.7009",
      device: "vitest",
      notes: "Test",
    });
    expect(() =>
      recordCheckIn(db, owner, {
        staffId: "staff-sc-photo",
        branchId: "branch-demo-q1",
        method: "manual",
        checkIn: "",
        latitude: "",
        longitude: "",
        device: "",
        notes: "",
      }),
    ).toThrow(/chưa check-out/);
    recordCheckOut(db, owner, attendanceId, "2026-11-03T17:00", "Về");
    const rows = listAttendance(db, owner, { staffId: "staff-sc-photo" });
    expect(rows.some((row) => row.id === attendanceId && row.checkOutAt)).toBe(true);
  });

  it("nghỉ phép tạo, duyệt và notification", () => {
    const leaveId = createLeaveRequest(db, owner, {
      staffId: "staff-sc-photo",
      branchId: "branch-demo-q1",
      startAt: "2026-11-15T08:00",
      endAt: "2026-11-15T18:00",
      reason: "Test nghỉ",
    });
    setLeaveStatus(db, owner, leaveId, "approved");
    const notification = db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, "staff-sc-photo"),
          eq(notifications.type, "leave_request"),
        ),
      )
      .all();
    expect(notification.length).toBeGreaterThan(0);
  });

  it("inbox AI local trả lời chủ đề giá, handoff khi không chắc", () => {
    setConversationAi(db, owner, "conversation-demo-01", true);
    const before = getConversation(db, owner, "conversation-demo-01").messages.length;
    const reply = simulateInboundMessage(
      db,
      owner,
      "conversation-demo-01",
      "Cho mình xin bảng giá gói cưới",
    );
    expect(reply.reply).toBeTruthy();
    expect(reply.handoff).toBe(false);
    const after = getConversation(db, owner, "conversation-demo-01").messages;
    expect(after.length).toBe(before + 2);
    expect(after.at(-1)?.senderName).toBe("AI local");
    const job = db
      .select()
      .from(aiJobs)
      .where(eq(aiJobs.type, "inbox_auto_reply"))
      .get();
    expect(job?.provider).toBe("local");
    expect(job?.estimatedCost).toBe(0);

    const handoff = simulateInboundMessage(
      db,
      owner,
      "conversation-demo-01",
      "Mình muốn khiếu nại và gặp người phụ trách",
    );
    expect(handoff.handoff).toBe(true);
    expect(handoff.reply).toBeNull();
  });

  it("settings chỉ owner, branch CRUD và chi nhánh mới", () => {
    expect(() =>
      saveStudioSettings(db, photographer, {
        name: "Hack",
        logoUrl: "",
        address: "",
        phone: "",
        email: "",
        website: "",
        taxCode: "",
        bankName: "",
        bankBin: "",
        bankAccountNumber: "",
        bankAccountName: "",
        weekdayHours: "",
        saturdayHours: "",
        sundayHours: "",
        reviewTemplate: "",
        reminderTemplate: "",
      }),
    ).toThrow(/quyền/);
    saveStudioSettings(db, owner, {
      name: "Studio Ánh Dương",
      logoUrl: "",
      address: "12 Nguyễn Huệ, Quận 1",
      phone: "028 0000 0001",
      email: "hello@studiocore.demo",
      website: "https://studiocore.demo",
      taxCode: "0000000000",
      bankName: "Ngân hàng Demo",
      bankBin: "970436",
      bankAccountNumber: "0000000000",
      bankAccountName: "STUDIO DEMO",
      weekdayHours: "08:00-18:00",
      saturdayHours: "08:00-17:00",
      sundayHours: "closed",
      reviewTemplate: "Cảm ơn quý khách",
      reminderTemplate: "Nhắc lịch",
    });
    expect(getTenantSettings(db, owner.tenantId)["studio.name"]).toBe("Studio Ánh Dương");
    const branchId = saveBranch(db, owner, {
      name: "Chi nhánh Test",
      address: "1 Test",
      phone: "0900000000",
      status: "active",
    });
    expect(branchId).toBeTruthy();
    expect(() =>
      saveStudioSettings(db, photographer, {
        name: "X",
        logoUrl: "",
        address: "",
        phone: "",
        email: "",
        website: "",
        taxCode: "",
        bankName: "",
        bankBin: "",
        bankAccountNumber: "",
        bankAccountName: "",
        weekdayHours: "",
        saturdayHours: "",
        sundayHours: "",
        reviewTemplate: "",
        reminderTemplate: "",
      }),
    ).toThrow();
  });

  it("campaign ROAS/CPL và tài liệu link/file", async () => {
    const campaignId = saveCampaign(db, owner, {
      name: "Campaign test",
      source: "facebook",
      branchId: "branch-demo-q1",
      budget: 1_000_000,
      spend: 500_000,
      leads: 10,
      ordersCount: 2,
      revenue: 3_000_000,
      startAt: "",
      endAt: "",
      status: "active",
      notes: "",
    });
    const campaign = listCampaigns(db, owner).find((row) => row.id === campaignId);
    expect(campaign?.roas).toBe(6);
    expect(campaign?.cpl).toBe(50_000);

    createLinkDocument(db, owner, {
      name: "Link test",
      category: "guide",
      url: "/manage/tasks",
      visibility: "internal",
      branchId: "branch-demo-q1",
      notes: "",
    });
    const fileId = await createUploadedDocument(db, owner, {
      name: "file-test.pdf",
      category: "finance",
      visibility: "internal",
      branchId: "branch-demo-q1",
      notes: "",
      filename: "file-test.pdf",
      buffer: Buffer.from("%PDF-1.4 test"),
    });
    const file = await getDocumentFile(db, owner, fileId);
    const absolutePath = path.join(process.cwd(), "data", "documents", file.document.storageKey!);
    expect(fs.existsSync(absolutePath)).toBe(true);
    fs.rmSync(absolutePath, { force: true });
    expect(file.buffer).toEqual(Buffer.from("%PDF-1.4 test"));
    expect(listDocuments(db, owner, { category: "guide" }).length).toBeGreaterThan(0);
  });

  it("ghi và đọc tài liệu qua R2 khi chạy không có ổ lưu trữ", async () => {
    const put = vi.fn().mockResolvedValue(undefined);
    const buffer = Buffer.from("%PDF-1.4 R2");
    const read = vi.fn().mockResolvedValue(buffer);
    const adapter = vi.spyOn(storage, "getStorageAdapter").mockReturnValue({
      ...storage.getStorageAdapter(),
      put,
      read,
    });
    vi.stubEnv("STORAGE_PROVIDER", "r2");
    try {
      const id = await createUploadedDocument(db, owner, {
        name: "R2 test",
        category: "finance",
        visibility: "internal",
        branchId: "branch-demo-q1",
        notes: "",
        filename: "test.pdf",
        buffer,
      });
      const file = await getDocumentFile(db, owner, id);
      const key = `documents/${file.document.storageKey}`;
      expect(put).toHaveBeenCalledWith(key, buffer);
      expect(read).toHaveBeenCalledWith(key);
      expect(file.buffer).toEqual(buffer);
    } finally {
      vi.unstubAllEnvs();
      adapter.mockRestore();
    }
  });

  it("dashboard receptionist không lộ số liệu tài chính", () => {
    const overview = getDashboardOverview(db, receptionist);
    expect(overview.monthRevenue).toBe(0);
    expect(overview.debtTotal).toBe(0);
    expect(overview.roomUtilization).toEqual([]);
    expect(overview.ordersByStatus).toBeTruthy();
  });

  it("lọc việc quá hạn chỉ trả việc chưa xong đã qua hạn của người được giao", () => {
    const make = (title: string, status: "todo" | "done", dueAt: string, assigneeId = "staff-sc-photo") => createTask(db, owner, {
      title, description: "", branchId: "branch-demo-q1", assigneeId, orderId: "", customerId: "", albumId: "",
      priority: "medium", status, dueAt,
    });
    const late = make("Trễ hạn lọc", "todo", "2020-01-02T09:00");
    make("Đã xong dù quá hạn", "done", "2020-01-02T09:00");
    make("Chưa tới hạn", "todo", "2999-01-02T09:00");
    make("Không có hạn", "todo", "");
    const lateOther = make("Trễ hạn của người khác", "todo", "2020-01-02T09:00", "staff-sc-retouch");
    const mine = listTasks(db, owner, { overdue: "1", assigneeId: "staff-sc-photo" });
    expect(mine.map(task => task.id)).toEqual([late]);
    expect(mine.every(task => task.overdue && task.status !== "done")).toBe(true);
    const all = listTasks(db, owner, { overdue: "1" }).map(task => task.id);
    expect(all).toEqual(expect.arrayContaining([late, lateOther]));
    expect(all.every(id => listTasks(db, owner, {}).find(task => task.id === id)?.overdue)).toBe(true);
    expect(listTasks(db, photographer, { overdue: "1", assigneeId: "staff-sc-photo" }).map(task => task.id)).toEqual([late]);
  });

  it("giao việc chỉ báo cho người được giao, đọc xong giảm số chưa đọc và người khác không đánh dấu được", () => {
    const before = getNotificationsForActor(db, photographer).unreadCount;
    const ownerBefore = getNotificationsForActor(db, owner).unreadCount;
    createTask(db, owner, {
      title: "Việc để thử thông báo", description: "", branchId: "branch-demo-q1", assigneeId: "staff-sc-photo",
      orderId: "", customerId: "", albumId: "", priority: "medium", status: "todo", dueAt: "",
    });
    const summary = getNotificationsForActor(db, photographer);
    expect(summary.unreadCount).toBe(before + 1);
    expect(getNotificationsForActor(db, owner).unreadCount).toBe(ownerBefore);
    const item = summary.items.find(row => row.content === "Việc để thử thông báo")!;
    expect(item.readAt).toBeNull();

    markNotificationRead(db, receptionist, item.id);
    expect(getNotificationsForActor(db, photographer).unreadCount).toBe(before + 1);
    markNotificationRead(db, owner, item.id);
    expect(getNotificationsForActor(db, photographer).unreadCount).toBe(before + 1);

    markNotificationRead(db, photographer, item.id);
    const after = getNotificationsForActor(db, photographer);
    expect(after.unreadCount).toBe(before);
    expect(after.items.find(row => row.id === item.id)?.readAt).toBeInstanceOf(Date);
  });
});
