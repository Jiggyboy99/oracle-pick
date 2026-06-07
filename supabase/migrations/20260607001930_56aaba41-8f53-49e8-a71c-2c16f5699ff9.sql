
-- 1. Restrict predictions SELECT to own rows
DROP POLICY IF EXISTS "predictions_select_all" ON public.predictions;
CREATE POLICY "predictions_select_own" ON public.predictions
  FOR SELECT USING (auth.uid() = user_id);

-- 2. Remove predictions from realtime publication
ALTER PUBLICATION supabase_realtime DROP TABLE public.predictions;

-- 3. Aggregated consensus function (no per-user data leaks)
CREATE OR REPLACE FUNCTION public.get_fixture_consensus(_fixture_id uuid)
RETURNS TABLE(market_id uuid, pick text, cnt bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT market_id, pick, count(*)::bigint
  FROM public.predictions
  WHERE fixture_id = _fixture_id
  GROUP BY market_id, pick
$$;
REVOKE ALL ON FUNCTION public.get_fixture_consensus(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_fixture_consensus(uuid) TO authenticated, anon;

-- 4. Lock down internal scoring function; keep admin wrapper available
REVOKE EXECUTE ON FUNCTION public.score_fixture(uuid) FROM PUBLIC, anon, authenticated;

-- 5. Default-deny RLS on realtime.messages so no one can subscribe to
-- arbitrary channel topics. The app uses postgres_changes only.
DO $$
BEGIN
  BEGIN
    EXECUTE 'ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY';
  EXCEPTION WHEN others THEN NULL;
  END;
  BEGIN
    EXECUTE 'DROP POLICY IF EXISTS "realtime_messages_deny_all" ON realtime.messages';
  EXCEPTION WHEN others THEN NULL;
  END;
  BEGIN
    EXECUTE 'CREATE POLICY "realtime_messages_deny_all" ON realtime.messages FOR ALL TO authenticated, anon USING (false) WITH CHECK (false)';
  EXCEPTION WHEN others THEN NULL;
  END;
END $$;
