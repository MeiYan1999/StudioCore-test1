CREATE TABLE `booking_links` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`service_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`booking_id` text,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `booking_offers` (
	`service_id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`room_id` text,
	`photographer_id` text,
	`opens` integer DEFAULT 540 NOT NULL,
	`closes` integer DEFAULT 1080 NOT NULL,
	`closed_days` text DEFAULT '0' NOT NULL,
	`holidays` text DEFAULT '' NOT NULL,
	`buffer` integer DEFAULT 30 NOT NULL,
	`hold_minutes` integer DEFAULT 30 NOT NULL,
	`deposit` integer DEFAULT 0 NOT NULL,
	`created_by` text NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`photographer_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `facebook_deliveries` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`message_id` text,
	`status` text NOT NULL,
	`error` text,
	`attachment` text,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `facebook_message_mid` ON `facebook_deliveries` (`message_id`);--> statement-breakpoint
CREATE TABLE `facebook_oauth` (
	`state` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`tenant_id` text NOT NULL,
	`branch_id` text NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `facebook_pages` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`branch_id` text NOT NULL,
	`name` text NOT NULL,
	`avatar` text,
	`token` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`last_event_at` integer,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `facebook_threads` (
	`conversation_id` text PRIMARY KEY NOT NULL,
	`page_id` text NOT NULL,
	`psid` text NOT NULL,
	`last_inbound_at` integer DEFAULT 0 NOT NULL,
	`read_at` integer DEFAULT 0 NOT NULL,
	`label` text DEFAULT 'Khách mới' NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`page_id`) REFERENCES `facebook_pages`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `facebook_page_psid` ON `facebook_threads` (`page_id`,`psid`);--> statement-breakpoint
CREATE TABLE `inbox_bookings` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`conversation_id` text,
	`page_id` text,
	`service_id` text NOT NULL,
	`order_id` text NOT NULL,
	`appointment_id` text NOT NULL,
	`status` text DEFAULT 'held' NOT NULL,
	`expires_at` integer NOT NULL,
	`source` text NOT NULL,
	`request_key` text NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`page_id`) REFERENCES `facebook_pages`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`appointment_id`) REFERENCES `appointments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `inbox_booking_request` ON `inbox_bookings` (`tenant_id`,`request_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `inbox_booking_appointment` ON `inbox_bookings` (`appointment_id`);--> statement-breakpoint
CREATE TABLE `inbox_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`staff_id` text NOT NULL,
	`content` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `inbox_receipts` (
	`key` text PRIMARY KEY NOT NULL,
	`booking_id` text NOT NULL,
	`payment_id` text NOT NULL,
	FOREIGN KEY (`booking_id`) REFERENCES `inbox_bookings`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `inbox_replies` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`content` text NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);

--> statement-breakpoint
CREATE TRIGGER omni_reservation_insert BEFORE INSERT ON appointments
WHEN NEW.status != 'cancelled' AND NEW.archived_at IS NULL
BEGIN
 SELECT RAISE(ABORT, 'Tài nguyên đã có lịch giữ chỗ hoặc xác nhận')
 WHERE EXISTS (SELECT 1 FROM appointments a JOIN inbox_bookings b ON b.appointment_id=a.id
 WHERE a.tenant_id=NEW.tenant_id AND a.id != NEW.id AND a.status != 'cancelled' AND a.archived_at IS NULL
 AND (b.status='confirmed' OR (b.status='held' AND b.expires_at > unixepoch()*1000))
 AND ((NEW.room_id IS NOT NULL AND a.room_id=NEW.room_id) OR (NEW.photographer_id IS NOT NULL AND a.photographer_id=NEW.photographer_id))
 AND a.start_at < NEW.end_at + NEW.buffer_minutes*60000 AND a.end_at + a.buffer_minutes*60000 > NEW.start_at);
END;

--> statement-breakpoint
CREATE TRIGGER omni_reservation_update BEFORE UPDATE ON appointments
WHEN NEW.status != 'cancelled' AND NEW.archived_at IS NULL
BEGIN
 SELECT RAISE(ABORT, 'Tài nguyên đã có lịch giữ chỗ hoặc xác nhận')
 WHERE EXISTS (SELECT 1 FROM appointments a JOIN inbox_bookings b ON b.appointment_id=a.id
 WHERE a.tenant_id=NEW.tenant_id AND a.id != NEW.id AND a.status != 'cancelled' AND a.archived_at IS NULL
 AND (b.status='confirmed' OR (b.status='held' AND b.expires_at > unixepoch()*1000))
 AND ((NEW.room_id IS NOT NULL AND a.room_id=NEW.room_id) OR (NEW.photographer_id IS NOT NULL AND a.photographer_id=NEW.photographer_id))
 AND a.start_at < NEW.end_at + NEW.buffer_minutes*60000 AND a.end_at + a.buffer_minutes*60000 > NEW.start_at);
END;
