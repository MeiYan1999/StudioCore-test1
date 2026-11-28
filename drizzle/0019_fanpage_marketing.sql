CREATE TABLE `ads_accounts` (
	`tenant_id` text NOT NULL,
	`id` text NOT NULL,
	`name` text NOT NULL,
	`currency` text NOT NULL,
	`timezone` text NOT NULL,
	`token` text NOT NULL,
	PRIMARY KEY(`tenant_id`, `id`),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `ads_periods` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`account_id` text NOT NULL,
	`since` text NOT NULL,
	`until` text NOT NULL,
	`currency` text NOT NULL,
	`timezone` text NOT NULL,
	`rows` text NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ads_periods_range` ON `ads_periods` (`tenant_id`,`account_id`,`since`,`until`);--> statement-breakpoint
CREATE TABLE `assistant_replies` (
	`message_id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	FOREIGN KEY (`message_id`) REFERENCES `messages`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `assistant_replies_queue` ON `assistant_replies` (`status`);--> statement-breakpoint
CREATE TABLE `page_assistants` (
	`page_id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`name` text NOT NULL,
	`knowledge` text NOT NULL,
	`enabled` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`page_id`) REFERENCES `facebook_pages`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `page_posts` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`page_id` text NOT NULL,
	`content` text NOT NULL,
	`publish_at` integer NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_by` text NOT NULL,
	`approved_by` text,
	`remote_id` text,
	`error` text,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`page_id`) REFERENCES `facebook_pages`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`approved_by`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `page_posts_queue` ON `page_posts` (`status`,`publish_at`);