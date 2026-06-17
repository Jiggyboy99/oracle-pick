-- Replace RLS policies that call is_league_member (EXECUTE revoked from authenticated)
-- with equivalent inline subqueries that don't require function EXECUTE privilege.

DROP POLICY IF EXISTS "leagues_select_member" ON public.leagues;
CREATE POLICY "leagues_select_member" ON public.leagues FOR SELECT USING (
  creator_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.league_members
    WHERE league_id = id AND user_id = auth.uid()
  )
);

-- Simplify to user_id = auth.uid() — each user only needs to see their own membership rows.
-- The old policy called is_league_member which recursively queried league_members; an inline
-- EXISTS would cause infinite recursion on the same table under RLS.
DROP POLICY IF EXISTS "league_members_select_member" ON public.league_members;
CREATE POLICY "league_members_select_member" ON public.league_members FOR SELECT USING (
  user_id = auth.uid()
);
