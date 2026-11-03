import { z } from "zod";

export const manualTransactionSchema = z.object({
  type: z.enum(["income", "expense", "refund"]),
  branchId: z.string().min(1),
  category: z.string().min(1).max(60),
  amount: z.coerce.number().int().min(1),
  method: z.enum(["cash", "bank_transfer", "vietqr", "card", "ewallet"]),
  description: z.string().max(1000).optional().or(z.literal("")),
  reference: z.string().max(200).optional().or(z.literal("")),
  occurredAt: z.string().optional().or(z.literal("")),
  orderId: z.string().optional().or(z.literal("")),
  customerId: z.string().optional().or(z.literal("")),
});

export const expenseSchema = z.object({
  branchId: z.string().min(1),
  category: z.string().min(1).max(60),
  amount: z.coerce.number().int().min(1),
  vendor: z.string().max(200).optional().or(z.literal("")),
  description: z.string().max(1000).optional().or(z.literal("")),
  occurredAt: z.string().optional().or(z.literal("")),
  method: z.enum(["cash", "bank_transfer", "vietqr", "card", "ewallet"]),
});

export const budgetSchema = z.object({
  branchId: z.string().optional().or(z.literal("")),
  category: z.string().min(1).max(60),
  period: z.string().regex(/^\d{4}-\d{2}$/),
  amount: z.coerce.number().int().min(0),
  notes: z.string().max(500).optional().or(z.literal("")),
});

export const invoiceSchema = z.object({
  orderId: z.string().min(1),
  vatRate: z.coerce.number().int().min(0).max(100),
  notes: z.string().max(1000).optional().or(z.literal("")),
});

export const invoiceStatusSchema = z.object({
  invoiceId: z.string().min(1),
  status: z.enum(["draft", "issued", "paid", "cancelled"]),
});

export const refundSchema = z.object({
  orderId: z.string().min(1),
  amount: z.coerce.number().int().min(1),
  reason: z.string().min(1).max(500),
  method: z.enum(["cash", "bank_transfer", "vietqr", "card", "ewallet"]),
});
