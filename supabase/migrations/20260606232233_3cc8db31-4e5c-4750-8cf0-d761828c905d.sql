
CREATE OR REPLACE FUNCTION public.admin_score_fixture(_fixture_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  PERFORM public.score_fixture(_fixture_id);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_score_fixture(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_score_fixture(uuid) TO authenticated;
