PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_wardrobe_rentals` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`branch_id` text NOT NULL,
	`wardrobe_item_id` text NOT NULL,
	`order_id` text,
	`customer_id` text,
	`appointment_id` text,
	`checked_out_at` integer,
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
	FOREIGN KEY (`appointment_id`) REFERENCES `appointments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_wardrobe_rentals`("id", "tenant_id", "branch_id", "wardrobe_item_id", "order_id", "customer_id", "appointment_id", "checked_out_at", "due_at", "returned_at", "condition_out", "condition_in", "cleaning_fee", "damage_fee", "deposit", "status", "notes", "created_by", "created_at", "updated_at") SELECT "id", "tenant_id", "branch_id", "wardrobe_item_id", "order_id", "customer_id", NULL, "checked_out_at", "due_at", "returned_at", "condition_out", "condition_in", "cleaning_fee", "damage_fee", "deposit", "status", "notes", "created_by", "created_at", "updated_at" FROM `wardrobe_rentals`;--> statement-breakpoint
DROP TABLE `wardrobe_rentals`;--> statement-breakpoint
ALTER TABLE `__new_wardrobe_rentals` RENAME TO `wardrobe_rentals`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `wardrobe_rentals_item_status_idx` ON `wardrobe_rentals` (`wardrobe_item_id`,`status`);--> statement-breakpoint
CREATE INDEX `wardrobe_rentals_tenant_order_idx` ON `wardrobe_rentals` (`tenant_id`,`order_id`);
--> statement-breakpoint
CREATE TRIGGER release_reserved_items_on_appointments_cancel
AFTER UPDATE OF status ON appointments
WHEN NEW.status = 'cancelled' AND OLD.status <> 'cancelled'
BEGIN
  UPDATE wardrobe_items SET status = 'available', updated_at = unixepoch() * 1000
    WHERE tenant_id = NEW.tenant_id AND status = 'reserved' AND id IN
      (SELECT wardrobe_item_id FROM wardrobe_rentals WHERE appointment_id = NEW.id AND status = 'reserved');
  UPDATE wardrobe_rentals SET status = 'cancelled', updated_at = unixepoch() * 1000
    WHERE tenant_id = NEW.tenant_id AND appointment_id = NEW.id AND status = 'reserved';
END;

--> statement-breakpoint
CREATE TRIGGER release_reserved_items_on_orders_cancel
AFTER UPDATE OF status ON orders
WHEN NEW.status = 'cancelled' AND OLD.status <> 'cancelled'
BEGIN
  UPDATE wardrobe_items SET status = 'available', updated_at = unixepoch() * 1000
    WHERE tenant_id = NEW.tenant_id AND status = 'reserved' AND id IN
      (SELECT wardrobe_item_id FROM wardrobe_rentals WHERE order_id = NEW.id AND status = 'reserved');
  UPDATE wardrobe_rentals SET status = 'cancelled', updated_at = unixepoch() * 1000
    WHERE tenant_id = NEW.tenant_id AND order_id = NEW.id AND status = 'reserved';
END;
