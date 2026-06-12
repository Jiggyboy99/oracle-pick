-- Grant admin role to the primary admin user.
-- Uses ON CONFLICT DO NOTHING so re-running this migration is safe.
INSERT INTO public.user_roles (user_id, role)
VALUES ('ea991daa-c0db-411f-95d7-441b5a7aa0b9', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;
