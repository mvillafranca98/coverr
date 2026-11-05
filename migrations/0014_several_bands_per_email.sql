DROP INDEX `idx_bands_contact_email`;--> statement-breakpoint
CREATE INDEX `idx_bands_contact_email` ON `bands` (`contact_email`);