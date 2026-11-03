import { z } from "zod";

const optionalText = (max: number) =>
  z.string().max(max).optional().or(z.literal(""));

export const createAlbumSchema = z.object({
  branchId: z.string().min(1, "Chọn chi nhánh."),
  customerId: z.string().optional().or(z.literal("")),
  orderId: z.string().optional().or(z.literal("")),
  title: z
    .string()
    .trim()
    .min(1, "Nhập tiêu đề album.")
    .max(160, "Tiêu đề tối đa 160 ký tự."),
  notes: optionalText(2000),
  sourceType: z.enum(["drive", "multi_link", "upload"]),
  sourceUrl: optionalText(2000),
  sourceUrls: optionalText(8000),
  selectionLimit: z.coerce
    .number()
    .int()
    .min(1, "Số ảnh được chọn tối thiểu là 1.")
    .max(1000),
  extraPhotoEnabled: z.boolean(),
  extraPhotoPrice: z.coerce.number().int().min(0).max(1_000_000_000),
  allowFavorites: z.boolean(),
  allowNotes: z.boolean(),
  allowDownloads: z.boolean(),
  downloadLimit: z
    .union([z.literal(""), z.coerce.number().int().min(1).max(100000)])
    .optional(),
  password: z.string().max(72).optional().or(z.literal("")),
  expiresAt: z.string().optional().or(z.literal("")),
});

export const updateAlbumSchema = createAlbumSchema
  .omit({ branchId: true, sourceType: true, sourceUrl: true, sourceUrls: true })
  .extend({
    albumId: z.string().min(1),
    clearPassword: z.boolean(),
  });

export const albumIdSchema = z.object({
  albumId: z.string().min(1),
});

export const albumStatusSchema = z.object({
  albumId: z.string().min(1),
  status: z.enum(["draft", "processing", "ready", "delivered", "archived"]),
});

export const shareToggleSchema = z.object({
  albumId: z.string().min(1),
  revoked: z.boolean(),
});
