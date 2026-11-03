CREATE TABLE `fee_payments` (
	`id` text PRIMARY KEY NOT NULL,
	`unlock_id` text NOT NULL,
	`band_id` text NOT NULL,
	`amount` integer NOT NULL,
	`file_key` text,
	`content_type` text NOT NULL,
	`file_size` integer NOT NULL,
	`sha256` text NOT NULL,
	`uploaded_at` text NOT NULL,
	`purge_after` text NOT NULL,
	`purged_at` text,
	`status` text DEFAULT 'checking' NOT NULL,
	`flags` text,
	`x_amount` integer,
	`x_dest_account` text,
	`x_reference` text,
	`x_datetime` text,
	`x_sender_name` text,
	`x_bank` text,
	`review_note` text,
	`reviewed_by` text,
	`reviewed_at` text,
	`invoice_number` text,
	FOREIGN KEY (`unlock_id`) REFERENCES `event_unlocks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`band_id`) REFERENCES `bands`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `fee_payments_unlock_id_unique` ON `fee_payments` (`unlock_id`);--> statement-breakpoint
CREATE INDEX `idx_fee_payments_band` ON `fee_payments` (`band_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_fee_payments_uploaded` ON `fee_payments` (`uploaded_at`);--> statement-breakpoint
CREATE INDEX `idx_fee_payments_sha` ON `fee_payments` (`sha256`);--> statement-breakpoint
CREATE INDEX `idx_fee_payments_ref` ON `fee_payments` (`x_reference`);--> statement-breakpoint
CREATE TABLE `platform_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`bank` text NOT NULL,
	`holder_name` text NOT NULL,
	`account_number` text NOT NULL,
	`is_main` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_unlocks_paid` ON `event_unlocks` (`paid_at`);