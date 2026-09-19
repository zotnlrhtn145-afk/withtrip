-- Internal API counters are used only by server-side service_role clients.
revoke execute on function public.bump_api_counter(text,integer) from public, anon, authenticated;
grant execute on function public.bump_api_counter(text,integer) to service_role;
revoke execute on function public.sweep_api_counters() from public, anon, authenticated;
grant execute on function public.sweep_api_counters() to service_role;
