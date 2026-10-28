CREATE TABLE `platform_flags` (
	`key` text PRIMARY KEY NOT NULL,
	`enabled` integer NOT NULL,
	`note` text,
	`changed_at` text NOT NULL
);
