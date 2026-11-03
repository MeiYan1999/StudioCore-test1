"use server";

import { getActorContext } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { AuthorizationError, NotFoundError, ValidationError } from "@/lib/errors";
import { savePhotoFilterJob } from "@/lib/services/photo-filter-service";
import { saveFilterJobSchema } from "@/lib/validators/photos";

export async function savePhotoFilterJobAction(input: {
  albumId: string | null;
  mode: "alphanumeric" | "numeric";
  inputCodesText: string;
  parsedCount: number;
  matchedCount: number;
  missingCount: number;
  ambiguousCount: number;
  duplicateCount: number;
  outputMode: "subfolder" | "separate";
  outputFolderName: string;
  fileType: "all" | "raw" | "standard";
  status: "completed" | "cancelled" | "failed";
  items: {
    inputCode: string;
    matchedFilename: string;
    status: string;
    message?: string;
  }[];
}): Promise<{ ok: true; jobId: string } | { ok: false; error: string }> {
  const actor = await getActorContext();
  if (!actor) {
    return { ok: false, error: "Phiên đăng nhập đã hết hạn." };
  }
  const parsed = saveFilterJobSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Dữ liệu kết quả lọc không hợp lệ." };
  }
  try {
    const result = savePhotoFilterJob(getDb(), actor, parsed.data);
    return { ok: true, jobId: result.jobId };
  } catch (error) {
    if (
      error instanceof AuthorizationError ||
      error instanceof ValidationError ||
      error instanceof NotFoundError
    ) {
      return { ok: false, error: error.message };
    }
    return { ok: false, error: "Không lưu được lịch sử lọc ảnh." };
  }
}
