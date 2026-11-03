CREATE TABLE `ai_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`album_id` text,
	`type` text NOT NULL,
	`provider` text DEFAULT 'local' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`input_ref` text,
	`output_ref` text,
	`estimated_cost` integer DEFAULT 0 NOT NULL,
	`error` text,
	`created_by` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`album_id`) REFERENCES `albums`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ai_jobs_tenant_idx` ON `ai_jobs` (`tenant_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `album_folders` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`album_id` text NOT NULL,
	`source_id` text NOT NULL,
	`external_id` text,
	`name` text NOT NULL,
	`relative_path` text NOT NULL,
	`photo_count` integer DEFAULT 0 NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`album_id`) REFERENCES `albums`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`source_id`) REFERENCES `album_sources`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `album_folders_album_idx` ON `album_folders` (`album_id`);--> statement-breakpoint
CREATE INDEX `album_folders_source_idx` ON `album_folders` (`source_id`);--> statement-breakpoint
CREATE TABLE `album_sources` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`album_id` text NOT NULL,
	`provider` text NOT NULL,
	`source_url` text,
	`external_folder_id` text,
	`display_name` text,
	`recursive` integer DEFAULT true NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`last_synced_at` integer,
	`error` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`album_id`) REFERENCES `albums`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `album_sources_album_idx` ON `album_sources` (`album_id`);--> statement-breakpoint
CREATE INDEX `album_sources_tenant_idx` ON `album_sources` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `albums` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`branch_id` text NOT NULL,
	`order_id` text,
	`customer_id` text,
	`title` text NOT NULL,
	`source_type` text DEFAULT 'upload' NOT NULL,
	`source_url` text,
	`drive_folder_id` text,
	`recursive_scan` integer DEFAULT true NOT NULL,
	`selection_limit` integer DEFAULT 10 NOT NULL,
	`extra_photo_enabled` integer DEFAULT false NOT NULL,
	`extra_photo_price` integer DEFAULT 0 NOT NULL,
	`allow_favorites` integer DEFAULT true NOT NULL,
	`allow_notes` integer DEFAULT true NOT NULL,
	`selection_status` text DEFAULT 'draft' NOT NULL,
	`selection_submitted_at` integer,
	`selection_locked_at` integer,
	`token` text NOT NULL,
	`password_hash` text,
	`expires_at` integer,
	`download_limit` integer,
	`download_count` integer DEFAULT 0 NOT NULL,
	`allow_downloads` integer DEFAULT true NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`notes` text,
	`created_by` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`archived_at` integer,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `albums_tenant_token_unique` ON `albums` (`tenant_id`,`token`);--> statement-breakpoint
CREATE INDEX `albums_tenant_branch_idx` ON `albums` (`tenant_id`,`branch_id`);--> statement-breakpoint
CREATE INDEX `albums_tenant_order_idx` ON `albums` (`tenant_id`,`order_id`);--> statement-breakpoint
CREATE INDEX `albums_tenant_status_idx` ON `albums` (`tenant_id`,`status`);--> statement-breakpoint
CREATE TABLE `drive_connections` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`provider` text DEFAULT 'google' NOT NULL,
	`refresh_token_encrypted` text NOT NULL,
	`folder_id` text,
	`status` text DEFAULT 'connected' NOT NULL,
	`last_synced_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `drive_connections_tenant_provider_unique` ON `drive_connections` (`tenant_id`,`provider`);--> statement-breakpoint
CREATE TABLE `payment_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`album_id` text,
	`order_id` text,
	`customer_id` text,
	`code` text NOT NULL,
	`amount` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`note` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`album_id`) REFERENCES `albums`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payment_requests_tenant_code_unique` ON `payment_requests` (`tenant_id`,`code`);--> statement-breakpoint
CREATE INDEX `payment_requests_tenant_status_idx` ON `payment_requests` (`tenant_id`,`status`);--> statement-breakpoint
CREATE TABLE `photo_filter_items` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`job_id` text NOT NULL,
	`input_code` text NOT NULL,
	`matched_photo_id` text,
	`matched_filename` text,
	`status` text NOT NULL,
	`message` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`job_id`) REFERENCES `photo_filter_jobs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `photo_filter_items_job_idx` ON `photo_filter_items` (`job_id`);--> statement-breakpoint
CREATE TABLE `photo_filter_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`album_id` text,
	`customer_id` text,
	`order_id` text,
	`mode` text DEFAULT 'alphanumeric' NOT NULL,
	`input_codes` text NOT NULL,
	`parsed_count` integer DEFAULT 0 NOT NULL,
	`matched_count` integer DEFAULT 0 NOT NULL,
	`missing_count` integer DEFAULT 0 NOT NULL,
	`ambiguous_count` integer DEFAULT 0 NOT NULL,
	`duplicate_count` integer DEFAULT 0 NOT NULL,
	`output_mode` text DEFAULT 'subfolder' NOT NULL,
	`output_folder_name` text DEFAULT 'Ảnh khách chọn' NOT NULL,
	`file_type` text DEFAULT 'all' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_by` text,
	`started_at` integer,
	`finished_at` integer,
	`error` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`album_id`) REFERENCES `albums`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `photo_filter_jobs_tenant_idx` ON `photo_filter_jobs` (`tenant_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `photo_selections` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`album_id` text NOT NULL,
	`photo_id` text NOT NULL,
	`favorite` integer DEFAULT false NOT NULL,
	`selected` integer DEFAULT false NOT NULL,
	`note` text,
	`code_snapshot` text,
	`extra_fee` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`album_id`) REFERENCES `albums`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`photo_id`) REFERENCES `photos`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `photo_selections_album_photo_unique` ON `photo_selections` (`album_id`,`photo_id`);--> statement-breakpoint
CREATE INDEX `photo_selections_album_selected_idx` ON `photo_selections` (`album_id`,`selected`);--> statement-breakpoint
CREATE TABLE `photos` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`album_id` text NOT NULL,
	`folder_id` text,
	`code` text NOT NULL,
	`filename` text NOT NULL,
	`relative_path` text NOT NULL,
	`storage_key` text NOT NULL,
	`thumbnail_key` text NOT NULL,
	`preview_key` text NOT NULL,
	`source_file_id` text,
	`width` integer DEFAULT 0 NOT NULL,
	`height` integer DEFAULT 0 NOT NULL,
	`size` integer DEFAULT 0 NOT NULL,
	`is_raw` integer DEFAULT false NOT NULL,
	`checksum` text,
	`watermarked` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'ready' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`album_id`) REFERENCES `albums`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`folder_id`) REFERENCES `album_folders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `photos_album_code_unique` ON `photos` (`album_id`,`code`);--> statement-breakpoint
CREATE INDEX `photos_album_folder_idx` ON `photos` (`album_id`,`folder_id`);--> statement-breakpoint
CREATE INDEX `photos_album_status_idx` ON `photos` (`album_id`,`status`);--> statement-breakpoint
CREATE INDEX `photos_album_checksum_idx` ON `photos` (`album_id`,`checksum`);