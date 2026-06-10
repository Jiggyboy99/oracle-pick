
-- Sponsors table
CREATE TABLE public.sponsors (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT        NOT NULL,
  logo_url      TEXT        NOT NULL,
  website_url   TEXT,
  display_order INT         NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.sponsors TO anon, authenticated;
GRANT ALL ON public.sponsors TO service_role;
ALTER TABLE public.sponsors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sponsors_select_all"   ON public.sponsors FOR SELECT USING (true);
CREATE POLICY "sponsors_admin_write"  ON public.sponsors FOR ALL
  USING      (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ---------------------------------------------------------------------------
-- normalize_player_name
-- Strips accents, lowercases, trims, collapses whitespace.
-- Used by score_fixture to compare first_scorer / custom market picks.
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE OR REPLACE FUNCTION public.normalize_player_name(name TEXT)
RETURNS TEXT LANGUAGE SQL IMMUTABLE STRICT AS $$
  SELECT lower(trim(regexp_replace(unaccent(name), '\s+', ' ', 'g')));
$$;
GRANT EXECUTE ON FUNCTION public.normalize_player_name(text) TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- score_fixture (private schema)
-- Adds first_scorer and custom market types.
--
-- Scoring contract for first_scorer / custom:
--   The market's options JSONB array contains { value, label, correct?: bool }.
--   After a match the admin sets correct:true on the winning option.
--   A user's pick matches if normalize(pick) == normalize(winning option value).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.score_fixture(_fixture_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  fx             RECORD;
  r              RECORD;
  oracle_pred    TEXT;
  awarded        INT;
  oracle_awarded INT;
  actual_result  TEXT;
  affected_users UUID[];
BEGIN
  SELECT * INTO fx FROM public.fixtures WHERE id = _fixture_id;
  IF fx.home_goals IS NULL OR fx.away_goals IS NULL THEN RETURN; END IF;

  actual_result := CASE
    WHEN fx.home_goals > fx.away_goals THEN 'home'
    WHEN fx.home_goals < fx.away_goals THEN 'away'
    ELSE 'draw'
  END;

  FOR r IN
    SELECT p.*,
           m.type    AS market_type,
           m.points  AS market_points,
           m.options AS market_options
    FROM   public.predictions p
    JOIN   public.markets m ON m.id = p.market_id
    WHERE  p.fixture_id = _fixture_id
  LOOP
    awarded := 0;

    IF r.market_type = 'scoreline' THEN
      IF r.pick = (fx.home_goals::text || '-' || fx.away_goals::text) THEN
        awarded := r.market_points;
      ELSIF (   split_part(r.pick,'-',1)::int > split_part(r.pick,'-',2)::int AND actual_result = 'home'
             OR split_part(r.pick,'-',1)::int < split_part(r.pick,'-',2)::int AND actual_result = 'away'
             OR split_part(r.pick,'-',1)::int = split_part(r.pick,'-',2)::int AND actual_result = 'draw') THEN
        awarded := GREATEST(1, r.market_points / 3);
      END IF;

    ELSIF r.market_type = 'result' THEN
      IF r.pick = actual_result THEN awarded := r.market_points; END IF;

    ELSIF r.market_type = 'btts' THEN
      IF (r.pick = 'yes' AND fx.home_goals > 0 AND fx.away_goals > 0)
      OR (r.pick = 'no'  AND (fx.home_goals = 0 OR fx.away_goals = 0)) THEN
        awarded := r.market_points;
      END IF;

    ELSIF r.market_type = 'over_under' THEN
      IF (r.pick = 'over'  AND fx.home_goals + fx.away_goals > 2)
      OR (r.pick = 'under' AND fx.home_goals + fx.away_goals <= 2) THEN
        awarded := r.market_points;
      END IF;

    ELSIF r.market_type IN ('first_scorer', 'custom') THEN
      -- Award full points when the user's normalized pick matches any option
      -- flagged correct:true in the market's options array.
      IF EXISTS (
        SELECT 1
        FROM   jsonb_array_elements(r.market_options) AS opt
        WHERE  COALESCE((opt->>'correct')::boolean, false)
          AND  public.normalize_player_name(opt->>'value')
               = public.normalize_player_name(r.pick)
      ) THEN
        awarded := r.market_points;
      END IF;
    END IF;

    UPDATE public.predictions SET points_awarded = awarded WHERE id = r.id;

    -- Fade-the-Oracle tracking
    IF r.faded_oracle THEN
      SELECT prediction INTO oracle_pred
      FROM   public.oracle_picks
      WHERE  market_id = r.market_id;

      IF oracle_pred IS NOT NULL THEN
        oracle_awarded := 0;

        IF r.market_type = 'scoreline' THEN
          IF oracle_pred = (fx.home_goals::text || '-' || fx.away_goals::text) THEN
            oracle_awarded := r.market_points;
          ELSIF (   split_part(oracle_pred,'-',1)::int > split_part(oracle_pred,'-',2)::int AND actual_result = 'home'
                 OR split_part(oracle_pred,'-',1)::int < split_part(oracle_pred,'-',2)::int AND actual_result = 'away'
                 OR split_part(oracle_pred,'-',1)::int = split_part(oracle_pred,'-',2)::int AND actual_result = 'draw') THEN
            oracle_awarded := GREATEST(1, r.market_points / 3);
          END IF;
        ELSIF r.market_type = 'result' THEN
          IF oracle_pred = actual_result THEN oracle_awarded := r.market_points; END IF;
        ELSIF r.market_type = 'btts' THEN
          IF (oracle_pred = 'yes' AND fx.home_goals > 0 AND fx.away_goals > 0)
          OR (oracle_pred = 'no'  AND (fx.home_goals = 0 OR fx.away_goals = 0)) THEN
            oracle_awarded := r.market_points;
          END IF;
        ELSIF r.market_type = 'over_under' THEN
          IF (oracle_pred = 'over'  AND fx.home_goals + fx.away_goals > 2)
          OR (oracle_pred = 'under' AND fx.home_goals + fx.away_goals <= 2) THEN
            oracle_awarded := r.market_points;
          END IF;
        ELSIF r.market_type IN ('first_scorer', 'custom') THEN
          IF EXISTS (
            SELECT 1
            FROM   jsonb_array_elements(r.market_options) AS opt
            WHERE  COALESCE((opt->>'correct')::boolean, false)
              AND  public.normalize_player_name(opt->>'value')
                   = public.normalize_player_name(oracle_pred)
          ) THEN
            oracle_awarded := r.market_points;
          END IF;
        END IF;

        IF    awarded > oracle_awarded THEN
          UPDATE public.profiles SET oracle_wins   = oracle_wins   + 1 WHERE id = r.user_id;
        ELSIF awarded < oracle_awarded THEN
          UPDATE public.profiles SET oracle_losses = oracle_losses + 1 WHERE id = r.user_id;
        END IF;
      END IF;
    END IF;
  END LOOP;

  -- Recompute totals and streaks
  SELECT array_agg(DISTINCT user_id) INTO affected_users
  FROM   public.predictions
  WHERE  fixture_id = _fixture_id;

  IF affected_users IS NOT NULL THEN
    UPDATE public.profiles p
    SET    total_points = COALESCE((
             SELECT SUM(points_awarded)
             FROM   public.predictions
             WHERE  user_id = p.id
           ), 0)
    WHERE  p.id = ANY(affected_users);

    UPDATE public.profiles p
    SET    current_streak = CASE
             WHEN EXISTS (
               SELECT 1 FROM public.predictions
               WHERE  user_id = p.id
                 AND  fixture_id = _fixture_id
                 AND  points_awarded > 0
             ) THEN p.current_streak + 1
             ELSE 0
           END
    WHERE  p.id = ANY(affected_users);

    UPDATE public.profiles
    SET    best_streak = GREATEST(best_streak, current_streak)
    WHERE  id = ANY(affected_users);
  END IF;

  UPDATE public.fixtures SET status = 'finished' WHERE id = _fixture_id;
END;
$$;
