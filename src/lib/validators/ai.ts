import { z } from "zod";

export const aiSettingsSchema = z.object({
  provider: z.enum(["local", "openai", "gemini"]),
  model: z.string().max(120).optional().or(z.literal("")),
  apiKey: z.string().max(500).optional().or(z.literal("")),
  clearApiKey: z.boolean(),
  consent: z.boolean(),
  budgetVnd: z.coerce.number().int().min(0).max(10_000_000_000),
  costPerImageVnd: z.coerce.number().int().min(0).max(100_000_000),
  features: z.object({
    blur: z.boolean(),
    exposure: z.boolean(),
    duplicate: z.boolean(),
    burst: z.boolean(),
    eyeDetection: z.boolean(),
  }),
});
