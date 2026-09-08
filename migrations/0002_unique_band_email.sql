-- contact_email is how a band logs in, so two bands sharing one would make
-- the second unreachable: the login query takes the first match.
CREATE UNIQUE INDEX `idx_bands_contact_email` ON `bands` (`contact_email`);
