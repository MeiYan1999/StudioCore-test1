CREATE TABLE `contact_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`studio_name` text DEFAULT '' NOT NULL,
	`message` text NOT NULL,
	`source` text DEFAULT 'landing' NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`ip` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `contact_requests_status_created_idx` ON `contact_requests` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `contact_requests_ip_created_idx` ON `contact_requests` (`ip`,`created_at`);--> statement-breakpoint
ALTER TABLE `sessions` ADD `read_only` integer DEFAULT false NOT NULL;