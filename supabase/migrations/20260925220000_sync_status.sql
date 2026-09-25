-- Suivi de santé de la synchronisation ESPN (alerte de panne) : une ligne
-- unique mise à jour par l'Edge Function sync-nations-league à chaque
-- tentative réelle (les passages « live » sans match ne comptent pas).
create table public.sync_status (
	id text primary key default 'espn' check (id = 'espn'),
	last_attempt_at timestamptz,
	last_success_at timestamptz,
	-- Dernière synchro complète réussie : sert à espacer le mode « full » hors
	-- période de matchs (toutes les 2 h au lieu de 30 min).
	last_full_success_at timestamptz,
	consecutive_failures integer not null default 0,
	-- Message court (le détail complet reste dans les logs de la fonction).
	last_error text check (last_error is null or length(last_error) <= 300),
	-- Horodatage de l'e-mail d'alerte envoyé pour la panne en cours.
	alerted_at timestamptz,
	updated_at timestamptz not null default now()
);

create trigger sync_status_touch_updated_at
	before update on public.sync_status
	for each row execute function public.touch_updated_at();

insert into public.sync_status (id) values ('espn');

alter table public.sync_status enable row level security;

-- Lecture publique (affichée dans Réglages), écriture réservée au service_role.
create policy "sync status is readable by everyone"
	on public.sync_status for select to anon, authenticated using (true);
