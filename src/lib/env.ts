import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1).default("./data/studiocore.db"),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET phải dài tối thiểu 32 ký tự"),
  SESSION_TTL_HOURS: z.coerce.number().int().positive().max(168).default(8),
  NEXT_PUBLIC_SITE_URL: z.string().url().default("http://localhost:3000"),
  STORAGE_PROVIDER: z.enum(["local", "s3", "r2"]).default("local"),
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET_NAME: z.string().optional(),
  R2_PUBLIC_URL: z.string().optional(),
  TOKEN_ENCRYPTION_KEY: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().optional(),
  GOOGLE_AUTH_REDIRECT_URI: z.string().optional(),
  AI_PROVIDER: z.enum(["local", "openai", "gemini"]).default("local"),
  AI_API_KEY: z.string().optional(),
  AI_MODEL: z.string().optional(),
  AI_MONTHLY_BUDGET_VND: z.coerce.number().int().min(0).default(0),
  PAYMENT_PROVIDER: z.enum(["manual", "vietqr"]).default("manual"),
  PAYMENT_WEBHOOK_SECRET: z.string().optional(),
});

export type AppEnv = z.infer<typeof envSchema>;

let cachedEnv: AppEnv | null = null;

export function getEnv(): AppEnv {
  if (cachedEnv) {
    return cachedEnv;
  }

  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Cấu hình môi trường chưa hợp lệ: ${details}`);
  }

  cachedEnv = parsed.data;
  return cachedEnv;
}
