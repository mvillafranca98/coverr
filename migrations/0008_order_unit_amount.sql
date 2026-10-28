ALTER TABLE `orders` ADD `unit_amount` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
-- Exact for every existing row: both write paths set
-- expected_amount = unit * quantity, so the division cannot round. Verified
-- against production before writing this - 10 rows, none indivisible, no
-- quantity below 1. The guard is still here because a zero quantity would
-- make this NULL and violate the constraint rather than fail loudly.
UPDATE `orders` SET `unit_amount` = `expected_amount` / `quantity` WHERE `quantity` > 0;
