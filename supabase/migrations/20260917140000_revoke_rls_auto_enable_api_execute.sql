-- Supabase grants EXECUTE to API roles explicitly in this project.
-- Skipped on a fresh database where the hosted-only helper does not exist.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from anon, authenticated;
  end if;
end $$;
