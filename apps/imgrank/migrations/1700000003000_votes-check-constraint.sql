-- Up Migration
-- Defense in depth: ensure winner is always one of the two images in the
-- pair. The application enforces this in two places (route validation and
-- cast_vote RPC) but a DB-level CHECK protects against a future code path
-- that bypasses both.

alter table votes
  add constraint votes_winner_in_pair
  check (winner = image_a or winner = image_b)
  not valid;

-- not valid + validate lets us add the constraint without a full table
-- scan-and-lock on a hot table. New rows are checked immediately; existing
-- rows are validated in the background.
alter table votes validate constraint votes_winner_in_pair;

-- Down Migration
alter table votes drop constraint if exists votes_winner_in_pair;
