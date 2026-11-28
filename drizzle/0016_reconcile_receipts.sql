ALTER TABLE `payments` ADD `source_payment_id` text REFERENCES payments(id);--> statement-breakpoint
CREATE INDEX `payments_source_idx` ON `payments` (`source_payment_id`);
--> statement-breakpoint
-- Only standard order deposits used this payment key. Seed and contract deposits
-- have separate paths. Leave possible manual matches for the accountant.
INSERT INTO transactions (id, tenant_id, branch_id, type, category, amount, order_id, customer_id,
  staff_id, method, description, reference, idempotency_key, occurred_at, created_by)
SELECT lower(hex(randomblob(16))), p.tenant_id, o.branch_id, 'income', 'order_payment', p.amount,
  o.id, o.customer_id, p.created_by, p.method, 'Thu cọc đơn ' || o.code, p.reference,
  'payment:' || p.id, p.paid_at, p.created_by
FROM payments p JOIN orders o ON o.id = p.order_id AND o.tenant_id = p.tenant_id
WHERE p.idempotency_key = 'order-' || o.id || '-deposit' AND p.status = 'completed' AND p.amount > 0
AND NOT EXISTS (SELECT 1 FROM transactions t WHERE t.tenant_id = p.tenant_id AND (
  t.idempotency_key = 'payment:' || p.id OR
  (t.order_id = o.id AND t.type = 'income' AND t.amount = p.amount AND
    (t.reference = p.reference OR t.idempotency_key IS NULL OR t.occurred_at = p.paid_at))
));
--> statement-breakpoint
UPDATE transactions AS t SET occurred_at = p.paid_at
FROM payments AS p
WHERE t.tenant_id = p.tenant_id AND t.order_id = p.order_id
  AND t.idempotency_key = p.idempotency_key AND p.idempotency_key LIKE 'webhook:%'
  AND p.status = 'completed' AND t.type = 'income' AND t.amount = p.amount
  AND t.occurred_at != p.paid_at;
