CREATE TABLE `drive_devices` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`name` text NOT NULL,
	`platform` text DEFAULT 'unknown' NOT NULL,
	`app_version` text DEFAULT '' NOT NULL,
	`token_hash` text NOT NULL,
	`paired_by` text,
	`last_seen_at` integer,
	`revoked_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`paired_by`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `drive_devices_token_unique` ON `drive_devices` (`token_hash`);--> statement-breakpoint
CREATE INDEX `drive_devices_tenant_idx` ON `drive_devices` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `drive_pairing_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`code_hash` text NOT NULL,
	`created_by` text,
	`expires_at` integer NOT NULL,
	`used_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `drive_pairing_codes_hash_unique` ON `drive_pairing_codes` (`code_hash`);--> statement-breakpoint
CREATE TABLE `drive_share_files` (
	`id` text PRIMARY KEY NOT NULL,
	`share_id` text NOT NULL,
	`file_key` text NOT NULL,
	`name` text NOT NULL,
	`kind` text DEFAULT 'image' NOT NULL,
	`size` integer DEFAULT 0 NOT NULL,
	`sort_index` integer DEFAULT 0 NOT NULL,
	`picked` integer DEFAULT false NOT NULL,
	`note` text,
	FOREIGN KEY (`share_id`) REFERENCES `drive_shares`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `drive_share_files_key_unique` ON `drive_share_files` (`share_id`,`file_key`);--> statement-breakpoint
CREATE INDEX `drive_share_files_share_idx` ON `drive_share_files` (`share_id`,`sort_index`);--> statement-breakpoint
CREATE TABLE `drive_shares` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`device_id` text NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`client_name` text,
	`kind` text DEFAULT 'select' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`pin_hash` text,
	`max_select` integer DEFAULT 0 NOT NULL,
	`allow_original` integer DEFAULT false NOT NULL,
	`expires_at` integer,
	`file_count` integer DEFAULT 0 NOT NULL,
	`total_bytes` integer DEFAULT 0 NOT NULL,
	`view_count` integer DEFAULT 0 NOT NULL,
	`submitted_at` integer,
	`submission_note` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`device_id`) REFERENCES `drive_devices`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `drive_shares_slug_unique` ON `drive_shares` (`slug`);--> statement-breakpoint
CREATE INDEX `drive_shares_tenant_idx` ON `drive_shares` (`tenant_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `drive_shares_device_idx` ON `drive_shares` (`device_id`);