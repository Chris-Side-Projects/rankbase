-- Up Migration
-- Fix cast_vote RPC and votes table to use public.aega_images instead of legacy aega.images schema
-- Also adds device_hash column to public.aega_votes

ALTER TABLE public.aega_votes ADD COLUMN IF NOT EXISTS device_hash text;

ALTER TABLE public.aega_votes ADD CONSTRAINT IF NOT EXISTS aega_votes_pair_device_unique UNIQUE(image_a, image_b, device_hash);

CREATE OR REPLACE FUNCTION cast_vote(
  p_winner_id uuid, p_loser_id uuid, p_device_hash text
) RETURNS TABLE(new_winner_elo real, new_loser_elo real) LANGUAGE plpgsql AS $$
DECLARE
  v_winner_elo real; v_loser_elo real; v_image_a uuid; v_image_b uuid;
  v_expected_w real; v_new_w_elo real; v_new_l_elo real; k CONSTANT integer := 32;
BEGIN
  IF p_winner_id = p_loser_id THEN RAISE EXCEPTION 'winner and loser must differ' USING ERRCODE = '22000'; END IF;
  IF p_winner_id < p_loser_id THEN v_image_a := p_winner_id; v_image_b := p_loser_id;
  ELSE v_image_a := p_loser_id; v_image_b := p_winner_id; END IF;
  INSERT INTO public.aega_votes(image_a, image_b, winner, device_hash) VALUES (v_image_a, v_image_b, p_winner_id, p_device_hash);
  PERFORM 1 FROM public.aega_images WHERE id = v_image_a FOR UPDATE;
  PERFORM 1 FROM public.aega_images WHERE id = v_image_b FOR UPDATE;
  SELECT elo INTO v_winner_elo FROM public.aega_images WHERE id = p_winner_id;
  SELECT elo INTO v_loser_elo FROM public.aega_images WHERE id = p_loser_id;
  IF v_winner_elo IS NULL OR v_loser_elo IS NULL THEN RAISE EXCEPTION 'image not found' USING ERRCODE = 'P0002'; END IF;
  v_expected_w := 1.0 / (1.0 + power(10.0, (v_loser_elo - v_winner_elo) / 400.0));
  v_new_w_elo := v_winner_elo + k * (1 - v_expected_w);
  v_new_l_elo := v_loser_elo + k * (0 - (1 - v_expected_w));
  UPDATE public.aega_images SET elo = v_new_w_elo, votes = votes + 1 WHERE id = p_winner_id;
  UPDATE public.aega_images SET elo = v_new_l_elo, votes = votes + 1 WHERE id = p_loser_id;
  RETURN QUERY SELECT v_new_w_elo, v_new_l_elo;
END $$;

GRANT EXECUTE ON FUNCTION cast_vote(uuid, uuid, text) TO anon, authenticated, service_role;

-- Down Migration
-- DROP FUNCTION cast_vote(uuid, uuid, text);
