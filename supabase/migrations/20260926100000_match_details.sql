-- Fiche match (compositions, statistiques, chronologie, forme, face-à-face).
-- Cache normalisé du « summary » ESPN (~350 Ko bruts → quelques Ko), écrit
-- uniquement par l'Edge Function match-details (service_role), qui ne
-- recontacte ESPN que lorsque le cache est périmé.
create table public.match_details (
	match_id bigint primary key references public.matches (id) on delete cascade,
	payload jsonb not null,
	fetched_at timestamptz not null default now()
);

alter table public.match_details enable row level security;

create policy "match details are readable by everyone"
	on public.match_details for select to anon, authenticated using (true);
