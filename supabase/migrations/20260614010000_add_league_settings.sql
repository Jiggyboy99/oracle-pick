ALTER TABLE public.leagues
  ADD COLUMN IF NOT EXISTS join_type TEXT NOT NULL DEFAULT 'code'
    CHECK (join_type IN ('code', 'approval')),
  ADD COLUMN IF NOT EXISTS show_past_results BOOLEAN NOT NULL DEFAULT true;
