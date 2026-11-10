CREATE TABLE `platform_subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`plan` text NOT NULL,
	`billing_cycle` text DEFAULT 'monthly' NOT NULL,
	`amount` integer NOT NULL,
	`code` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`gateway` text,
	`transaction_ref` text,
	`account_number` text,
	`content` text,
	`expires_at` integer NOT NULL,
	`paid_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `platform_subs_tenant_idx` ON `platform_subscriptions` (`tenant_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `platform_subs_code_unique` ON `platform_subscriptions` (`code`);--> statement-breakpoint
CREATE INDEX `platform_subs_status_idx` ON `platform_subscriptions` (`status`);--> statement-breakpoint
ALTER TABLE `tenants` ADD `plan_expires_at` integer;