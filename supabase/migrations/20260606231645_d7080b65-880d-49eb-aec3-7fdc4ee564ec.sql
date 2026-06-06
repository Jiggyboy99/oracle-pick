
-- Enums
CREATE TYPE public.app_role AS ENUM ('admin', 'user');
CREATE TYPE public.fixture_status AS ENUM ('upcoming', 'locked', 'finished');

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  total_points INT NOT NULL DEFAULT 0,
  oracle_wins INT NOT NULL DEFAULT 0,
  oracle_losses INT NOT NULL DEFAULT 0,
  current_streak INT NOT NULL DEFAULT 0,
  best_streak INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.profiles TO anon, authenticated;
GRANT INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_all" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- User roles (separate table to avoid privilege escalation)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_roles_select_own" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Teams
CREATE TABLE public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  flag_url TEXT,
  fifa_rank INT
);
GRANT SELECT ON public.teams TO anon, authenticated;
GRANT ALL ON public.teams TO service_role;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "teams_select_all" ON public.teams FOR SELECT USING (true);
CREATE POLICY "teams_admin_write" ON public.teams FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Fixtures
CREATE TABLE public.fixtures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matchday INT NOT NULL,
  home_team_id UUID NOT NULL REFERENCES public.teams(id),
  away_team_id UUID NOT NULL REFERENCES public.teams(id),
  kickoff_at TIMESTAMPTZ NOT NULL,
  status fixture_status NOT NULL DEFAULT 'upcoming',
  home_goals INT,
  away_goals INT
);
GRANT SELECT ON public.fixtures TO anon, authenticated;
GRANT ALL ON public.fixtures TO service_role;
ALTER TABLE public.fixtures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fixtures_select_all" ON public.fixtures FOR SELECT USING (true);
CREATE POLICY "fixtures_admin_write" ON public.fixtures FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Markets
CREATE TABLE public.markets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fixture_id UUID NOT NULL REFERENCES public.fixtures(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  label TEXT NOT NULL,
  points INT NOT NULL DEFAULT 10,
  options JSONB NOT NULL DEFAULT '[]'::jsonb
);
GRANT SELECT ON public.markets TO anon, authenticated;
GRANT ALL ON public.markets TO service_role;
ALTER TABLE public.markets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "markets_select_all" ON public.markets FOR SELECT USING (true);
CREATE POLICY "markets_admin_write" ON public.markets FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Oracle picks
CREATE TABLE public.oracle_picks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fixture_id UUID NOT NULL REFERENCES public.fixtures(id) ON DELETE CASCADE,
  market_id UUID NOT NULL REFERENCES public.markets(id) ON DELETE CASCADE,
  prediction TEXT NOT NULL,
  confidence NUMERIC NOT NULL DEFAULT 0.5,
  reasoning TEXT,
  UNIQUE(market_id)
);
GRANT SELECT ON public.oracle_picks TO anon, authenticated;
GRANT ALL ON public.oracle_picks TO service_role;
ALTER TABLE public.oracle_picks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "oracle_select_all" ON public.oracle_picks FOR SELECT USING (true);
CREATE POLICY "oracle_admin_write" ON public.oracle_picks FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Predictions
CREATE TABLE public.predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  fixture_id UUID NOT NULL REFERENCES public.fixtures(id) ON DELETE CASCADE,
  market_id UUID NOT NULL REFERENCES public.markets(id) ON DELETE CASCADE,
  pick TEXT NOT NULL,
  faded_oracle BOOLEAN NOT NULL DEFAULT false,
  points_awarded INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, market_id)
);
GRANT SELECT ON public.predictions TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.predictions TO authenticated;
GRANT ALL ON public.predictions TO service_role;
ALTER TABLE public.predictions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "predictions_select_all" ON public.predictions FOR SELECT USING (true);
CREATE POLICY "predictions_insert_own" ON public.predictions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "predictions_update_own" ON public.predictions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "predictions_delete_own" ON public.predictions FOR DELETE USING (auth.uid() = user_id);

-- Recaps
CREATE TABLE public.recaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matchday INT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.recaps TO anon, authenticated;
GRANT ALL ON public.recaps TO service_role;
ALTER TABLE public.recaps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "recaps_select_all" ON public.recaps FOR SELECT USING (true);
CREATE POLICY "recaps_admin_write" ON public.recaps FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Leagues
CREATE TABLE public.leagues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  invite_code TEXT NOT NULL UNIQUE,
  creator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.leagues TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.leagues TO authenticated;
GRANT ALL ON public.leagues TO service_role;
ALTER TABLE public.leagues ENABLE ROW LEVEL SECURITY;

-- League members
CREATE TABLE public.league_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(league_id, user_id)
);
GRANT SELECT ON public.league_members TO authenticated;
GRANT INSERT, DELETE ON public.league_members TO authenticated;
GRANT ALL ON public.league_members TO service_role;
ALTER TABLE public.league_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_league_member(_league_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.league_members WHERE league_id = _league_id AND user_id = _user_id)
$$;

CREATE POLICY "leagues_select_member" ON public.leagues FOR SELECT USING (
  public.is_league_member(id, auth.uid()) OR creator_id = auth.uid()
);
CREATE POLICY "leagues_insert_own" ON public.leagues FOR INSERT WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "league_members_select_member" ON public.league_members FOR SELECT USING (
  public.is_league_member(league_id, auth.uid())
);
CREATE POLICY "league_members_insert_self" ON public.league_members FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "league_members_delete_self" ON public.league_members FOR DELETE USING (auth.uid() = user_id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Scoring: when a fixture is finalized, award points
CREATE OR REPLACE FUNCTION public.score_fixture(_fixture_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  fx RECORD;
  r RECORD;
  mkt RECORD;
  oracle_pred TEXT;
  awarded INT;
  actual_result TEXT;
  user_result TEXT;
  oracle_result TEXT;
  affected_users UUID[];
BEGIN
  SELECT * INTO fx FROM public.fixtures WHERE id = _fixture_id;
  IF fx.home_goals IS NULL OR fx.away_goals IS NULL THEN RETURN; END IF;

  actual_result := CASE
    WHEN fx.home_goals > fx.away_goals THEN 'home'
    WHEN fx.home_goals < fx.away_goals THEN 'away'
    ELSE 'draw' END;

  -- Iterate predictions for this fixture
  FOR r IN SELECT p.*, m.type AS market_type, m.points AS market_points
           FROM public.predictions p
           JOIN public.markets m ON m.id = p.market_id
           WHERE p.fixture_id = _fixture_id
  LOOP
    awarded := 0;
    IF r.market_type = 'scoreline' THEN
      IF r.pick = (fx.home_goals::text || '-' || fx.away_goals::text) THEN
        awarded := r.market_points;
      ELSIF split_part(r.pick, '-', 1)::int > split_part(r.pick, '-', 2)::int AND actual_result = 'home'
         OR split_part(r.pick, '-', 1)::int < split_part(r.pick, '-', 2)::int AND actual_result = 'away'
         OR split_part(r.pick, '-', 1)::int = split_part(r.pick, '-', 2)::int AND actual_result = 'draw' THEN
        awarded := GREATEST(1, r.market_points / 3);
      END IF;
    ELSIF r.market_type = 'result' THEN
      IF r.pick = actual_result THEN awarded := r.market_points; END IF;
    ELSIF r.market_type = 'btts' THEN
      IF (r.pick = 'yes' AND fx.home_goals > 0 AND fx.away_goals > 0)
         OR (r.pick = 'no' AND (fx.home_goals = 0 OR fx.away_goals = 0)) THEN
        awarded := r.market_points;
      END IF;
    ELSIF r.market_type = 'over_under' THEN
      IF (r.pick = 'over' AND fx.home_goals + fx.away_goals > 2)
         OR (r.pick = 'under' AND fx.home_goals + fx.away_goals <= 2) THEN
        awarded := r.market_points;
      END IF;
    END IF;

    UPDATE public.predictions SET points_awarded = awarded WHERE id = r.id;

    -- Fade-the-Oracle tracking
    IF r.faded_oracle THEN
      SELECT prediction INTO oracle_pred FROM public.oracle_picks WHERE market_id = r.market_id;
      IF oracle_pred IS NOT NULL THEN
        -- compute oracle awarded for same market type
        DECLARE oracle_awarded INT := 0;
        BEGIN
          IF r.market_type = 'scoreline' THEN
            IF oracle_pred = (fx.home_goals::text || '-' || fx.away_goals::text) THEN oracle_awarded := r.market_points;
            ELSIF split_part(oracle_pred, '-', 1)::int > split_part(oracle_pred, '-', 2)::int AND actual_result = 'home'
               OR split_part(oracle_pred, '-', 1)::int < split_part(oracle_pred, '-', 2)::int AND actual_result = 'away'
               OR split_part(oracle_pred, '-', 1)::int = split_part(oracle_pred, '-', 2)::int AND actual_result = 'draw' THEN
              oracle_awarded := GREATEST(1, r.market_points / 3);
            END IF;
          ELSIF r.market_type = 'result' THEN
            IF oracle_pred = actual_result THEN oracle_awarded := r.market_points; END IF;
          ELSIF r.market_type = 'btts' THEN
            IF (oracle_pred = 'yes' AND fx.home_goals > 0 AND fx.away_goals > 0)
               OR (oracle_pred = 'no' AND (fx.home_goals = 0 OR fx.away_goals = 0)) THEN oracle_awarded := r.market_points; END IF;
          ELSIF r.market_type = 'over_under' THEN
            IF (oracle_pred = 'over' AND fx.home_goals + fx.away_goals > 2)
               OR (oracle_pred = 'under' AND fx.home_goals + fx.away_goals <= 2) THEN oracle_awarded := r.market_points; END IF;
          END IF;
          IF awarded > oracle_awarded THEN
            UPDATE public.profiles SET oracle_wins = oracle_wins + 1 WHERE id = r.user_id;
          ELSIF awarded < oracle_awarded THEN
            UPDATE public.profiles SET oracle_losses = oracle_losses + 1 WHERE id = r.user_id;
          END IF;
        END;
      END IF;
    END IF;
  END LOOP;

  -- Recompute totals and streaks for affected users
  SELECT array_agg(DISTINCT user_id) INTO affected_users FROM public.predictions WHERE fixture_id = _fixture_id;
  IF affected_users IS NOT NULL THEN
    UPDATE public.profiles p SET total_points = COALESCE((
      SELECT SUM(points_awarded) FROM public.predictions WHERE user_id = p.id
    ), 0)
    WHERE p.id = ANY(affected_users);

    -- Simple streak update: count consecutive scoring predictions for this fixture
    UPDATE public.profiles p SET
      current_streak = CASE WHEN EXISTS (
        SELECT 1 FROM public.predictions WHERE user_id = p.id AND fixture_id = _fixture_id AND points_awarded > 0
      ) THEN p.current_streak + 1 ELSE 0 END
    WHERE p.id = ANY(affected_users);
    UPDATE public.profiles SET best_streak = GREATEST(best_streak, current_streak) WHERE id = ANY(affected_users);
  END IF;

  UPDATE public.fixtures SET status = 'finished' WHERE id = _fixture_id;
END;
$$;

-- Enable realtime for leaderboard
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.predictions;
