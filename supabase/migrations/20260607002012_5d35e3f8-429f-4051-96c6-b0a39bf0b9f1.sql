
-- Replace SECURITY DEFINER consensus fn with a SELECT policy that opens
-- other users' predictions only once kickoff has passed.
DROP FUNCTION IF EXISTS public.get_fixture_consensus(uuid);
DROP POLICY IF EXISTS "predictions_select_own" ON public.predictions;
CREATE POLICY "predictions_select_visible" ON public.predictions
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.fixtures f
      WHERE f.id = predictions.fixture_id
        AND f.kickoff_at <= now()
    )
  );

-- Move SECURITY DEFINER scoring functions out of the public API schema.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;

ALTER FUNCTION public.score_fixture(uuid) SET SCHEMA private;
ALTER FUNCTION public.admin_score_fixture(uuid) SET SCHEMA private;
REVOKE ALL ON FUNCTION private.score_fixture(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.admin_score_fixture(uuid) FROM PUBLIC, anon, authenticated;
