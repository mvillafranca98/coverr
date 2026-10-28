CREATE TABLE `error_log` (
	`id` text PRIMARY KEY NOT NULL,
	`at` text NOT NULL,
	`kind` text NOT NULL,
	`fingerprint` text NOT NULL,
	`message` text NOT NULL,
	`stack` text,
	`path` text,
	`method` text,
	`alert_claim` text,
	`notified` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_error_log_at` ON `error_log` (`at`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_error_log_alert_claim` ON `error_log` (`alert_claim`);--> statement-breakpoint
CREATE INDEX `idx_error_log_fingerprint_at` ON `error_log` (`fingerprint`,`at`);