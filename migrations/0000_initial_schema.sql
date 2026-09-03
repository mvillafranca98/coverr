CREATE TABLE `advances` (
	`id` text PRIMARY KEY NOT NULL,
	`band_id` text NOT NULL,
	`member_id` text NOT NULL,
	`event_id` text,
	`amount` integer NOT NULL,
	`date` text NOT NULL,
	`note` text,
	FOREIGN KEY (`band_id`) REFERENCES `bands`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `band_members`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_advances_member` ON `advances` (`member_id`);--> statement-breakpoint
CREATE TABLE `attendees` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`name` text NOT NULL,
	`note` text,
	`qr_token` text NOT NULL,
	`checked_in_at` text,
	`checked_in_by` text,
	`checked_in_device` text,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `attendees_qr_token_unique` ON `attendees` (`qr_token`);--> statement-breakpoint
CREATE INDEX `idx_attendees_order` ON `attendees` (`order_id`);--> statement-breakpoint
CREATE TABLE `band_members` (
	`id` text PRIMARY KEY NOT NULL,
	`band_id` text NOT NULL,
	`name` text NOT NULL,
	`split_pct` real DEFAULT 0 NOT NULL,
	`is_core` integer DEFAULT 1 NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`band_id`) REFERENCES `bands`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_members_band` ON `band_members` (`band_id`);--> statement-breakpoint
CREATE TABLE `bands` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`contact_email` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bands_slug_unique` ON `bands` (`slug`);--> statement-breakpoint
CREATE TABLE `bank_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`band_id` text NOT NULL,
	`bank` text NOT NULL,
	`account_number` text NOT NULL,
	`holder_name` text NOT NULL,
	`is_default` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`band_id`) REFERENCES `bands`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_accounts_band` ON `bank_accounts` (`band_id`);--> statement-breakpoint
CREATE TABLE `contacts` (
	`id` text PRIMARY KEY NOT NULL,
	`band_id` text NOT NULL,
	`email_normalized` text NOT NULL,
	`phone_normalized` text,
	`display_name` text NOT NULL,
	`first_seen_event_id` text,
	`events_count` integer DEFAULT 0 NOT NULL,
	`tickets_count` integer DEFAULT 0 NOT NULL,
	`notes` text,
	FOREIGN KEY (`band_id`) REFERENCES `bands`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`first_seen_event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_contacts_band_email` ON `contacts` (`band_id`,`email_normalized`);--> statement-breakpoint
CREATE TABLE `event_unlocks` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`bracket` text NOT NULL,
	`amount` integer NOT NULL,
	`paid_at` text,
	`method` text,
	`reference` text,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `event_unlocks_event_id_unique` ON `event_unlocks` (`event_id`);--> statement-breakpoint
CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`band_id` text NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`venue` text NOT NULL,
	`starts_at` text NOT NULL,
	`doors_at` text,
	`description` text,
	`music_type` text,
	`flyer_url` text,
	`thank_you_note` text,
	`capacity_cap` integer,
	`refund_policy` text DEFAULT 'none' NOT NULL,
	`refund_policy_text` text,
	`wristbands_start` integer,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`band_id`) REFERENCES `bands`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `events_slug_unique` ON `events` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_events_band` ON `events` (`band_id`);--> statement-breakpoint
CREATE TABLE `expenses` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`label` text NOT NULL,
	`category` text DEFAULT 'other' NOT NULL,
	`amount` integer NOT NULL,
	`note` text,
	`paid` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_expenses_event` ON `expenses` (`event_id`);--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`short_code` text NOT NULL,
	`payer_name` text NOT NULL,
	`payer_email` text NOT NULL,
	`payer_phone` text,
	`quantity` integer NOT NULL,
	`price_rule_id` text,
	`expected_amount` integer NOT NULL,
	`channel` text NOT NULL,
	`status` text DEFAULT 'confirmed' NOT NULL,
	`verification_status` text DEFAULT 'unmatched' NOT NULL,
	`bank_selected` text,
	`sold_by` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`price_rule_id`) REFERENCES `price_rules`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `orders_short_code_unique` ON `orders` (`short_code`);--> statement-breakpoint
CREATE INDEX `idx_orders_event` ON `orders` (`event_id`);--> statement-breakpoint
CREATE INDEX `idx_orders_email` ON `orders` (`payer_email`);--> statement-breakpoint
CREATE INDEX `idx_orders_status` ON `orders` (`event_id`,`status`);--> statement-breakpoint
CREATE TABLE `payment_proofs` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`file_key` text NOT NULL,
	`content_type` text NOT NULL,
	`file_size` integer NOT NULL,
	`sha256` text NOT NULL,
	`phash` text,
	`doc_type` text DEFAULT 'unknown' NOT NULL,
	`ocr_raw` text,
	`ocr_confidence` real,
	`x_sender_name` text,
	`x_sender_account` text,
	`x_dest_account` text,
	`x_dest_name` text,
	`x_amount` integer,
	`x_currency` text,
	`x_datetime` text,
	`x_reference` text,
	`x_detail` text,
	`x_bank` text,
	`uploaded_at` text NOT NULL,
	`purge_after` text NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_proofs_order` ON `payment_proofs` (`order_id`);--> statement-breakpoint
CREATE INDEX `idx_proofs_sha` ON `payment_proofs` (`sha256`);--> statement-breakpoint
CREATE INDEX `idx_proofs_ref` ON `payment_proofs` (`x_reference`);--> statement-breakpoint
CREATE TABLE `price_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`label` text NOT NULL,
	`amount` integer NOT NULL,
	`max_qty` integer,
	`starts_at` text,
	`ends_at` text,
	`activates_on_selloff_of` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_price_rules_event` ON `price_rules` (`event_id`);--> statement-breakpoint
CREATE TABLE `refund_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`requested_at` text NOT NULL,
	`reason` text,
	`status` text DEFAULT 'open' NOT NULL,
	`handled_by` text,
	`handled_at` text,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_refunds_order` ON `refund_requests` (`order_id`);--> statement-breakpoint
CREATE TABLE `verification_flags` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`proof_id` text,
	`code` text NOT NULL,
	`severity` text NOT NULL,
	`detail` text NOT NULL,
	`created_at` text NOT NULL,
	`resolved_at` text,
	`resolved_by` text,
	`resolution_note` text,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`proof_id`) REFERENCES `payment_proofs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_flags_order` ON `verification_flags` (`order_id`);--> statement-breakpoint
CREATE INDEX `idx_flags_open` ON `verification_flags` (`resolved_at`);