ALTER TABLE `activity_logs` ADD `branch_id` text;
--> statement-breakpoint
UPDATE `activity_logs` SET `branch_id` = (SELECT `branch_id` FROM `albums` WHERE `albums`.`id` = `activity_logs`.`entity_id`) WHERE `entity` = 'album' AND `entity_id` IS NOT NULL;
--> statement-breakpoint
UPDATE `activity_logs` SET `branch_id` = (SELECT `branch_id` FROM `appointments` WHERE `appointments`.`id` = `activity_logs`.`entity_id`) WHERE `entity` = 'appointment' AND `entity_id` IS NOT NULL;
--> statement-breakpoint
UPDATE `activity_logs` SET `branch_id` = (SELECT `branch_id` FROM `attendance` WHERE `attendance`.`id` = `activity_logs`.`entity_id`) WHERE `entity` = 'attendance' AND `entity_id` IS NOT NULL;
--> statement-breakpoint
UPDATE `activity_logs` SET `branch_id` = (SELECT `branch_id` FROM `budgets` WHERE `budgets`.`id` = `activity_logs`.`entity_id`) WHERE `entity` = 'budget' AND `entity_id` IS NOT NULL;
--> statement-breakpoint
UPDATE `activity_logs` SET `branch_id` = (SELECT `branch_id` FROM `campaigns` WHERE `campaigns`.`id` = `activity_logs`.`entity_id`) WHERE `entity` = 'campaign' AND `entity_id` IS NOT NULL;
--> statement-breakpoint
UPDATE `activity_logs` SET `branch_id` = (SELECT `branch_id` FROM `conversations` WHERE `conversations`.`id` = `activity_logs`.`entity_id`) WHERE `entity` = 'conversation' AND `entity_id` IS NOT NULL;
--> statement-breakpoint
UPDATE `activity_logs` SET `branch_id` = (SELECT `branch_id` FROM `customers` WHERE `customers`.`id` = `activity_logs`.`entity_id`) WHERE `entity` = 'customer' AND `entity_id` IS NOT NULL;
--> statement-breakpoint
UPDATE `activity_logs` SET `branch_id` = (SELECT `branch_id` FROM `documents` WHERE `documents`.`id` = `activity_logs`.`entity_id`) WHERE `entity` = 'document' AND `entity_id` IS NOT NULL;
--> statement-breakpoint
UPDATE `activity_logs` SET `branch_id` = (SELECT `branch_id` FROM `equipment` WHERE `equipment`.`id` = `activity_logs`.`entity_id`) WHERE `entity` = 'equipment' AND `entity_id` IS NOT NULL;
--> statement-breakpoint
UPDATE `activity_logs` SET `branch_id` = (SELECT `branch_id` FROM `expenses` WHERE `expenses`.`id` = `activity_logs`.`entity_id`) WHERE `entity` = 'expense' AND `entity_id` IS NOT NULL;
--> statement-breakpoint
UPDATE `activity_logs` SET `branch_id` = (SELECT `branch_id` FROM `invoices` WHERE `invoices`.`id` = `activity_logs`.`entity_id`) WHERE `entity` = 'invoice' AND `entity_id` IS NOT NULL;
--> statement-breakpoint
UPDATE `activity_logs` SET `branch_id` = (SELECT `branch_id` FROM `leave_requests` WHERE `leave_requests`.`id` = `activity_logs`.`entity_id`) WHERE `entity` = 'leave_request' AND `entity_id` IS NOT NULL;
--> statement-breakpoint
UPDATE `activity_logs` SET `branch_id` = (SELECT `branch_id` FROM `orders` WHERE `orders`.`id` = `activity_logs`.`entity_id`) WHERE `entity` = 'order' AND `entity_id` IS NOT NULL;
--> statement-breakpoint
UPDATE `activity_logs` SET `branch_id` = (SELECT `branch_id` FROM `rooms` WHERE `rooms`.`id` = `activity_logs`.`entity_id`) WHERE `entity` = 'room' AND `entity_id` IS NOT NULL;
--> statement-breakpoint
UPDATE `activity_logs` SET `branch_id` = (SELECT `branch_id` FROM `services` WHERE `services`.`id` = `activity_logs`.`entity_id`) WHERE `entity` = 'service' AND `entity_id` IS NOT NULL;
--> statement-breakpoint
UPDATE `activity_logs` SET `branch_id` = (SELECT `branch_id` FROM `tasks` WHERE `tasks`.`id` = `activity_logs`.`entity_id`) WHERE `entity` = 'task' AND `entity_id` IS NOT NULL;
--> statement-breakpoint
UPDATE `activity_logs` SET `branch_id` = (SELECT `branch_id` FROM `transactions` WHERE `transactions`.`id` = `activity_logs`.`entity_id`) WHERE `entity` = 'transaction' AND `entity_id` IS NOT NULL;
--> statement-breakpoint
UPDATE `activity_logs` SET `branch_id` = (SELECT `branch_id` FROM `vouchers` WHERE `vouchers`.`id` = `activity_logs`.`entity_id`) WHERE `entity` = 'voucher' AND `entity_id` IS NOT NULL;
--> statement-breakpoint
UPDATE `activity_logs` SET `branch_id` = (SELECT `branch_id` FROM `wardrobe_items` WHERE `wardrobe_items`.`id` = `activity_logs`.`entity_id`) WHERE `entity` = 'wardrobe_item' AND `entity_id` IS NOT NULL;
--> statement-breakpoint
UPDATE `activity_logs` SET `branch_id` = (SELECT `branch_id` FROM `wardrobe_rentals` WHERE `wardrobe_rentals`.`id` = `activity_logs`.`entity_id`) WHERE `entity` = 'wardrobe_rental' AND `entity_id` IS NOT NULL;
--> statement-breakpoint
UPDATE `activity_logs` SET `branch_id` = `entity_id` WHERE `entity` = 'branch' AND `entity_id` IN (SELECT `id` FROM `branches`);
--> statement-breakpoint
UPDATE `activity_logs` SET `branch_id` = (SELECT `orders`.`branch_id` FROM `payments` INNER JOIN `orders` ON `orders`.`id` = `payments`.`order_id` WHERE `payments`.`id` = `activity_logs`.`entity_id`) WHERE `entity` = 'payment' AND `entity_id` IS NOT NULL;

--> statement-breakpoint
UPDATE `activity_logs` SET `branch_id` = (SELECT `branch_id` FROM `facebook_pages` WHERE `facebook_pages`.`id` = `activity_logs`.`entity_id`) WHERE `entity` = 'facebook_page' AND `entity_id` IS NOT NULL;
--> statement-breakpoint
UPDATE `activity_logs` SET `branch_id` = (SELECT `orders`.`branch_id` FROM `commissions` INNER JOIN `orders` ON `orders`.`id` = `commissions`.`order_id` WHERE `commissions`.`id` = `activity_logs`.`entity_id`) WHERE `entity` = 'commission' AND `entity_id` IS NOT NULL;
--> statement-breakpoint
UPDATE `activity_logs` SET `branch_id` = (SELECT `services`.`branch_id` FROM `service_addons` INNER JOIN `services` ON `services`.`id` = `service_addons`.`service_id` WHERE `service_addons`.`id` = `activity_logs`.`entity_id`) WHERE `entity` = 'service_addon' AND `entity_id` IS NOT NULL;
--> statement-breakpoint
UPDATE `activity_logs` SET `branch_id` = (SELECT `albums`.`branch_id` FROM `ai_jobs` INNER JOIN `albums` ON `albums`.`id` = `ai_jobs`.`album_id` WHERE `ai_jobs`.`id` = `activity_logs`.`entity_id`) WHERE `entity` = 'ai_job' AND `entity_id` IS NOT NULL;
--> statement-breakpoint
UPDATE `activity_logs` SET `branch_id` = (SELECT COALESCE(`albums`.`branch_id`, `orders`.`branch_id`) FROM `photo_filter_jobs` LEFT JOIN `albums` ON `albums`.`id` = `photo_filter_jobs`.`album_id` LEFT JOIN `orders` ON `orders`.`id` = `photo_filter_jobs`.`order_id` WHERE `photo_filter_jobs`.`id` = `activity_logs`.`entity_id`) WHERE `entity` = 'photo_filter_job' AND `entity_id` IS NOT NULL;
