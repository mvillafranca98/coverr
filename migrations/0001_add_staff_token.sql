-- Door-staff access to the scanner. A shared per-event URL beats magic links at
-- a venue with bad signal: staff open one link, no inbox, no account, no
-- round-trip. Nullable so existing events keep working until a token is issued.
ALTER TABLE `events` ADD `staff_token` text;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_events_staff_token` ON `events` (`staff_token`);
