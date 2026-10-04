-- Supabase grants EXECUTE to API roles explicitly in this project.
revoke execute on function public.rls_auto_enable() from anon, authenticated;