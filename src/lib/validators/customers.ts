import { z } from "zod";

const optionalEmail = z
  .string()
  .trim()
  .toLowerCase()
  .email("Email không hợp lệ.")
  .max(200)
  .optional()
  .or(z.literal(""));

const optionalText = z.string().trim().max(500).optional().or(z.literal(""));

export const customerCreateSchema = z.object({
  name: z.string().trim().min(2, "Tên khách phải có ít nhất 2 ký tự.").max(120),
  phone: z.string().trim().min(8, "Vui lòng nhập số điện thoại.").max(20),
  email: optionalEmail,
  address: optionalText,
  birthday: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày sinh phải theo định dạng YYYY-MM-DD.")
    .optional()
    .or(z.literal("")),
  source: z.enum(["facebook", "tiktok", "google", "referral", "walk_in", "other"]),
  tier: z.enum(["standard", "vip", "vvip"]),
  status: z.enum(["lead", "active", "inactive", "churned"]),
  ownerId: z.string().optional().or(z.literal("")),
  branchId: z.string().min(1, "Chọn chi nhánh."),
  tags: z.string().max(300).optional().or(z.literal("")),
  heightCm: z.string().optional().or(z.literal("")),
  dressSize: z.string().max(20).optional().or(z.literal("")),
  shoeSize: z.string().max(20).optional().or(z.literal("")),
  measurementsNote: z.string().max(500).optional().or(z.literal("")),
  followUpAt: z.string().optional().or(z.literal("")),
  notes: z.string().max(2000).optional().or(z.literal("")),
});

export const customerUpdateSchema = customerCreateSchema;

export const customerInteractionSchema = z.object({
  customerId: z.string().min(1),
  type: z.enum(["call", "message", "meeting", "note", "follow_up"]),
  content: z.string().trim().min(2, "Nội dung tương tác không được để trống.").max(2000),
  occurredAt: z.string().optional().or(z.literal("")),
  followUpAt: z.string().optional().or(z.literal("")),
});

export type CustomerCreateInput = z.infer<typeof customerCreateSchema>;
export type CustomerInteractionInput = z.infer<typeof customerInteractionSchema>;
