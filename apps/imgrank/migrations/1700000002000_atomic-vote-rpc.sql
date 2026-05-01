-- Up Migration
-- Replace the racy SELECT/SELECT/UPDATE pattern with a single transactional
-- RPC that locks both rows, validates inputs, inserts the vote (relying on
-- the unique constraint for dedup), computes ELO, and updates both rows.
--
-- Why: the previous design read elo, computed new values in app code, and
-- called update_elo with absolute new values. Two concurrent votes on the
-- same image would both read the same starting elo and overwrite each
-- other — the rating pool would drift away from zero-sum.
--
-- Design notes:
--   - Locks rows in deterministic UUID order to avoid AB/BA deadlocks.
--   - INSERT happens first; on UNIQUE violation we exit before any
--     UPDATE, so a duplicate vote costs no row locks.
--   - K-factor matches the application constant (32). If you change one,
--     change the other or the new RPC will be inconsistent with the
--     calculateElo unit tests.
--   - Returns the new ELOs so the API can echo them in the response
--     without a follow-up query.

create or replace function cast_vote(
  p_winner_id uuid,
  p_loser_id  uuid,
  p_device_hash text
) returns table(new_winner_elo real, new_loser_elo real)
language plpgsql as $$
declare
  v_winner_elo real;
  v_loser_elo  real;
  v_image_a    uuid;
  v_image_b    uuid;
  v_expected_w real;
  v_new_w_elo  real;
  v_new_l_elo  real;
  k constant integer := 32;
begin
  if p_winner_id = p_loser_id then
    raise exception 'winner and loser must differ' using errcode = '22000';
  end if;

  -- Normalize pair ordering for the unique-vote constraint.
  if p_winner_id < p_loser_id then
    v_image_a := p_winner_id;
    v_image_b := p_loser_id;
  else
    v_image_a := p_loser_id;
    v_image_b := p_winner_id;
  end if;

  -- INSERT first; the unique (image_a, image_b, device_hash) constraint
  -- raises 23505 on duplicate, which the app translates to 409 Conflict.
  insert into votes(image_a, image_b, winner, device_hash)
  values (v_image_a, v_image_b, p_winner_id, p_device_hash);

  -- Lock both image rows. Acquiring locks in UUID order prevents the AB/BA
  -- deadlock when two concurrent votes share the same pair in opposite
  -- positions.
  perform 1 from images where id = v_image_a for update;
  perform 1 from images where id = v_image_b for update;

  -- Read post-lock ELOs (guaranteed not to change until commit).
  select elo into v_winner_elo from images where id = p_winner_id;
  select elo into v_loser_elo  from images where id = p_loser_id;

  if v_winner_elo is null or v_loser_elo is null then
    raise exception 'image not found' using errcode = 'P0002';
  end if;

  -- Standard ELO math. Mirror src/lib/elo.ts.
  v_expected_w := 1.0 / (1.0 + power(10.0, (v_loser_elo - v_winner_elo) / 400.0));
  v_new_w_elo  := v_winner_elo + k * (1 - v_expected_w);
  v_new_l_elo  := v_loser_elo  + k * (0 - (1 - v_expected_w));

  update images set elo = v_new_w_elo, votes = votes + 1 where id = p_winner_id;
  update images set elo = v_new_l_elo, votes = votes + 1 where id = p_loser_id;

  return query select v_new_w_elo, v_new_l_elo;
end $$;

-- Down Migration
drop function if exists cast_vote(uuid, uuid, text);
