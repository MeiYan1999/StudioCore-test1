import { z } from "zod";
import { TENANT_ROLES } from "../auth/roles";

const pinSchema = z
  .string()
  .regex(/^\d{6}$/, "PIN phải gồm đúng 6 chữ số.");

export const newStaffPasswordSchema = z
  .string()
  .min(8, "Mật khẩu phải có ít nhất 8 ký tự.")
  .max(128, "Mật khẩu tối đa 128 ký tự.");

const optionalPasswordSchema = newStaffPasswordSchema
  .optional()
  .or(z.literal(""));

export const platformAdminLoginSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9][a-z0-9._-]{2,20}$/, "Tên đăng nhập phải có 3–21 ký tự hợp lệ.");

export const passwordLoginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Vui lòng nhập email hoặc tên đăng nhập.")
    .max(200)
    .refine(
      (value) => z.string().email().safeParse(value).success || platformAdminLoginSchema.safeParse(value).success,
      "Email hoặc tên đăng nhập không hợp lệ.",
    ),
  password: z.string().min(1, "Vui lòng nhập mật khẩu.").max(128),
});

export const pinLoginSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(3, "Vui lòng nhập mã nhân viên.")
    .max(30),
  pin: pinSchema,
});

const optionalEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Email không hợp lệ.")
  .max(200)
  .optional()
  .or(z.literal(""));

export const staffCreateSchema = z.object({
  name: z.string().trim().min(2, "Tên phải có ít nhất 2 ký tự.").max(100),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(3, "Mã nhân viên phải có ít nhất 3 ký tự.")
    .max(30)
    .regex(/^[A-Z0-9-]+$/, "Mã nhân viên chỉ gồm chữ, số và dấu gạch ngang."),
  email: optionalEmailSchema,
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  role: z.enum(TENANT_ROLES),
  pin: pinSchema,
  password: optionalPasswordSchema,
  branchIds: z.array(z.string().min(1)).min(1, "Chọn ít nhất một chi nhánh."),
  active: z.boolean(),
});

export const staffUpdateSchema = z.object({
  name: z.string().trim().min(2, "Tên phải có ít nhất 2 ký tự.").max(100),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(3, "Mã nhân viên phải có ít nhất 3 ký tự.")
    .max(30)
    .regex(/^[A-Z0-9-]+$/, "Mã nhân viên chỉ gồm chữ, số và dấu gạch ngang."),
  email: optionalEmailSchema,
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  role: z.enum(TENANT_ROLES),
  pin: pinSchema.optional().or(z.literal("")),
  password: optionalPasswordSchema,
  branchIds: z.array(z.string().min(1)).min(1, "Chọn ít nhất một chi nhánh."),
  active: z.boolean(),
});

export type StaffCreateInput = z.infer<typeof staffCreateSchema>;
export type StaffUpdateInput = z.infer<typeof staffUpdateSchema>;
