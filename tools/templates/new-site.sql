-- new-site.sql — Supabase migration template for a new rankbase site
-- Replace {{PREFIX}} with your site's table prefix (e.g. vidrank, artrank)
-- Run via: psql $DATABASE_URL -f new-site.sql

-- Images
CREATE TABLE IF NOT EXISTS public.{{PREFIX}}_images (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url         text NOT NULL,
  prompt      text,
  provider    text,
  elo         numeric NOT NULL DEFAULT 1500,
  votes       integer NOT NULL DEFAULT 0,
  tags        jsonb NOT NULL DEFAULT '[]',
  style_tags  jsonb NOT NULL DEFAULT '[]',
  subject_tags jsonb NOT NULL DEFAULT '[]',
  mood_tags   jsonb NOT NULL DEFAULT '[]',
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Votes
CREATE TABLE IF NOT EXISTS public.{{PREFIX}}_votes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  winner_id   uuid NOT NULL REFERENCES public.{{PREFIX}}_images(id),
  loser_id    uuid NOT NULL REFERENCES public.{{PREFIX}}_images(id),
  device_hash text NOT NULL,
  user_id     uuid REFERENCES auth.users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT {{PREFIX}}_votes_pair_unique UNIQUE NULLS NOT DISTINCT (
    LEAST(winner_id::text, loser_id::text)::uuid,
    GREATEST(winner_id::text, loser_id::text)::uuid,
    device_hash
  )
);

-- Reports
CREATE TABLE IF NOT EXISTS public.{{PREFIX}}_image_reports (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  image_id    uuid NOT NULL REFERENCES public.{{PREFIX}}_images(id),
  reason      text,
  device_hash text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Prompt pool
CREATE TABLE IF NOT EXISTS public.{{PREFIX}}_prompt_pool (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt      text NOT NULL UNIQUE,
  score       numeric NOT NULL DEFAULT 1500,
  votes       integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Hourly snapshots
CREATE TABLE IF NOT EXISTS public.{{PREFIX}}_hourly_images (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  image_id    uuid REFERENCES public.{{PREFIX}}_images(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Live tag scores view
CREATE OR REPLACE VIEW public.tag_scores_live AS
  SELECT tag, AVG(elo) AS avg_elo, COUNT(*) AS image_count
  FROM (
    SELECT jsonb_array_elements_text(tags) AS tag, elo
    FROM public.{{PREFIX}}_images
  ) t
  GROUP BY tag
  ORDER BY avg_elo DESC;

-- cast_vote RPC (ELO update + vote insert, SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.cast_vote(
  p_winner_id uuid,
  p_loser_id  uuid,
  p_device_hash text,
  p_user_id   uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_winner public.{{PREFIX}}_images%ROWTYPE;
  v_loser  public.{{PREFIX}}_images%ROWTYPE;
  v_k      numeric := 32;
  v_expected_winner numeric;
  v_new_winner_elo  numeric;
  v_new_loser_elo   numeric;
BEGIN
  SELECT * INTO v_winner FROM public.{{PREFIX}}_images WHERE id = p_winner_id FOR UPDATE;
  SELECT * INTO v_loser  FROM public.{{PREFIX}}_images WHERE id = p_loser_id  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Image not found'; END IF;

  v_expected_winner := 1.0 / (1.0 + power(10, (v_loser.elo - v_winner.elo) / 400.0));
  v_new_winner_elo  := v_winner.elo + v_k * (1 - v_expected_winner);
  v_new_loser_elo   := v_loser.elo  + v_k * (0 - (1 - v_expected_winner));

  UPDATE public.{{PREFIX}}_images SET elo = v_new_winner_elo, votes = votes + 1 WHERE id = p_winner_id;
  UPDATE public.{{PREFIX}}_images SET elo = v_new_loser_elo,  votes = votes + 1 WHERE id = p_loser_id;

  INSERT INTO public.{{PREFIX}}_votes (winner_id, loser_id, device_hash, user_id)
  VALUES (p_winner_id, p_loser_id, p_device_hash, p_user_id);

  RETURN jsonb_build_object(
    'newWinnerElo', round(v_new_winner_elo)::int,
    'newLoserElo',  round(v_new_loser_elo)::int
  );
END;
$$;

-- RLS policies
ALTER TABLE public.{{PREFIX}}_images  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.{{PREFIX}}_votes   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.{{PREFIX}}_image_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "{{PREFIX}} images readable by all"
  ON public.{{PREFIX}}_images FOR SELECT USING (true);

CREATE POLICY "{{PREFIX}} votes readable by authenticated"
  ON public.{{PREFIX}}_votes FOR SELECT TO authenticated USING (true);

CREATE POLICY "{{PREFIX}} votes insertable by authenticated"
  ON public.{{PREFIX}}_votes FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "{{PREFIX}} reports insertable by all"
  ON public.{{PREFIX}}_image_reports FOR INSERT USING (true);
