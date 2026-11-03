import { z } from "zod";

const optionalInt = z.preprocess(
  (value) => (value === "" || value === null || value === undefined ? null : Number(value)),
  z.number().int().min(0).nullable(),
);

const optionalPositiveInt = z.preprocess(
  (value) => (value === "" || value === null || value === undefined ? null : Number(value)),
  z.number().int().min(1).nullable(),
);

export const serviceSchema = z.object({
  name: z.string().trim().min(2, "Tên dịch vụ phải có ít nhất 2 ký tự.").max(150),
  category: z.enum(["wedding", "baby", "family", "lookbook", "event", "concept", "other"]),
  branchId: z.string().min(1, "Chọn chi nhánh."),
  price: z.coerce.number().int().min(0, "Giá không được âm."),
  durationMinutes: z.coerce.number().int().min(1, "Thời lượng phải lớn hơn 0."),
  description: z.string().max(1000).optional().or(z.literal("")),
  active: z.boolean(),
});

export const addonSchema = z.object({
  serviceId: z.string().min(1, "Chọn dịch vụ."),
  name: z.string().trim().min(2, "Tên add-on phải có ít nhất 2 ký tự.").max(150),
  price: z.coerce.number().int().min(0, "Giá không được âm."),
  active: z.boolean(),
});

export const productSchema = z.object({
  sku: z
    .string()
    .trim()
    .toUpperCase()
    .min(2, "SKU phải có ít nhất 2 ký tự.")
    .max(50)
    .regex(/^[A-Z0-9-]+$/, "SKU chỉ gồm chữ, số và dấu gạch ngang."),
  name: z.string().trim().min(2, "Tên sản phẩm phải có ít nhất 2 ký tự.").max(150),
  category: z.string().trim().min(1, "Chọn danh mục.").max(50),
  price: z.coerce.number().int().min(0, "Giá không được âm."),
  stock: z.coerce.number().int().min(0, "Tồn kho không được âm."),
  status: z.enum(["active", "inactive", "discontinued"]),
});

export const voucherSchema = z
  .object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .min(3, "Mã voucher phải có ít nhất 3 ký tự.")
      .max(30)
      .regex(/^[A-Z0-9-]+$/, "Mã voucher chỉ gồm chữ, số và dấu gạch ngang."),
    name: z.string().trim().min(2, "Tên voucher phải có ít nhất 2 ký tự.").max(150),
    branchId: z.string().optional().or(z.literal("")),
    discountType: z.enum(["percent", "fixed"]),
    value: z.coerce.number().int().min(1, "Giá trị giảm phải lớn hơn 0."),
    minOrder: z.coerce.number().int().min(0, "Giá trị đơn tối thiểu không được âm."),
    maxDiscount: optionalInt,
    usageLimit: optionalPositiveInt,
    startsAt: z.string().optional().or(z.literal("")),
    endsAt: z.string().optional().or(z.literal("")),
    active: z.boolean(),
  })
  .refine(
    (data) => data.discountType !== "percent" || data.value <= 100,
    { message: "Phần trăm giảm không được vượt quá 100.", path: ["value"] },
  );

export type ServiceFormInput = z.infer<typeof serviceSchema>;
export type AddonFormInput = z.infer<typeof addonSchema>;
export type ProductFormInput = z.infer<typeof productSchema>;
export type VoucherFormInput = z.infer<typeof voucherSchema>;
