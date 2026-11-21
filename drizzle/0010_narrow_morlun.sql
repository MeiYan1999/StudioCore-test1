CREATE TABLE `drive_devices` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`name` text NOT NULL,
	`os` text DEFAULT '' NOT NULL,
	`app_version` text DEFAULT '' NOT NULL,
	`key_hash` text NOT NULL,
	`key_prefix` text NOT NULL,
	`created_by_staff_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`last_seen_at` integer,
	`tunnel_origin` text,
	`revoked_at` integer,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by_staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `drive_devices_key_unique` ON `drive_devices` (`key_hash`);--> statement-breakpoint
CREATE INDEX `drive_devices_tenant_idx` ON `drive_devices` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `drive_selections` (
	`id` text PRIMARY KEY NOT NULL,
	`share_id` text NOT NULL,
	`file_id` text NOT NULL,
	`liked` integer DEFAULT false NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`share_id`) REFERENCES `drive_shares`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`file_id`) REFERENCES `drive_share_files`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `drive_selections_file_unique` ON `drive_selections` (`share_id`,`file_id`);--> statement-breakpoint
CREATE TABLE `drive_share_files` (
	`id` text PRIMARY KEY NOT NULL,
	`share_id` text NOT NULL,
	`file_key` text NOT NULL,
	`name` text NOT NULL,
	`rel_path` text NOT NULL,
	`code` text NOT NULL,
	`kind` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`sort_order` integer NOT NULL,
	FOREIGN KEY (`share_id`) REFERENCES `drive_shares`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `drive_files_share_key_unique` ON `drive_share_files` (`share_id`,`file_key`);--> statement-breakpoint
CREATE TABLE `drive_shares` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`device_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`token_encrypted` text NOT NULL,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`customer_name` text,
	`folder_name` text NOT NULL,
	`media_secret` text NOT NULL,
	`pin_hash` text,
	`allow_originals` integer NOT NULL,
	`max_select` integer,
	`expires_at` integer,
	`status` text DEFAULT 'active' NOT NULL,
	`selection_status` text DEFAULT 'open' NOT NULL,
	`finalized_at` integer,
	`view_count` integer DEFAULT 0 NOT NULL,
	`download_count` integer DEFAULT 0 NOT NULL,
	`file_count` integer NOT NULL,
	`total_bytes` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`device_id`) REFERENCES `drive_devices`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `drive_shares_token_unique` ON `drive_shares` (`token_hash`);--> statement-breakpoint
CREATE INDEX `drive_shares_tenant_idx` ON `drive_shares` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `drive_shares_device_idx` ON `drive_shares` (`device_id`);--> statement-breakpoint
CREATE TABLE `drive_video_comments` (
	`id` text PRIMARY KEY NOT NULL,
	`share_id` text NOT NULL,
	`file_id` text NOT NULL,
	`seconds` real NOT NULL,
	`author` text NOT NULL,
	`content` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`share_id`) REFERENCES `drive_shares`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`file_id`) REFERENCES `drive_share_files`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `drive_comments_share_idx` ON `drive_video_comments` (`share_id`);