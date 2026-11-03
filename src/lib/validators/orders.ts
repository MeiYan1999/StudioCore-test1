import { z } from "zod";

export const orderItemSchema = z.object({
  itemType: z.enum(["service", "addon", "product", "custom"]),
  refId: z.string().optional().nullable(),
  name: z.string().max(150).optional().or(z.literal("")),
  quantity: z.coerce.number().int().min(1, "Số lượng phải lớn hơn 0."),
  unitPrice: z.coerce.number().int().min(0, "Đơn giá không được âm."),
});

export const orderCreateSchema = z
  .object({
    customerMode: z.enum(["existing", "new"]),
    customerId: z.string().optional().or(z.literal("")),
    customerName: z.string().max(120).optional().or(z.literal("")),
    customerPhone: z.string().max(20).optional().or(z.literal("")),
    branchId: z.string().min(1, "Chọn chi nhánh."),
    scheduledAt: z.string().optional().or(z.literal("")),
    location: z.string().max(300).optional().or(z.literal("")),
    photographerId: z.string().optional().or(z.literal("")),
    editorId: z.string().optional().or(z.literal("")),
    makeupId: z.string().optional().or(z.literal("")),
    items: z.array(orderItemSchema).min(1, "Đơn hàng phải có ít nhất một item."),
    surcharge: z.coerce.number().int().min(0),
    discount: z.coerce.number().int().min(0),
    voucherCode: z.string().max(30).optional().or(z.literal("")),
    deposit: z.coerce.number().int().min(0),
    depositMethod: z.enum(["cash", "bank_transfer", "card", "ewallet"]),
    notes: z.string().max(2000).optional().or(z.literal("")),
  })
  .refine(
    (data) =>
      data.customerMode === "existing"
        ? Boolean(data.customerId)
        : Boolean(data.customerName?.trim() && data.customerPhone?.trim()),
    { message: "Chọn khách có sẵn hoặc nhập tên/SĐT khách mới.", path: ["customerId"] },
  );

export const orderStatusSchema = z.object({
  orderId: z.string().min(1),
  toStatus: z.string().min(1),
  note: z.string().max(1000).optional().or(z.literal("")),
});

export const orderPaymentSchema = z.object({
  orderId: z.string().min(1),
  amount: z.coerce.number().int().min(1, "Số tiền phải lớn hơn 0."),
  method: z.enum(["cash", "bank_transfer", "card", "ewallet"]),
  reference: z.string().max(100).optional().or(z.literal("")),
  paidAt: z.string().optional().or(z.literal("")),
});

export type OrderCreateFormInput = z.infer<typeof orderCreateSchema>;
export type OrderPaymentFormInput = z.infer<typeof orderPaymentSchema>;
