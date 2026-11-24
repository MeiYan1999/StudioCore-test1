CREATE TABLE `google_calendar_connections` (
	`tenant_id` text PRIMARY KEY NOT NULL,
	`branch_id` text NOT NULL,
	`calendar_id` text NOT NULL,
	`refresh_token_encrypted` text NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON UPDATE no action ON DELETE no action
);
