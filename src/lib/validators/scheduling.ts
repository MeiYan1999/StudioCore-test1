import { z } from "zod";

export const roomSchema = z.object({
  branchId: z.string().min(1, "Chọn chi nhánh."),
  name: z.string().trim().min(2, "Tên phòng phải có ít nhất 2 ký tự.").max(100),
  capacity: z.coerce.number().int().min(1, "Sức chứa phải lớn hơn 0."),
  status: z.enum(["active", "inactive"]),
  notes: z.string().max(500).optional().or(z.literal("")),
});

const appointmentBaseSchema = z.object({
  branchId: z.string().min(1, "Chọn chi nhánh."),
  orderId: z.string().min(1, "Chọn đơn hàng."),
  roomId: z.string().optional().or(z.literal("")),
  photographerId: z.string().optional().or(z.literal("")),
  makeupId: z.string().optional().or(z.literal("")),
  editorId: z.string().optional().or(z.literal("")),
  startAt: z.string().min(1, "Chọn giờ bắt đầu."),
  endAt: z.string().min(1, "Chọn giờ kết thúc."),
  notes: z.string().max(1000).optional().or(z.literal("")),
});

export const appointmentCreateSchema = appointmentBaseSchema.extend({
  idempotencyKey: z.string().min(8, "Thiếu idempotency key."),
});

export const appointmentUpdateSchema = appointmentBaseSchema;

export type RoomFormInput = z.infer<typeof roomSchema>;
export type AppointmentFormInput = z.infer<typeof appointmentCreateSchema>;
