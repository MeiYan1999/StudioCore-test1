import { beforeAll, describe, expect, it } from "vitest";
import { count, eq } from "drizzle-orm";
import { authenticate } from "@/lib/auth/login-service";
import { getActorFromToken } from "@/lib/auth/session-core";
import type { ActorContext } from "@/lib/auth/types";
import type { AppDb } from "@/lib/db/client";
import { appointments } from "@/lib/db/schema";
import { BookingConflictError, AuthorizationError } from "@/lib/errors";
import {
  checkInAppointment,
  checkOutAppointment,
  createAppointment,
  getAppointmentDetail,
  getCalendarData,
} from "@/lib/services/appointment-service";
import { createTestDb } from "../helpers/test-db";

let db: AppDb;
let owner: ActorContext;
let manager: ActorContext;
let secondaryOwner: ActorContext;

function iso(value: string): string {
  return new Date(value).toISOString();
}

beforeAll(async () => {
  db = createTestDb();

  const ownerLogin = await authenticate(
    db,
    { mode: "password", identifier: "owner@studiocore.demo", secret: "Demo@123" },
    { ip: "192.0.2.30", userAgent: "vitest-booking" },
  );
  if (!ownerLogin.ok) throw new Error("Không login owner");
  const ownerActor = await getActorFromToken(db, ownerLogin.token);
  if (!ownerActor) throw new Error("Không tạo owner actor");
  owner = ownerActor;

  const managerLogin = await authenticate(
    db,
    { mode: "pin", identifier: "SC-MANAGER", secret: "222222" },
    { ip: "192.0.2.31", userAgent: "vitest-booking-manager" },
  );
  if (!managerLogin.ok) throw new Error("Không login manager");
  const managerActor = await getActorFromToken(db, managerLogin.token);
  if (!managerActor) throw new Error("Không tạo manager actor");
  manager = managerActor;

  const secondaryLogin = await authenticate(
    db,
    {
      mode: "password",
      identifier: "owner@studiobinhminh.demo",
      secret: "Demo@123",
    },
    { ip: "192.0.2.32", userAgent: "vitest-booking-secondary" },
  );
  if (!secondaryLogin.ok) throw new Error("Không login tenant phụ");
  const secondaryActor = await getActorFromToken(db, secondaryLogin.token);
  if (!secondaryActor) throw new Error("Không tạo secondary actor");
  secondaryOwner = secondaryActor;
});

const baseAppointment = {
  orderId: "order-demo-03",
  branchId: "branch-demo-thu-duc",
  roomId: "room-demo-thu-duc-1",
  photographerId: "staff-sc-photo2",
  makeupId: null,
  editorId: null,
  startAt: iso("2026-11-11T10:00:00+07:00"),
  endAt: iso("2026-11-11T12:00:00+07:00"),
  notes: "Lịch integration test",
  idempotencyKey: crypto.randomUUID(),
};

describe("booking và chống trùng lịch", () => {
  it("hai request đồng thời cùng slot: một thành công, một bị chặn", async () => {
    const results = await Promise.allSettled([
      createAppointment(db, owner, { ...baseAppointment, idempotencyKey: crypto.randomUUID() }),
      createAppointment(db, owner, { ...baseAppointment, idempotencyKey: crypto.randomUUID() }),
    ]);

    const fulfilled = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter((result) => result.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]?.status).toBe("rejected");
    if (rejected[0]?.status === "rejected") {
      expect(rejected[0].reason).toBeInstanceOf(BookingConflictError);
    }

    const slotCount =
      db
        .select({ value: count() })
        .from(appointments)
        .where(
          eq(appointments.startAt, new Date(baseAppointment.startAt)),
        )
        .get()?.value ?? 0;
    expect(slotCount).toBe(1);
  });

  it("idempotency key trả lại cùng lịch, không tạo bản ghi trùng", async () => {
    const key = crypto.randomUUID();
    const first = await createAppointment(db, owner, {
      ...baseAppointment,
      startAt: iso("2026-11-11T14:00:00+07:00"),
      endAt: iso("2026-11-11T16:00:00+07:00"),
      idempotencyKey: key,
    });
    const second = await createAppointment(db, owner, {
      ...baseAppointment,
      startAt: iso("2026-11-11T14:00:00+07:00"),
      endAt: iso("2026-11-11T16:00:00+07:00"),
      idempotencyKey: key,
    });

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.appointmentId).toBe(first.appointmentId);
  });

  it("chặn slot nằm trong buffer 30 phút", async () => {
    await expect(
      createAppointment(db, owner, {
        ...baseAppointment,
        startAt: iso("2026-11-11T12:15:00+07:00"),
        endAt: iso("2026-11-11T13:15:00+07:00"),
        idempotencyKey: crypto.randomUUID(),
      }),
    ).rejects.toBeInstanceOf(BookingConflictError);
  });

  it("chặn ngoài giờ làm việc", async () => {
    await expect(
      createAppointment(db, owner, {
        orderId: "order-demo-06",
        branchId: "branch-demo-q1",
        roomId: "room-demo-q1-1",
        photographerId: null,
        makeupId: null,
        editorId: null,
        startAt: iso("2026-11-14T17:30:00+07:00"),
        endAt: iso("2026-11-14T18:30:00+07:00"),
        notes: "",
        idempotencyKey: crypto.randomUUID(),
      }),
    ).rejects.toThrow(/giờ làm việc|đóng cửa/);
  });

  it("chặn khi nhân sự đang nghỉ phép", async () => {
    await expect(
      createAppointment(db, owner, {
        ...baseAppointment,
        startAt: iso("2026-11-12T09:00:00+07:00"),
        endAt: iso("2026-11-12T11:00:00+07:00"),
        idempotencyKey: crypto.randomUUID(),
      }),
    ).rejects.toThrow(/nghỉ phép/);
  });

  it("manager chi nhánh Q1 không được xếp lịch chi nhánh Thủ Đức", async () => {
    await expect(
      createAppointment(db, manager, {
        ...baseAppointment,
        idempotencyKey: crypto.randomUUID(),
      }),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("tenant phụ không thấy lịch của tenant demo", () => {
    const calendar = getCalendarData(db, secondaryOwner, {
      date: "2026-11-11",
      view: "day",
    });
    expect(calendar.appointments).toHaveLength(0);
    expect(getAppointmentDetail(db, secondaryOwner, "appointment-demo-01")).toBeNull();
  });
});

describe("check-in / check-out", () => {
  it("check-in chuyển đơn scheduled sang shooting, check-out sang awaiting_edit", async () => {
    const created = await createAppointment(db, owner, {
      orderId: "order-demo-06",
      branchId: "branch-demo-q1",
      roomId: "room-demo-q1-2",
      photographerId: "staff-sc-photo",
      makeupId: "staff-sc-makeup",
      editorId: null,
      startAt: iso("2026-12-07T09:00:00+07:00"),
      endAt: iso("2026-12-07T11:00:00+07:00"),
      notes: "Kiểm tra check-in/out",
      idempotencyKey: crypto.randomUUID(),
    });

    const before = getAppointmentDetail(db, owner, created.appointmentId);
    expect(before?.status).toBe("scheduled");
    expect(before?.orderStatus).toBe("scheduled");

    checkInAppointment(db, owner, created.appointmentId);
    const afterCheckIn = getAppointmentDetail(db, owner, created.appointmentId);
    expect(afterCheckIn?.status).toBe("checked_in");
    expect(afterCheckIn?.orderStatus).toBe("shooting");
    expect(afterCheckIn?.checkInAt).not.toBeNull();

    checkOutAppointment(db, owner, created.appointmentId);
    const afterCheckOut = getAppointmentDetail(db, owner, created.appointmentId);
    expect(afterCheckOut?.status).toBe("completed");
    expect(afterCheckOut?.orderStatus).toBe("awaiting_edit");
    expect(afterCheckOut?.checkOutAt).not.toBeNull();
  });
});
