CREATE TABLE `review_requests` (
	`order_id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`channel` text NOT NULL,
	`content` text NOT NULL,
	`recipient` text,
	`due_at` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`error` text,
	`sent_at` integer,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `review_requests_due` ON `review_requests` (`status`,`due_at`);--> statement-breakpoint
ALTER TABLE `documents` ADD `customer_id` text REFERENCES customers(id);--> statement-breakpoint
ALTER TABLE `documents` ADD `order_id` text REFERENCES orders(id);--> statement-breakpoint
ALTER TABLE `orders` ADD `campaign_id` text REFERENCES campaigns(id);--> statement-breakpoint
CREATE INDEX `orders_campaign_period_idx` ON `orders` (`tenant_id`,`campaign_id`,`created_at`);