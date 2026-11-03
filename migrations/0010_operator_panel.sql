CREATE TABLE `operator_actions` (
	`id` text PRIMARY KEY NOT NULL,
	`band_id` text NOT NULL,
	`operator_email` text NOT NULL,
	`action` text NOT NULL,
	`note` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`band_id`) REFERENCES `bands`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_operator_actions_band` ON `operator_actions` (`band_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `bands` ADD `banned_at` text;--> statement-breakpoint
ALTER TABLE `bands` ADD `ban_reason` text;--> statement-breakpoint
ALTER TABLE `bands` ADD `free_pass_granted_at` text;--> statement-breakpoint
ALTER TABLE `bands` ADD `free_pass_until` text;--> statement-breakpoint
ALTER TABLE `bands` ADD `free_pass_note` text;--> statement-breakpoint
CREATE INDEX `idx_bands_created` ON `bands` (`created_at`);