do $test$
declare sample record; found_own boolean; found_other boolean;
begin
 select m.id,m.user_id,
   case when t.user_id<>m.user_id then t.user_id else tm.user_id end as other_id
 into sample from public.trip_messages m
 join public.trips t on t.id=m.trip_id
 left join public.trip_members tm on tm.trip_id=m.trip_id and tm.user_id<>m.user_id and coalesce(tm.status,'accepted')='accepted'
 where m.kind in ('widy','widy_q')
 and (m.user_id=t.user_id or exists(select 1 from public.trip_members mine where mine.trip_id=m.trip_id and mine.user_id=m.user_id and coalesce(mine.status,'accepted')='accepted'))
 and (t.user_id<>m.user_id or tm.user_id is not null)
 and not exists(select 1 from public.content_hides h where h.kind='message' and h.target_id=m.id)
 limit 1;
 if sample is null then raise exception 'No shared-trip sample to test'; end if;
 perform set_config('request.jwt.claim.sub',sample.user_id::text,true);
 set local role authenticated;
 select exists(select 1 from public.trip_messages where id=sample.id) into found_own;
 if not found_own then raise exception 'Owner cannot read own Widy'; end if;
 perform set_config('request.jwt.claim.sub',sample.other_id::text,true);
 select exists(select 1 from public.trip_messages where id=sample.id) into found_other;
 if found_other then raise exception 'Another trip member can read Widy'; end if;
 reset role;
end $test$;
