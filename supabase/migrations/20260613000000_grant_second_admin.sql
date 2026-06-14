INSERT INTO public.user_roles (user_id, role)
VALUES ('589237b4-b07e-414c-b5b1-07a5b5139513', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;
