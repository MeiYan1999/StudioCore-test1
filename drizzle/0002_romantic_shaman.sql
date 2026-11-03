CREATE TABLE `appointments` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`branch_id` text NOT NULL,
	`order_id` text NOT NULL,
	`room_id` text,
	`photographer_id` text,
	`makeup_id` text,
	`editor_id` text,
	`start_at` integer NOT NULL,
	`end_at` integer NOT NULL,
	`buffer_minutes` integer DEFAULT 30 NOT NULL,
	`status` text DEFAULT 'scheduled' NOT NULL,
	`idempotency_key` text NOT NULL,
	`notes` text,
	`check_in_at` integer,
	`check_out_at` integer,
	`checked_in_by` text,
	`checked_out_by` text,
	`cancel_reason` text,
	`created_by` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`archived_at` integer,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`photographer_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`makeup_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`editor_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`checked_in_by`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`checked_out_by`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `appointments_tenant_idempotency_unique` ON `appointments` (`tenant_id`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `appointments_tenant_branch_start_idx` ON `appointments` (`tenant_id`,`branch_id`,`start_at`);--> statement-breakpoint
CREATE INDEX `appointments_room_start_idx` ON `appointments` (`room_id`,`start_at`);--> statement-breakpoint
CREATE INDEX `appointments_photographer_start_idx` ON `appointments` (`photographer_id`,`start_at`);--> statement-breakpoint
CREATE INDEX `appointments_order_idx` ON `appointments` (`order_id`);--> statement-breakpoint
CREATE TABLE `equipment` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`branch_id` text NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`serial_number` text NOT NULL,
	`status` text DEFAULT 'available' NOT NULL,
	`notes` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `equipment_tenant_serial_unique` ON `equipment` (`tenant_id`,`serial_number`);--> statement-breakpoint
CREATE INDEX `equipment_tenant_branch_idx` ON `equipment` (`tenant_id`,`branch_id`);--> statement-breakpoint
CREATE TABLE `equipment_usages` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`equipment_id` text NOT NULL,
	`order_id` text,
	`appointment_id` text,
	`staff_id` text,
	`checked_out_at` integer NOT NULL,
	`returned_at` integer,
	`condition_out` text DEFAULT 'good' NOT NULL,
	`condition_in` text,
	`notes` text,
	`created_by` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`equipment_id`) REFERENCES `equipment`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`appointment_id`) REFERENCES `appointments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `equipment_usages_equipment_idx` ON `equipment_usages` (`equipment_id`,`checked_out_at`);--> statement-breakpoint
CREATE TABLE `leave_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`branch_id` text NOT NULL,
	`staff_id` text NOT NULL,
	`start_at` integer NOT NULL,
	`end_at` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`reason` text,
	`created_by` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `leave_requests_staff_start_idx` ON `leave_requests` (`staff_id`,`start_at`);--> statement-breakpoint
CREATE INDEX `leave_requests_tenant_status_idx` ON `leave_requests` (`tenant_id`,`status`);--> statement-breakpoint
CREATE TABLE `rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`branch_id` text NOT NULL,
	`name` text NOT NULL,
	`capacity` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`notes` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rooms_tenant_branch_name_unique` ON `rooms` (`tenant_id`,`branch_id`,`name`);--> statement-breakpoint
CREATE INDEX `rooms_tenant_branch_idx` ON `rooms` (`tenant_id`,`branch_id`);--> statement-breakpoint
CREATE TABLE `staff_shifts` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`branch_id` text NOT NULL,
	`staff_id` text NOT NULL,
	`start_at` integer NOT NULL,
	`end_at` integer NOT NULL,
	`role` text DEFAULT 'shift' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `staff_shifts_staff_start_idx` ON `staff_shifts` (`staff_id`,`start_at`);--> statement-breakpoint
CREATE INDEX `staff_shifts_branch_start_idx` ON `staff_shifts` (`branch_id`,`start_at`);--> statement-breakpoint
CREATE TABLE `wardrobe_rentals` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`branch_id` text NOT NULL,
	`wardrobe_item_id` text NOT NULL,
	`order_id` text,
	`customer_id` text,
	`checked_out_at` integer NOT NULL,
	`due_at` integer NOT NULL,
	`returned_at` integer,
	`condition_out` text DEFAULT 'good' NOT NULL,
	`condition_in` text,
	`cleaning_fee` integer DEFAULT 0 NOT NULL,
	`damage_fee` integer DEFAULT 0 NOT NULL,
	`deposit` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`notes` text,
	`created_by` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`wardrobe_item_id`) REFERENCES `wardrobe_items`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `wardrobe_rentals_item_status_idx` ON `wardrobe_rentals` (`wardrobe_item_id`,`status`);--> statement-breakpoint
CREATE INDEX `wardrobe_rentals_tenant_order_idx` ON `wardrobe_rentals` (`tenant_id`,`order_id`);