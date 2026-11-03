import { z } from "zod";

export const saveFilterJobSchema = z.object({
  albumId: z.string().min(1).nullable(),
  mode: z.enum(["alphanumeric", "numeric"]),
  inputCodesText: z.string().max(50_000),
  parsedCount: z.coerce.number().int().min(0).max(5000),
  matchedCount: z.coerce.number().int().min(0).max(5000),
  missingCount: z.coerce.number().int().min(0).max(5000),
  ambiguousCount: z.coerce.number().int().min(0).max(5000),
  duplicateCount: z.coerce.number().int().min(0).max(5000),
  outputMode: z.enum(["subfolder", "separate"]),
  outputFolderName: z.string().min(1).max(80),
  fileType: z.enum(["all", "raw", "standard"]),
  status: z.enum(["completed", "cancelled", "failed"]),
  items: z
    .array(
      z.object({
        inputCode: z.string().min(1).max(120),
        matchedFilename: z.string().max(300),
        status: z.string().min(1).max(40),
        message: z.string().max(500).optional(),
      }),
    )
    .max(5000),
});
