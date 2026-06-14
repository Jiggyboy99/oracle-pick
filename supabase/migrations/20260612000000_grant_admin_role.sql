-- Grant admin role to the primary admin user.
-- Uses ON CONFLICT DO NOTHING so re-running this migration is safe.
INSERT INTO public.user_roles (user_id, role)
VALUES
  ('76158990-c08f-4a75-8129-5be1d7e2f524', 'admin'),  -- akinloyetobi13@gmail.com
  ('589237b4-b07e-414c-b5b1-07a5b5139513', 'admin')   -- emkaykudaisi@gmail.com
ON CONFLICT (user_id, role) DO NOTHING;
