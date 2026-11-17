-- Event triggers invoke this helper internally; it is not an RPC endpoint.
-- The helper is created by the hosted Supabase project, not by a migration, so a fresh database
-- (local `supabase start`) does not have it; skip the revoke there.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke all on function public.rls_auto_enable() from public;
  end if;
end $$;
