-- Applied through REST 2026-09-20. UKB was missing, so automatic arrival had no coordinates.
-- Source: Civil Aviation Bureau Japan, RJBE AIP, ARP 343758N/1351326E
-- https://nagodede.github.io/aip/japan/documents/RJBE_full.pdf (p29)
insert into public.airport_names (code,name_ko,name_en,is_domestic,tz,lat,lng)
values ('UKB','고베공항','Kobe Airport',false,'Asia/Tokyo',34.632777777777775,135.2238888888889)
on conflict (code) do nothing;
-- One existing null-coordinate transport_arrive row was repaired after verifying its
-- source_id against trip_transports.to_label=UKB. No unrelated schedules changed.
