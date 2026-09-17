ALTER TABLE `orders` ADD `refund_policy` text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `refund_policy_text` text;--> statement-breakpoint
-- Backfill from the event rather than leaving the 'none' default in place.
-- Existing orders were sold under whatever their event says today, and that is
-- the only record of it there is. Keeping the default would close the refund
-- window on every order ever placed — the exact bug these columns exist to fix.
UPDATE `orders` SET
  `refund_policy` = coalesce(
    (SELECT `refund_policy` FROM `events` WHERE `events`.`id` = `orders`.`event_id`), 'none'),
  `refund_policy_text` =
    (SELECT `refund_policy_text` FROM `events` WHERE `events`.`id` = `orders`.`event_id`);
