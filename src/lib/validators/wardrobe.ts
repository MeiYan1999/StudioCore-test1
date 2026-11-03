import { z } from "zod";

export const wardrobeItemSchema = z.object({
  branchId: z.string().min(1, "Chọn chi nhánh."),
  sku: z
    .string()
    .trim()
    .toUpperCase()
    .min(2, "SKU phải có ít nhất 2 ký tự.")
    .max(40)
    .regex(/^[A-Z0-9-]+$/, "SKU chỉ gồm chữ, số và dấu gạch ngang."),
  qrCode: z.string().trim().max(80).optional().or(z.literal("")),
  name: z.string().trim().min(2, "Tên trang phục phải có ít nhất 2 ký tự.").max(150),
  size: z.string().trim().min(1, "Nhập size.").max(20),
  color: z.string().trim().min(1, "Nhập màu.").max(50),
  status: z.enum(["available", "rented", "cleaning", "maintenance", "retired"]),
  rentalPrice: z.coerce.number().int().min(0),
  depositPrice: z.coerce.number().int().min(0),
  image: z.string().max(500).optional().or(z.literal("")),
  notes: z.string().max(1000).optional().or(z.literal("")),
});

export const rentalSchema = z.object({
  wardrobeItemId: z.string().min(1, "Chọn trang phục."),
  orderId: z.string().optional().or(z.literal("")),
  dueAt: z.string().min(1, "Chọn hạn trả."),
  deposit: z.coerce.number().int().min(0),
  conditionOut: z.enum(["good", "cleaning", "damaged"]),
  notes: z.string().max(1000).optional().or(z.literal("")),
});

export const rentalReturnSchema = z.object({
  rentalId: z.string().min(1),
  conditionIn: z.enum(["good", "cleaning", "damaged"]),
  cleaningFee: z.coerce.number().int().min(0),
  damageFee: z.coerce.number().int().min(0),
  notes: z.string().max(1000).optional().or(z.literal("")),
});

export const equipmentSchema = z.object({
  branchId: z.string().min(1, "Chọn chi nhánh."),
  name: z.string().trim().min(2, "Tên thiết bị phải có ít nhất 2 ký tự.").max(150),
  category: z.enum(["camera", "lens", "light", "accessory", "other"]),
  serialNumber: z.string().trim().min(2, "Nhập serial.").max(80),
  status: z.enum(["available", "in_use", "maintenance", "retired"]),
  notes: z.string().max(1000).optional().or(z.literal("")),
});

export type WardrobeItemFormInput = z.infer<typeof wardrobeItemSchema>;
export type RentalFormInput = z.infer<typeof rentalSchema>;
export type RentalReturnFormInput = z.infer<typeof rentalReturnSchema>;
export type EquipmentFormInput = z.infer<typeof equipmentSchema>;
