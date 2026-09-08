-- Manual sales need a reason recorded: cash handed to the admin, tickets given
-- against the sound bill, a favour. Without it the row cannot be explained later.
ALTER TABLE `orders` ADD `note` text;
