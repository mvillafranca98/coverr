CREATE TABLE `used_sign_in_links` (
	`id` text PRIMARY KEY NOT NULL,
	`used_at` text NOT NULL,
	`expires_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_used_sign_in_links_expires` ON `used_sign_in_links` (`expires_at`);