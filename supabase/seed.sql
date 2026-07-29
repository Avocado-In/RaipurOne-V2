insert into public.complaints (id, title, description, category, department, priority, status, citizen_name, source, ai_analysis, recommended_worker_payload)
values ('CMP-1001', 'Streetlight outage near Sector 12', 'Multiple streetlights in the sector are not functioning after dusk.', 'lighting', 'Public Works', 'high', 'under_review', 'Asha Verma', 'web', '{"category":"infrastructure","confidence":0.91,"priority":"high"}', '{"recommended_worker":"worker-24","department":"Public Works","confidence":0.93}')
on conflict (id) do nothing;

insert into public.notifications (id, title, message, severity, complaint_id)
values ('NTF-1001', 'Dispatch board online', 'Seed notification for Supabase import.', 'info', 'CMP-1001')
on conflict (id) do nothing;
