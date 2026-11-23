ALTER TABLE `drive_share_files` ADD `faces` text;--> statement-breakpoint
ALTER TABLE `drive_shares` ADD `face_search` integer DEFAULT false NOT NULL;